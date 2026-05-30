import { Bot, InlineKeyboard } from "grammy";
import { MyContext } from "../types";
import { SubscriptionService } from "../../services/subscription.service";

export function setupRenewCommand(
  bot: Bot<MyContext>,
  subscriptionService: SubscriptionService
): void {
  bot.command("renew", async (ctx) => {
    if (!ctx.from) return;

    const subs = await subscriptionService.getActiveSubscriptions(
      BigInt(ctx.from.id)
    );

    if (subs.length === 0) {
      await ctx.reply(
        "❌ Hozircha faol obunalaringiz yo'q.\n\n" +
          "Yangi obuna uchun creator havolasidan foydalaning."
      );
      return;
    }

    const keyboard = new InlineKeyboard();
    for (const sub of subs) {
      const expires = sub.expiresAt
        ? sub.expiresAt.toLocaleDateString("ru-RU")
        : "noma'lum";
      keyboard
        .text(`🔄 ${sub.channel.title} (${expires}gacha)`, `renew:${sub.id}`)
        .row();
    }

    await ctx.reply(
      "🔄 *Obunani yangilash*\n\nQaysi obunani yangilamoqchisiz?\n\n" +
        "_Yangi muddad eski obuna tugagandan keyin boshlanadi._",
      { parse_mode: "Markdown", reply_markup: keyboard }
    );
  });
}
