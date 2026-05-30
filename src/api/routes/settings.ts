import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { encrypt } from "../../lib/crypto";

const merchantSchema = z.object({
  paymeMerchantId: z.string().max(100).optional(),
  paymeKey:        z.string().max(200).optional(),  // plaintext — will be encrypted
  clickServiceId:  z.string().max(100).optional(),
  clickMerchantId: z.string().max(100).optional(),
  clickUserId:     z.string().max(100).optional(),
  clickSecret:     z.string().max(200).optional(),  // plaintext — will be encrypted
});

export function createSettingsRouter(db: PrismaClient): Router {
  const router = Router();
  router.use(requireAuth);

  // PUT /api/settings/merchant
  router.put("/merchant", async (req: Request, res: Response) => {
    const { creatorId } = req as AuthRequest;
    const parsed = merchantSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { paymeMerchantId, paymeKey, clickServiceId, clickMerchantId, clickUserId, clickSecret } = parsed.data;

    const data: Record<string, string | undefined> = {};
    if (paymeMerchantId !== undefined) data.paymeMerchantId = paymeMerchantId;
    if (paymeKey)        data.paymeKeyEnc     = encrypt(paymeKey);
    if (clickServiceId !== undefined)  data.clickServiceId  = clickServiceId;
    if (clickMerchantId !== undefined) data.clickMerchantId = clickMerchantId;
    if (clickUserId !== undefined)     data.clickUserId     = clickUserId;
    if (clickSecret)     data.clickSecretEnc  = encrypt(clickSecret);

    const creator = await db.creator.update({ where: { id: creatorId }, data });
    return res.json({
      ok: true,
      hasPayme: !!creator.paymeMerchantId,
      hasClick: !!creator.clickServiceId,
    });
  });

  return router;
}
