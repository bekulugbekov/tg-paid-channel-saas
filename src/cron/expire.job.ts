import { schedule, ScheduledTask } from "node-cron";
import { Bot } from "grammy";
import { MyContext } from "../bot/types";
import { SubscriptionService } from "../services/subscription.service";
import { logger } from "../lib/logger";

const EXPIRE_NOTIFY_MSG = (channelTitle: string) =>
  `❌ "${channelTitle}" kanalidagi obunangiz tugadi.\n\nYangilash uchun botga qaytib /start yozing.`;

export function setupExpireJob(
  bot: Bot<MyContext>,
  subscriptionService: SubscriptionService
): ScheduledTask {
  return schedule("0 * * * *", async () => {
    logger.info("Running expire subscriptions job");
    try {
      const expired = await subscriptionService.expireSubscriptions();
      logger.info({ count: expired.length }, "Subscriptions expired");

      for (const entry of expired) {
        try {
          await bot.api.sendMessage(
            Number(entry.subscriberTelegramId),
            EXPIRE_NOTIFY_MSG(entry.channelTitle)
          );
          // Throttle notifications to avoid rate limits
          await new Promise((r) => setTimeout(r, 300));
        } catch {
          // User may have blocked the bot — silently ignore
        }
      }
    } catch (err) {
      logger.error({ err }, "Error in expire job");
    }
  });
}
