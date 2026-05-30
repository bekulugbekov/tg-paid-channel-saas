import { Router, Request, Response } from "express";
import { createHash, createHmac } from "node:crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { config } from "../../lib/config";
import { logger } from "../../lib/logger";

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

function verifyTelegramAuth(data: TelegramUser): boolean {
  const { hash, ...rest } = data;
  const dataCheckString = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = createHash("sha256").update(config.BOT_TOKEN).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computed !== hash) return false;

  // Reject stale auth (>1 day), skip in development
  if (config.NODE_ENV !== "development") {
    const age = Math.floor(Date.now() / 1000) - data.auth_date;
    if (age > 86400) return false;
  }

  return true;
}

export function createAuthRouter(db: PrismaClient): Router {
  const router = Router();

  // POST /api/auth/telegram
  router.post("/telegram", async (req: Request, res: Response) => {
    const user = req.body as TelegramUser;

    if (!user?.id || !user?.hash || !user?.auth_date) {
      return res.status(400).json({ error: "Missing auth data" });
    }

    if (!verifyTelegramAuth(user)) {
      logger.warn({ telegramId: user.id }, "Telegram auth verification failed");
      return res.status(403).json({ error: "Auth verification failed" });
    }

    try {
      const creator = await db.creator.upsert({
        where: { telegramId: BigInt(user.id) },
        create: {
          telegramId: BigInt(user.id),
          firstName: user.first_name,
          username:  user.username,
        },
        update: {
          firstName: user.first_name ?? undefined,
          username:  user.username  ?? undefined,
        },
      });

      const token = jwt.sign({ creatorId: creator.id }, config.JWT_SECRET, { expiresIn: "30d" });

      res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: config.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return res.json({ ok: true, creatorId: creator.id });
    } catch (err) {
      logger.error({ err }, "Auth DB error");
      return res.status(500).json({ error: "Server error" });
    }
  });

  // POST /api/auth/logout
  router.post("/logout", (_req, res) => {
    res.clearCookie("token");
    res.json({ ok: true });
  });

  // POST /api/auth/login  — magic link token tekshiruvi (body: { token })
  router.post("/login", async (req: Request, res: Response) => {
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token kiritilmagan" });
    }

    const record = await db.loginToken.findUnique({ where: { token } });

    if (!record) {
      return res.status(403).json({ error: "Token topilmadi yoki noto'g'ri" });
    }
    if (record.used) {
      return res.status(403).json({ error: "Bu havola allaqachon ishlatilgan" });
    }
    if (record.expiresAt < new Date()) {
      return res.status(403).json({ error: "Havolaning muddati o'tgan. /dashboard buyrug'ini qayta yuboring" });
    }

    // Mark as used — one-time guarantee
    await db.loginToken.update({ where: { id: record.id }, data: { used: true } });

    const jwtToken = jwt.sign({ creatorId: record.creatorId }, config.JWT_SECRET, { expiresIn: "30d" });

    res.cookie("token", jwtToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    logger.info({ creatorId: record.creatorId }, "Magic link login successful");
    return res.json({ ok: true });
  });

  return router;
}
