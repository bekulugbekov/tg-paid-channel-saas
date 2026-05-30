import { Bot } from "grammy";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { MyContext } from "../types";
import { config } from "../../lib/config";

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 daqiqa

export function setupDashboardCommand(bot: Bot<MyContext>, db: PrismaClient): void {
  bot.command("dashboard", async (ctx) => {
    if (!ctx.from) return;

    const creator = await db.creator.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
      select: { id: true },
    });

    if (!creator) {
      await ctx.reply(
        "❌ Siz hali ro'yxatdan o'tmagansiz.\n\n" +
          "Botni kanalingizga admin qilib qo'shing, so'ng /creator buyrug'ini yuboring."
      );
      return;
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await db.loginToken.create({
      data: { token, creatorId: creator.id, expiresAt },
    });

    const loginUrl = `${config.DASHBOARD_URL}/login?token=${token}`;

    await ctx.reply(
      `🖥 *Dashboard kirish havolasi*\n\n` +
        `Quyidagi havola orqali dashboardga kiring:\n${loginUrl}\n\n` +
        `⏳ Havola *5 daqiqa* davomida amal qiladi va bir martalik.\n` +
        `🔒 Havolani hech kim bilan ulashmang.`,
      { parse_mode: "Markdown" }
    );
  });
}
