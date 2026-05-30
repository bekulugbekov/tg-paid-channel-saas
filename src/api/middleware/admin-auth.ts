import { Request, Response, NextFunction, RequestHandler } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, requireAuth } from "./auth";
import { config } from "../../lib/config";

export function requireAdmin(db: PrismaClient): RequestHandler[] {
  const adminCheck: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (!config.ADMIN_TELEGRAM_ID) {
      res.status(403).json({ error: "Admin panel not configured" });
      return;
    }

    const creatorId = (req as AuthRequest).creatorId;
    const creator = await db.creator.findUnique({
      where: { id: creatorId },
      select: { telegramId: true },
    });

    if (!creator || creator.telegramId !== config.ADMIN_TELEGRAM_ID) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };

  return [requireAuth, adminCheck];
}
