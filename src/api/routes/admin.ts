import { Router, Request, Response } from "express";
import { PrismaClient, SaasPlan, SubStatus, TxnState } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "../middleware/admin-auth";

const patchPlanSchema = z.object({
  saasPlan:     z.nativeEnum(SaasPlan),
  saasExpiresAt: z.string().datetime().optional().nullable(),
});

export function createAdminRouter(db: PrismaClient): Router {
  const router = Router();
  const adminGuard = requireAdmin(db);

  // GET /api/admin/stats
  router.get("/stats", adminGuard, async (_req: Request, res: Response) => {
    const [totalCreators, totalChannels, totalActiveSubs, totalRevenue] = await Promise.all([
      db.creator.count(),
      db.channel.count({ where: { isActive: true } }),
      db.subscription.count({ where: { status: SubStatus.ACTIVE } }),
      db.transaction.aggregate({
        where: { state: TxnState.PAID },
        _sum: { amountUzs: true },
      }),
    ]);

    return res.json({
      totalCreators,
      totalChannels,
      totalActiveSubs,
      totalRevenue: totalRevenue._sum.amountUzs ?? 0,
    });
  });

  // GET /api/admin/creators
  router.get("/creators", adminGuard, async (req: Request, res: Response) => {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const [creators, total] = await Promise.all([
      db.creator.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              channels:  { where: { isActive: true } },
              plans:     { where: { isActive: true } },
            },
          },
        },
      }),
      db.creator.count(),
    ]);

    const creatorIds = creators.map((c) => c.id);

    // Active subscriber counts per creator
    const activeSubs = await db.subscription.groupBy({
      by: ["channelId"],
      where: {
        status: SubStatus.ACTIVE,
        channel: { creatorId: { in: creatorIds } },
      },
      _count: { id: true },
    });

    // Revenue per creator
    const revenue = await db.transaction.groupBy({
      by: ["subscriptionId"],
      where: {
        state: TxnState.PAID,
        subscription: { channel: { creatorId: { in: creatorIds } } },
      },
      _sum: { amountUzs: true },
    });

    // Map channelId -> creatorId
    const channelToCreator = await db.channel.findMany({
      where: { creatorId: { in: creatorIds } },
      select: { id: true, creatorId: true },
    });
    const channelCreatorMap = new Map(channelToCreator.map((c) => [c.id, c.creatorId]));

    const activeSubsByCreator = new Map<string, number>();
    for (const row of activeSubs) {
      const creatorId = channelCreatorMap.get(row.channelId);
      if (creatorId) {
        activeSubsByCreator.set(
          creatorId,
          (activeSubsByCreator.get(creatorId) ?? 0) + row._count.id
        );
      }
    }

    // Revenue: need subscription -> channel -> creatorId mapping
    const subIds = revenue.map((r) => r.subscriptionId);
    const subChannels = await db.subscription.findMany({
      where: { id: { in: subIds } },
      select: { id: true, channel: { select: { creatorId: true } } },
    });
    const subCreatorMap = new Map(subChannels.map((s) => [s.id, s.channel.creatorId]));

    const revenueByCreator = new Map<string, number>();
    for (const row of revenue) {
      const creatorId = subCreatorMap.get(row.subscriptionId);
      if (creatorId) {
        revenueByCreator.set(
          creatorId,
          (revenueByCreator.get(creatorId) ?? 0) + (row._sum.amountUzs ?? 0)
        );
      }
    }

    const result = creators.map((c) => ({
      id:            c.id,
      telegramId:    c.telegramId.toString(),
      firstName:     c.firstName,
      username:      c.username,
      saasPlan:      c.saasPlan,
      saasExpiresAt: c.saasExpiresAt?.toISOString() ?? null,
      createdAt:     c.createdAt.toISOString(),
      channelCount:  c._count.channels,
      planCount:     c._count.plans,
      activeSubs:    activeSubsByCreator.get(c.id) ?? 0,
      totalRevenue:  revenueByCreator.get(c.id) ?? 0,
      hasPayme:      !!c.paymeMerchantId,
      hasClick:      !!c.clickServiceId,
    }));

    return res.json({ creators: result, total, page, limit });
  });

  // PATCH /api/admin/creators/:id/plan
  router.patch("/creators/:id/plan", adminGuard, async (req: Request, res: Response) => {
    const parsed = patchPlanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const existing = await db.creator.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Creator not found" });

    const updated = await db.creator.update({
      where: { id: req.params.id },
      data: {
        saasPlan:      parsed.data.saasPlan,
        saasExpiresAt: parsed.data.saasExpiresAt
          ? new Date(parsed.data.saasExpiresAt)
          : null,
      },
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        saasPlan: true,
        saasExpiresAt: true,
      },
    });

    return res.json({ ...updated, telegramId: updated.telegramId.toString() });
  });

  return router;
}
