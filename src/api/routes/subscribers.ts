import { Router, Request, Response } from "express";
import { PrismaClient, SubStatus } from "@prisma/client";
import { z } from "zod";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { TelegramAccessService } from "../../services/telegram-access.service";
import { logger } from "../../lib/logger";

const extendSchema = z.object({ days: z.number().int().min(1).max(365) });

export function createSubscribersRouter(db: PrismaClient, telegramAccess: TelegramAccessService): Router {
  const router = Router();
  router.use(requireAuth);

  // GET /api/subscribers?status=ACTIVE&channelId=...
  router.get("/", async (req: Request, res: Response) => {
    const { creatorId } = req as AuthRequest;
    const statusParam = req.query.status as string | undefined;
    const channelId   = req.query.channelId as string | undefined;

    const statusFilter = statusParam && Object.values(SubStatus).includes(statusParam as SubStatus)
      ? (statusParam as SubStatus)
      : undefined;

    const subs = await db.subscription.findMany({
      where: {
        channel: { creatorId },
        ...(channelId    ? { channelId }               : {}),
        ...(statusFilter ? { status: statusFilter }     : {}),
      },
      include: {
        subscriber: { select: { id: true, telegramId: true, username: true, firstName: true } },
        plan:       { select: { id: true, name: true, priceUzs: true } },
        channel:    { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return res.json(subs.map(s => ({
      ...s,
      subscriber: { ...s.subscriber, telegramId: s.subscriber.telegramId.toString() },
    })));
  });

  // POST /api/subscribers/:id/extend
  router.post("/:id/extend", async (req: Request, res: Response) => {
    const { creatorId } = req as AuthRequest;
    const parsed = extendSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const sub = await db.subscription.findFirst({
      where: { id: req.params.id, channel: { creatorId } },
    });
    if (!sub) return res.status(404).json({ error: "Subscription not found" });

    const base = sub.expiresAt && sub.expiresAt > new Date() ? sub.expiresAt : new Date();
    const newExpiry = new Date(base.getTime() + parsed.data.days * 24 * 60 * 60 * 1000);

    const updated = await db.subscription.update({
      where: { id: sub.id },
      data: { expiresAt: newExpiry, status: SubStatus.ACTIVE },
    });
    return res.json(updated);
  });

  // POST /api/subscribers/:id/revoke
  router.post("/:id/revoke", async (req: Request, res: Response) => {
    const { creatorId } = req as AuthRequest;
    const sub = await db.subscription.findFirst({
      where: { id: req.params.id, channel: { creatorId } },
      include: { subscriber: true, channel: true },
    });
    if (!sub) return res.status(404).json({ error: "Subscription not found" });

    try {
      await telegramAccess.kickMember(sub.channel.telegramChannelId, sub.subscriber.telegramId);
    } catch (err) {
      logger.warn({ err, subscriptionId: sub.id }, "kick failed, still cancelling subscription");
    }

    const updated = await db.subscription.update({
      where: { id: sub.id },
      data: { status: SubStatus.CANCELLED },
    });
    return res.json(updated);
  });

  return router;
}
