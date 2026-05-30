import { Bot } from "grammy";
import { MyContext } from "../types";

export function setupStartCommand(bot: Bot<MyContext>): void {
  bot.command("start", async (ctx) => {
    await ctx.reply(
      `👋 Telegram Pullik Kanal botiga xush kelibsiz!\n\n` +
        `Buyruqlar:\n` +
        `/status — Aktiv obunalaringiz\n` +
        `/creator — Creator paneli (kanal ulash)\n` +
        `/help — Yordam\n\n` +
        `Kanal egasi bo'lsangiz, /creator buyrug'ini bosing.`
    );
  });
}
