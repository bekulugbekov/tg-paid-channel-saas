import { Router, Request, Response } from "express";
import { PrismaClient, TxnState, SubStatus } from "@prisma/client";
import { AuthRequest, requireAuth } from "../middleware/auth";

export function createStatsRouter(db: PrismaClient): Router {
  const router = Router();

  router.get("/", requireAuth, async (req: Request, res: Response) => {
    const { creatorId } = req as AuthRequest;

    // Creator's channel IDs
    const channels = await db.channel.findMany({
      where: { creatorId },
      select: { id: true },
    });
    const channelIds = channels.map(c => c.id);

    if (channelIds.length === 0) {
      return res.json({
        totalRevenue:          0,
        monthlyRevenue:        0,
        activeSubscribersCount: 0,
        totalSubscribersCount:  0,
        planBreakdown:         [],
      });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // All PAID transactions for this creator's subscriptions
    const paidTxns = await db.transaction.findMany({
      where: {
        state: TxnState.PAID,
        subscription: { channelId: { in: channelIds } },
      },
      select: { amountUzs: true, paidAt: true, subscription: { select: { planId: true } } },
    });

    const totalRevenue   = paidTxns.reduce((s, t) => s + t.amountUzs, 0);
    const monthlyRevenue = paidTxns
      .filter(t => t.paidAt && t.paidAt >= monthStart)
      .reduce((s, t) => s + t.amountUzs, 0);

    const [activeCount, totalCount] = await Promise.all([
      db.subscription.count({ where: { channelId: { in: channelIds }, status: SubStatus.ACTIVE } }),
      db.subscription.count({ where: { channelId: { in: channelIds } } }),
    ]);

    // Per-plan revenue breakdown
    const plans = await db.plan.findMany({
      where: { channelId: { in: channelIds } },
      select: { id: true, name: true },
    });
    const planMap = Object.fromEntries(plans.map(p => [p.id, p.name]));

    const byPlan: Record<string, { planName: string; count: number; revenue: number }> = {};
    for (const t of paidTxns) {
      const pid = t.subscription.planId;
      if (!byPlan[pid]) byPlan[pid] = { planName: planMap[pid] ?? pid, count: 0, revenue: 0 };
      byPlan[pid].count++;
      byPlan[pid].revenue += t.amountUzs;
    }

    return res.json({
      totalRevenue,
      monthlyRevenue,
      activeSubscribersCount: activeCount,
      totalSubscribersCount:  totalCount,
      planBreakdown: Object.entries(byPlan).map(([planId, v]) => ({ planId, ...v })),
    });
  });

  return router;
}
