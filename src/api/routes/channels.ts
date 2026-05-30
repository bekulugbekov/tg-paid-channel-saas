import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { config } from "../../lib/config";

export function createChannelsRouter(db: PrismaClient): Router {
  const router = Router();

  // GET /api/channels
  router.get("/", requireAuth, async (req, res: Response) => {
    const { creatorId } = req as AuthRequest;
    const channels = await db.channel.findMany({
      where: { creatorId, isActive: true },
      include: {
        _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } },
        plans: { where: { isActive: true }, select: { id: true, name: true, priceUzs: true, durationDays: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(channels.map(ch => ({
      ...ch,
      telegramChannelId: ch.telegramChannelId.toString(),
      activeSubscribers: ch._count.subscriptions,
      deepLink: `https://t.me/${config.BOT_USERNAME ?? ""}?start=c_${ch.telegramChannelId}`,
    })));
  });

  return router;
}
