import { Bot } from "grammy";
import { MyContext } from "../types";
import { SubscriptionService } from "../../services/subscription.service";
import { CreatorService } from "../../services/creator.service";
import { config } from "../../lib/config";

export function setupTestSubCommand(
  bot: Bot<MyContext>,
  services: {
    subscriptionService: SubscriptionService;
    creatorService: CreatorService;
  }
): void {
  bot.command("testsub", async (ctx) => {
    if (!ctx.from) return;

    const callerId = BigInt(ctx.from.id);

    // Only platform admin OR channel creator can use this command
    const isAdmin = config.ADMIN_TELEGRAM_ID
      ? callerId === config.ADMIN_TELEGRAM_ID
      : false;

    const args = ctx.match.trim().split(/\s+/).filter(Boolean);

    if (args.length < 2) {
      await ctx.reply(
        `Ishlatish:\n` +
          `/testsub <channelId> <days>\n` +
          `/testsub <channelId> <days> <userId>\n\n` +
          `Misol: /testsub -1001234567890 7`
      );
      return;
    }

    let channelTelegramId: bigint;
    let durationDays: number;
    let targetUserId: bigint;

    try {
      channelTelegramId = BigInt(args[0]);
      durationDays = parseInt(args[1], 10);
      targetUserId = args[2] ? BigInt(args[2]) : callerId;
    } catch {
      await ctx.reply("❌ Noto'g'ri parametrlar. channelId va userId raqam bo'lishi kerak.");
      return;
    }

    if (isNaN(durationDays) || durationDays < 1 || durationDays > 365) {
      await ctx.reply("❌ Kunlar 1 dan 365 gacha bo'lishi kerak.");
      return;
    }

    // Non-admin can only create subs for their own channels
    if (!isAdmin) {
      const channel = await services.creatorService.findChannelByTelegramId(channelTelegramId);
      if (!channel) {
        await ctx.reply("❌ Kanal topilmadi. Avval botni kanalga admin qilib qo'shing.");
        return;
      }
      const creatorChannels = await services.creatorService.getChannels(callerId);
      const owns = creatorChannels.some((ch) => ch.telegramChannelId === channelTelegramId);
      if (!owns) {
        await ctx.reply("❌ Bu kanal sizga tegishli emas.");
        return;
      }
    }

    try {
      const { subscription, inviteLink } =
        await services.subscriptionService.createTestSubscription({
          channelTelegramId,
          subscriberTelegramId: targetUserId,
          subscriberUsername: ctx.from.username,
          subscriberFirstName: ctx.from.first_name,
          durationDays,
        });

      const expiresAt = subscription.expiresAt
        ? subscription.expiresAt.toLocaleString("ru-RU")
        : "Noma'lum";

      await ctx.reply(
        `✅ Test obuna yaratildi!\n\n` +
          `🔗 Kirish havolasi:\n${inviteLink}\n\n` +
          `⏳ Tugash vaqti: ${expiresAt}\n` +
          `👤 Foydalanuvchi ID: ${targetUserId}\n` +
          `🆔 Obuna ID: ${subscription.id}\n\n` +
          `Havola bir martalik — faqat bitta odam ishlatishi mumkin.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Noma'lum xato";
      await ctx.reply(`❌ Xato: ${msg}`);
    }
  });
}
