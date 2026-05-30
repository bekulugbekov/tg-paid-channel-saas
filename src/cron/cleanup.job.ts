import { schedule, ScheduledTask } from "node-cron";
import { PrismaClient, TxnState } from "@prisma/client";
import { logger } from "../lib/logger";

export function setupCleanupJob(db: PrismaClient): ScheduledTask {
  // Every 6 hours
  return schedule("0 */6 * * *", async () => {
    logger.info("Running cleanup job");
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const { count } = await db.transaction.updateMany({
        where: {
          state:     { in: [TxnState.CREATED, TxnState.PENDING] },
          createdAt: { lt: cutoff },
        },
        data: { state: TxnState.FAILED },
      });

      if (count > 0) logger.info({ count }, "Stale transactions marked FAILED");
    } catch (err) {
      logger.error({ err }, "Error in cleanup job");
    }
  });
}
