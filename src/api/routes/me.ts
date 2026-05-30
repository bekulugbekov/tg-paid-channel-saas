import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, requireAuth } from "../middleware/auth";

export function createMeRouter(db: PrismaClient): Router {
  const router = Router();

  router.get("/", requireAuth, async (req, res: Response) => {
    const { creatorId } = req as AuthRequest;
    const creator = await db.creator.findUnique({
      where: { id: creatorId },
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        username: true,
        email: true,
        saasPlan: true,
        saasExpiresAt: true,
        createdAt: true,
        paymeMerchantId: true,
        clickServiceId: true,
        clickMerchantId: true,
        clickUserId: true,
        // encrypted fields — never expose raw
      },
    });
    if (!creator) return res.status(404).json({ error: "Creator not found" });

    return res.json({
      ...creator,
      telegramId: creator.telegramId.toString(),
      hasPayme: !!creator.paymeMerchantId,
      hasClick: !!creator.clickServiceId,
    });
  });

  return router;
}
