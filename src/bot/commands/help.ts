import { Bot } from "grammy";
import { MyContext } from "../types";

export function setupHelpCommand(bot: Bot<MyContext>): void {
  bot.command("help", async (ctx) => {
    await ctx.reply(
      `ℹ️ Yordam\n\n` +
        `👤 Obunachi uchun:\n` +
        `/start — Botni ishga tushirish\n` +
        `/status — Aktiv obunalaringiz\n\n` +
        `👷 Creator uchun:\n` +
        `/creator — Kanal va tarif boshqaruvi\n\n` +
        `🔧 Admin uchun:\n` +
        `/testsub <channelId> <days> [userId] — Test obuna yaratish`
    );
  });
}
