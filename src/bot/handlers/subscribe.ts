import { Bot, InlineKeyboard } from "grammy";
import { Provider } from "@prisma/client";
import { MyContext } from "../types";
import { PaymentService } from "../../services/payment.service";
import { logger } from "../../lib/logger";

export async function showChannelPlans(
  ctx: MyContext,
  channelTelegramId: bigint,
  paymentService: PaymentService
): Promise<void> {
  const plans = await paymentService.getChannelPlans(channelTelegramId);

  if (plans.length === 0) {
    await ctx.reply("❌ Bu kanalda hozircha faol tariflar yo'q.");
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const plan of plans) {
    const label = `${plan.name} — ${plan.priceUzs.toLocaleString()} so'm / ${plan.durationDays} kun`;
    keyboard.text(label, `plan:${plan.id}`).row();
  }

  await ctx.reply(
    `📢 *${plans[0].channel.title}* kanaliga obuna bo'ling\n\nTarif tanlang:`,
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
}

export function setupSubscribeHandlers(bot: Bot<MyContext>, paymentService: PaymentService): void {
  // ── Callback: plan:<planId> ──────────────────────────────────────────
  bot.callbackQuery(/^plan:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const planId = ctx.match[1];

    try {
      const { subscription, plan } = await paymentService.createPendingSubscription({
        subscriberTelegramId: BigInt(ctx.from.id),
        planId,
        username:   ctx.from.username,
        firstName:  ctx.from.first_name,
      });

      const keyboard = new InlineKeyboard()
        .text("💳 Payme", `pay:payme:${subscription.id}`)
        .text("🟢 Click",  `pay:click:${subscription.id}`);

      await ctx.reply(
        `📦 *${plan.name}*\n💰 ${plan.priceUzs.toLocaleString()} so'm — ${plan.durationDays} kun\n\nTo'lov usulini tanlang:`,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xato";
      await ctx.reply(`❌ ${msg}`);
      logger.error({ err: e, planId }, "plan callback error");
    }
  });

  // ── Callback: pay:payme:<subscriptionId> ────────────────────────────
  bot.callbackQuery(/^pay:payme:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();

    const subscriptionId = ctx.match[1];

    try {
      const txn = await paymentService.createOrGetTransaction(subscriptionId, Provider.PAYME);
      const payUrl = await paymentService.buildPayUrl(txn.id, Provider.PAYME);

      const keyboard = new InlineKeyboard().url("💳 Payme'da to'lash", payUrl);

      await ctx.reply(
        `💳 *Payme orqali to'lov*\n\nQuyidagi tugmani bosib to'lovni amalga oshiring.\nTo'lov tasdiqlangach, kirish havolasi avtomatik yuboriladi.`,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xato";
      await ctx.reply(`❌ ${msg}`);
      logger.error({ err: e, subscriptionId }, "pay:payme callback error");
    }
  });

  // ── Callback: pay:click:<subscriptionId> ────────────────────────────
  bot.callbackQuery(/^pay:click:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();

    const subscriptionId = ctx.match[1];

    try {
      const txn = await paymentService.createOrGetTransaction(subscriptionId, Provider.CLICK);
      const payUrl = await paymentService.buildPayUrl(txn.id, Provider.CLICK);

      const keyboard = new InlineKeyboard().url("🟢 Click'da to'lash", payUrl);

      await ctx.reply(
        `🟢 *Click orqali to'lov*\n\nQuyidagi tugmani bosib to'lovni amalga oshiring.\nTo'lov tasdiqlangach, kirish havolasi avtomatik yuboriladi.`,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xato";
      await ctx.reply(`❌ ${msg}`);
      logger.error({ err: e, subscriptionId }, "pay:click callback error");
    }
  });
}
