import { schedule, ScheduledTask } from "node-cron";
import { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { PrismaClient, SubStatus } from "@prisma/client";
import { MyContext } from "../bot/types";
import { logger } from "../lib/logger";

const HALF_DAY = 12 * 60 * 60 * 1000;

async function sendReminder(
  bot: Bot<MyContext>,
  db: PrismaClient,
  targetMs: number,
  daysLabel: number
): Promise<void> {
  const now = new Date();
  const low  = new Date(now.getTime() + targetMs - HALF_DAY);
  const high = new Date(now.getTime() + targetMs + HALF_DAY);

  const subs = await db.subscription.findMany({
    where: {
      status:    SubStatus.ACTIVE,
      expiresAt: { gte: low, lte: high },
    },
    include: {
      subscriber: true,
      channel:    { select: { title: true } },
    },
  });

  logger.info({ count: subs.length, daysLabel }, "Sending reminders");

  for (const sub of subs) {
    const keyboard = new InlineKeyboard().text("🔄 Yangilash", `renew:${sub.id}`);
    try {
      await bot.api.sendMessage(
        Number(sub.subscriber.telegramId),
        `⏰ Eslatma: *${sub.channel.title}* kanalidagi obunangiz ` +
          `*${daysLabel} kunda* tugaydi!\n\nObunani uzaytirish uchun tugmani bosing:`,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
      await new Promise((r) => setTimeout(r, 150));
    } catch {
      // user may have blocked the bot
    }
  }
}

export function setupRemindersJob(bot: Bot<MyContext>, db: PrismaClient): ScheduledTask {
  return schedule("0 10 * * *", async () => {
    logger.info("Running reminders job");
    try {
      // Specifically target 3-day and 1-day milestones (±12h window each)
      await sendReminder(bot, db, 3 * 24 * 60 * 60 * 1000, 3);
      await sendReminder(bot, db, 1 * 24 * 60 * 60 * 1000, 1);
    } catch (err) {
      logger.error({ err }, "Error in reminders job");
    }
  });
}
