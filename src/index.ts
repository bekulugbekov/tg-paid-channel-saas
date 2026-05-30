import { config } from "./lib/config";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import { Bot } from "grammy";
import { webhookCallback } from "grammy";
import { MyContext } from "./bot/types";
import { registerHandlers } from "./bot/index";
import { createServer } from "./api/server";
import { CreatorService } from "./services/creator.service";
import { TelegramAccessService } from "./services/telegram-access.service";
import { SubscriptionService } from "./services/subscription.service";
import { PaymentService } from "./services/payment.service";
import { setupExpireJob } from "./cron/expire.job";
import { setupRemindersJob } from "./cron/reminders.job";
import { setupCleanupJob } from "./cron/cleanup.job";

async function main(): Promise<void> {
  logger.info({ env: config.NODE_ENV }, "Starting application");

  await prisma.$connect();
  logger.info("Database connected");

  const bot = new Bot<MyContext>(config.BOT_TOKEN);

  const telegramAccess    = new TelegramAccessService(bot.api);
  const creatorService    = new CreatorService(prisma);
  const subscriptionService = new SubscriptionService(prisma, telegramAccess);
  const paymentService    = new PaymentService(prisma, bot.api, telegramAccess);

  registerHandlers(bot, { creatorService, subscriptionService, paymentService, db: prisma });

  const app = createServer({ paymentService, telegramAccess, db: prisma });

  if (config.PUBLIC_URL) {
    const webhookPath = `/bot/${config.BOT_TOKEN}`;
    app.use(webhookPath, webhookCallback(bot, "express"));
    await bot.api.setWebhook(`${config.PUBLIC_URL}${webhookPath}`, {
      allowed_updates: ["message", "callback_query", "my_chat_member", "chat_member"],
    });
    logger.info({ url: `${config.PUBLIC_URL}${webhookPath}` }, "Webhook configured");
  }

  await new Promise<void>((resolve) => {
    app.listen(config.PORT, () => {
      logger.info({ port: config.PORT }, "HTTP server listening");
      resolve();
    });
  });

  if (!config.PUBLIC_URL) {
    void bot.start({
      allowed_updates: ["message", "callback_query", "my_chat_member", "chat_member"],
      onStart: (info) => logger.info({ username: info.username }, "Bot started (long-polling)"),
    });
  }

  setupExpireJob(bot, subscriptionService);
  setupRemindersJob(bot, prisma);
  setupCleanupJob(prisma);
  logger.info("Cron jobs registered (expire, reminders, cleanup)");

  const shutdown = async () => {
    logger.info("Shutting down...");
    await bot.stop();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once("SIGINT",  () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
