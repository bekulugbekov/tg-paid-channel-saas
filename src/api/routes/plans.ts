import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { SAAS_LIMITS } from "../../lib/saas-limits";

const createSchema = z.object({
  channelId:    z.string().min(1),
  name:         z.string().min(1).max(100),
  priceUzs:     z.number().int().nonnegative(),
  durationDays: z.number().int().min(1).max(365),
  description:  z.string().max(500).optional(),
});

const patchSchema = z.object({
  name:         z.string().min(1).max(100).optional(),
  priceUzs:     z.number().int().nonnegative().optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
  description:  z.string().max(500).nullable().optional(),
  isActive:     z.boolean().optional(),
});

export function createPlansRouter(db: PrismaClient): Router {
  const router = Router();
  router.use(requireAuth);

  // GET /api/plans?channelId=...
  router.get("/", async (req: Request, res: Response) => {
    const { creatorId } = req as AuthRequest;
    const channelId = req.query.channelId as string | undefined;

    const plans = await db.plan.findMany({
      where: {
        creatorId,
        ...(channelId ? { channelId } : {}),
      },
      include: {
        channel: { select: { id: true, title: true } },
        _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(plans.map(p => ({ ...p, activeSubscribers: p._count.subscriptions })));
  });

  // POST /api/plans
  router.post("/", async (req: Request, res: Response) => {
    const { creatorId } = req as AuthRequest;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    // Verify channel belongs to creator
    const channel = await db.channel.findFirst({ where: { id: parsed.data.channelId, creatorId } });
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    // SaaS plan limit check
    const creator = await db.creator.findUnique({
      where: { id: creatorId },
      include: { _count: { select: { plans: { where: { isActive: true } } } } },
    });
    if (!creator) return res.status(404).json({ error: "Creator not found" });

    const limit = SAAS_LIMITS[creator.saasPlan].plans;
    if (creator._count.plans >= limit) {
      return res.status(403).json({
        error: `${creator.saasPlan} tarifida maksimal ${limit} ta tarif yaratish mumkin. Tarif oshirish uchun admin bilan bog'laning.`,
      });
    }

    const plan = await db.plan.create({
      data: { ...parsed.data, creatorId },
    });
    return res.status(201).json(plan);
  });

  // PATCH /api/plans/:id
  router.patch("/:id", async (req: Request, res: Response) => {
    const { creatorId } = req as AuthRequest;
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const existing = await db.plan.findFirst({ where: { id: req.params.id, creatorId } });
    if (!existing) return res.status(404).json({ error: "Plan not found" });

    const plan = await db.plan.update({ where: { id: req.params.id }, data: parsed.data });
    return res.json(plan);
  });

  // DELETE /api/plans/:id  (soft delete)
  router.delete("/:id", async (req: Request, res: Response) => {
    const { creatorId } = req as AuthRequest;
    const existing = await db.plan.findFirst({ where: { id: req.params.id, creatorId } });
    if (!existing) return res.status(404).json({ error: "Plan not found" });

    await db.plan.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ ok: true });
  });

  return router;
}
