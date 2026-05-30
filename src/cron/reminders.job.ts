import { schedule, ScheduledTask } from "node-cron";
import { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { PrismaClient, SubStatus } from "@prisma/client";
import { MyContext } from "../bot/types";
import { logger } from "../lib/logger";

export function setupRemindersJob(bot: Bot<MyContext>, db: PrismaClient): ScheduledTask {
  // Every day at 10:00 local time
  return schedule("0 10 * * *", async () => {
    logger.info("Running reminders job");
    try {
      const now  = new Date();
      const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const subs = await db.subscription.findMany({
        where: {
          status:    SubStatus.ACTIVE,
          expiresAt: { gte: now, lte: in3d },
        },
        include: {
          subscriber: true,
          plan:       { select: { id: true, name: true } },
          channel:    { select: { title: true } },
        },
      });

      logger.info({ count: subs.length }, "Sending reminders");

      for (const sub of subs) {
        const msLeft   = sub.expiresAt!.getTime() - now.getTime();
        const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));

        const keyboard = new InlineKeyboard()
          .text("🔄 Yangilash", `renew:${sub.id}`);

        try {
          await bot.api.sendMessage(
            Number(sub.subscriber.telegramId),
            `⏰ Eslatma: *${sub.channel.title}* kanalidagi obunangiz ` +
              `*${daysLeft} kunda* tugaydi!\n\nObunani uzaytirish uchun tugmani bosing:`,
            { parse_mode: "Markdown", reply_markup: keyboard }
          );
          await new Promise(r => setTimeout(r, 150));
        } catch {
          // user may have blocked the bot
        }
      }
    } catch (err) {
      logger.error({ err }, "Error in reminders job");
    }
  });
}
