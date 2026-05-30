import { Bot } from "grammy";
import { MyContext } from "../types";
import { PaymentService } from "../../services/payment.service";
import { showChannelPlans } from "../handlers/subscribe";

export function setupStartCommand(bot: Bot<MyContext>, paymentService: PaymentService): void {
  bot.command("start", async (ctx) => {
    const arg = ctx.match?.trim() ?? "";

    // Deep link: /start c_<channelTelegramId>  (creator shares this link)
    if (arg.startsWith("c_")) {
      try {
        const channelTelegramId = BigInt(arg.slice(2));
        await showChannelPlans(ctx, channelTelegramId, paymentService);
        return;
      } catch {
        // fall through to welcome message
      }
    }

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
