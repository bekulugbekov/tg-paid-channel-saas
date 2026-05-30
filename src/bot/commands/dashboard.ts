import { Bot } from "grammy";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { MyContext } from "../types";
import { config } from "../../lib/config";

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

    // One-time token, 1 soat amal qiladi
    const token = jwt.sign(
      { creatorId: creator.id, type: "bot_login" },
      config.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const loginUrl = `${config.DASHBOARD_URL}/api/auth/bot-login?token=${token}`;

    await ctx.reply(
      `🖥 *Dashboard kirish havolasi*\n\n` +
        `Quyidagi havola orqali dashboardga kiring:\n${loginUrl}\n\n` +
        `⏳ Havola *1 soat* davomida amal qiladi.\n` +
        `🔒 Havolani hech kim bilan ulashmang.`,
      { parse_mode: "Markdown" }
    );
  });
}
