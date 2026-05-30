import { Bot } from "grammy";
import { MyContext } from "../types";
import { SubscriptionService } from "../../services/subscription.service";

export function setupStatusCommand(
  bot: Bot<MyContext>,
  subscriptionService: SubscriptionService
): void {
  bot.command("status", async (ctx) => {
    if (!ctx.from) return;

    const subs = await subscriptionService.getActiveSubscriptions(BigInt(ctx.from.id));

    if (subs.length === 0) {
      await ctx.reply("❌ Sizda aktiv obuna yo'q.");
      return;
    }

    const lines = subs.map((sub) => {
      const expires = sub.expiresAt
        ? sub.expiresAt.toLocaleDateString("ru-RU")
        : "Noma'lum";
      return `📺 ${sub.channel.title}\n📦 Tarif: ${sub.plan.name}\n⏳ Tugash sanasi: ${expires}`;
    });

    await ctx.reply(`✅ Aktiv obunalaringiz:\n\n${lines.join("\n\n")}`);
  });
}
