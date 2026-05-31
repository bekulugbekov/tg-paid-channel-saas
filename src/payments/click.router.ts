import { Router, Request, Response } from "express";
import { TxnState } from "@prisma/client";
import { PaymentService } from "../services/payment.service";
import { decrypt } from "../lib/crypto";
import { logger } from "../lib/logger";

// Click error codes
const CE = {
  OK:            0,
  SIGN_FAILED:   -1,
  WRONG_AMOUNT:  -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID:  -4,
  USER_NOT_FOUND: -5,
  TXN_NOT_FOUND: -6,
  CANCELLED:     -9,
} as const;

function clickResp(
  clickTransId: string,
  merchantTransId: string,
  extraFields: Record<string, unknown>,
  error: number,
  errorNote: string
) {
  return { click_trans_id: clickTransId, merchant_trans_id: merchantTransId, ...extraFields, error, error_note: errorNote };
}

function fail(clickTransId: string, merchantTransId: string, code: number, note: string) {
  return clickResp(clickTransId, merchantTransId, {}, code, note);
}

export function createClickRouter(svc: PaymentService): Router {
  const router = Router({ mergeParams: true });

  // Shared: find transaction + validate creator + extract decrypted secret
  async function resolve(merchantTransId: string, urlCreatorId: string): Promise<{ txn: Awaited<ReturnType<typeof svc.getTransaction>>; secretKey: string | null }> {
    const txn = await svc.getTransaction(merchantTransId);
    if (!txn) return { txn: null, secretKey: null };
    const creator = txn.subscription.plan.channel.creator;
    if (creator.id !== urlCreatorId) return { txn: null, secretKey: null };
    if (!creator.clickSecretEnc) return { txn, secretKey: null };
    try {
      return { txn, secretKey: decrypt(creator.clickSecretEnc) };
    } catch {
      return { txn, secretKey: null };
    }
  }

  // POST /payments/click/prepare  (action=0)
  router.post("/prepare", async (req: Request, res: Response) => {
    const {
      click_trans_id = "",
      service_id = "",
      merchant_trans_id = "",
      amount = "",
      action = "",
      sign_time = "",
      sign_string = "",
    } = req.body as Record<string, string>;

    logger.debug({ click_trans_id, merchant_trans_id, action }, "Click prepare");

    if (action !== "0") {
      return res.json(fail(click_trans_id, merchant_trans_id, CE.ACTION_NOT_FOUND, "Action not found"));
    }

    const { txn, secretKey } = await resolve(merchant_trans_id, req.params["creatorId"]);
    if (!txn) return res.json(fail(click_trans_id, merchant_trans_id, CE.TXN_NOT_FOUND, "Transaction not found"));
    if (!secretKey) return res.json(fail(click_trans_id, merchant_trans_id, CE.SIGN_FAILED, "Sign check failed"));

    // sign = MD5(click_trans_id + service_id + secret + merchant_trans_id + amount + action + sign_time)
    const expected = svc.buildClickSign([
      click_trans_id, service_id, secretKey, merchant_trans_id, amount, action, sign_time,
    ]);
    if (sign_string !== expected) {
      logger.warn({ click_trans_id, expected, got: sign_string }, "Click prepare sign mismatch");
      return res.json(fail(click_trans_id, merchant_trans_id, CE.SIGN_FAILED, "Sign check failed"));
    }

    const clickAmount = parseFloat(amount);
    if (Math.abs(clickAmount - txn.amountUzs) > 0.01) {
      return res.json(fail(click_trans_id, merchant_trans_id, CE.WRONG_AMOUNT, "Incorrect amount"));
    }

    if (txn.state === TxnState.PAID) {
      return res.json(fail(click_trans_id, merchant_trans_id, CE.ALREADY_PAID, "Already paid"));
    }
    if (txn.state === TxnState.CANCELLED) {
      return res.json(fail(click_trans_id, merchant_trans_id, CE.CANCELLED, "Transaction cancelled"));
    }

    // Set providerTxnId = click_trans_id if not yet set
    if (!txn.providerTxnId) {
      await svc.markTransactionPending(txn.id, click_trans_id);
    }

    return res.json(clickResp(click_trans_id, merchant_trans_id, { merchant_prepare_id: txn.id }, CE.OK, "Success"));
  });

  // POST /payments/click/complete  (action=1)
  router.post("/complete", async (req: Request, res: Response) => {
    const {
      click_trans_id = "",
      service_id = "",
      merchant_trans_id = "",
      merchant_prepare_id = "",
      amount = "",
      action = "",
      sign_time = "",
      sign_string = "",
      error: clickError = "0",
    } = req.body as Record<string, string>;

    logger.debug({ click_trans_id, merchant_trans_id, action, error: clickError }, "Click complete");

    if (action !== "1") {
      return res.json(fail(click_trans_id, merchant_trans_id, CE.ACTION_NOT_FOUND, "Action not found"));
    }

    const { txn, secretKey } = await resolve(merchant_trans_id, req.params["creatorId"]);
    if (!txn) return res.json(fail(click_trans_id, merchant_trans_id, CE.TXN_NOT_FOUND, "Transaction not found"));
    if (!secretKey) return res.json(fail(click_trans_id, merchant_trans_id, CE.SIGN_FAILED, "Sign check failed"));

    // sign = MD5(click_trans_id + service_id + secret + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
    const expected = svc.buildClickSign([
      click_trans_id, service_id, secretKey, merchant_trans_id, merchant_prepare_id, amount, action, sign_time,
    ]);
    if (sign_string !== expected) {
      logger.warn({ click_trans_id, expected, got: sign_string }, "Click complete sign mismatch");
      return res.json(fail(click_trans_id, merchant_trans_id, CE.SIGN_FAILED, "Sign check failed"));
    }

    const clickAmount = parseFloat(amount);
    if (Math.abs(clickAmount - txn.amountUzs) > 0.01) {
      return res.json(fail(click_trans_id, merchant_trans_id, CE.WRONG_AMOUNT, "Incorrect amount"));
    }

    if (merchant_prepare_id !== txn.id) {
      return res.json(fail(click_trans_id, merchant_trans_id, CE.TXN_NOT_FOUND, "prepare_id mismatch"));
    }

    // Click reports payment failed/cancelled
    const errCode = Number(clickError);
    if (errCode < 0) {
      await svc.cancelTransaction(txn.id, errCode);
      return res.json(clickResp(click_trans_id, merchant_trans_id, { merchant_confirm_id: txn.id }, CE.OK, "Cancelled"));
    }

    // Idempotent: already paid
    if (txn.state === TxnState.PAID) {
      return res.json(clickResp(click_trans_id, merchant_trans_id, { merchant_confirm_id: txn.id }, CE.OK, "Success"));
    }

    await svc.activateAfterPayment(txn.id);

    return res.json(clickResp(click_trans_id, merchant_trans_id, { merchant_confirm_id: txn.id }, CE.OK, "Success"));
  });

  return router;
}
