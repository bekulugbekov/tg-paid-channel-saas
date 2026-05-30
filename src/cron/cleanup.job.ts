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

      // Delete expired LoginTokens (older than 1 hour)
      const tokenCutoff = new Date(Date.now() - 60 * 60 * 1000);
      const { count: tokenCount } = await db.loginToken.deleteMany({
        where: { expiresAt: { lt: tokenCutoff } },
      });
      if (tokenCount > 0) logger.info({ count: tokenCount }, "Expired login tokens deleted");
    } catch (err) {
      logger.error({ err }, "Error in cleanup job");
    }
  });
}
