import { Router, Request, Response } from "express";
import { Provider, TxnState } from "@prisma/client";
import { PaymentService } from "../services/payment.service";
import { logger } from "../lib/logger";

// Payme JSON-RPC error codes
const ERR = {
  PARSE_ERROR:    { code: -32700, message: "Parse error" },
  INVALID_REQ:    { code: -32600, message: "Invalid request" },
  METHOD_NOT_FOUND: { code: -32601, message: "Method not found" },
  AUTH_FAILED:    { code: -32504, message: "Authentication failed" },
  ORDER_NOT_FOUND: { code: -31050, message: "Order not found" },
  ORDER_BAD_STATE: { code: -31051, message: "Order state incorrect" },
  AMOUNT_WRONG:   { code: -31001, message: "Amount incorrect" },
  TXN_NOT_FOUND:  { code: -31003, message: "Transaction not found" },
  TXN_BAD_STATE:  { code: -31008, message: "Transaction state incorrect" },
  CANT_PERFORM:   { code: -31007, message: "Cannot perform transaction" },
  SYSTEM_ERROR:   { code: -32400, message: "System error" },
} as const;

// Payme canonical state codes
const PS = { PENDING: 1, PAID: 2, CANCELLED_BEFORE: -1, CANCELLED_AFTER: -2 } as const;

function toPaymeState(state: TxnState): number {
  if (state === TxnState.PAID) return PS.PAID;
  if (state === TxnState.CANCELLED) return PS.CANCELLED_BEFORE;
  return PS.PENDING; // CREATED or PENDING
}

type RpcId = string | number | null;

function ok(id: RpcId, result: object) {
  return { jsonrpc: "2.0", id, result };
}

function err(id: RpcId, e: { code: number; message: string }, data?: string) {
  return { jsonrpc: "2.0", id, error: { code: e.code, message: e.message, data: data ?? e.message } };
}

export function createPaymeRouter(svc: PaymentService): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;
    const rpcId: RpcId = (body?.id as RpcId) ?? null;

    if (!body?.method) {
      return res.json(err(rpcId, ERR.INVALID_REQ));
    }

    const method = body.method as string;
    const params = (body.params as Record<string, unknown>) ?? {};

    logger.debug({ method }, "Payme RPC");

    try {
      switch (method) {
        // ────────────────────────────────────────────────────────────────
        case "CheckPerformTransaction": {
          const orderId = (params.account as Record<string, string>)?.order_id;
          const amount = Number(params.amount);
          if (!orderId) return res.json(err(rpcId, ERR.ORDER_NOT_FOUND));

          const txn = await svc.getTransaction(orderId);
          if (!txn) return res.json(err(rpcId, ERR.ORDER_NOT_FOUND));

          const creator = txn.subscription.plan.channel.creator;
          if (!creator.paymeKeyEnc || !svc.verifyPaymeAuth(req.headers.authorization, creator.paymeKeyEnc)) {
            return res.json(err(rpcId, ERR.AUTH_FAILED));
          }

          if (txn.state !== TxnState.CREATED && txn.state !== TxnState.PENDING) {
            return res.json(err(rpcId, ERR.ORDER_BAD_STATE));
          }

          const expected = txn.amountUzs * 100; // tiyin
          if (amount !== expected) {
            return res.json(err(rpcId, ERR.AMOUNT_WRONG, `Expected ${expected}`));
          }

          return res.json(ok(rpcId, { allow: true }));
        }

        // ────────────────────────────────────────────────────────────────
        case "CreateTransaction": {
          const paymeId = params.id as string;
          const orderId = (params.account as Record<string, string>)?.order_id;
          const amount = Number(params.amount);
          if (!paymeId || !orderId) return res.json(err(rpcId, ERR.INVALID_REQ));

          // Idempotency: already registered this Payme transaction?
          const byPaymeId = await svc.findByProviderTxnId(Provider.PAYME, paymeId);
          if (byPaymeId) {
            const c = byPaymeId.subscription.plan.channel.creator;
            if (!c.paymeKeyEnc || !svc.verifyPaymeAuth(req.headers.authorization, c.paymeKeyEnc)) {
              return res.json(err(rpcId, ERR.AUTH_FAILED));
            }
            if (byPaymeId.state === TxnState.CANCELLED) {
              return res.json(err(rpcId, ERR.TXN_BAD_STATE));
            }
            return res.json(ok(rpcId, {
              create_time: byPaymeId.createdAt.getTime(),
              transaction: byPaymeId.id,
              state: toPaymeState(byPaymeId.state),
            }));
          }

          // Find our local transaction by order_id
          const txn = await svc.getTransaction(orderId);
          if (!txn) return res.json(err(rpcId, ERR.ORDER_NOT_FOUND));

          const creator = txn.subscription.plan.channel.creator;
          if (!creator.paymeKeyEnc || !svc.verifyPaymeAuth(req.headers.authorization, creator.paymeKeyEnc)) {
            return res.json(err(rpcId, ERR.AUTH_FAILED));
          }

          if (txn.amountUzs * 100 !== amount) {
            return res.json(err(rpcId, ERR.AMOUNT_WRONG));
          }

          if (txn.state !== TxnState.CREATED) {
            return res.json(err(rpcId, ERR.ORDER_BAD_STATE));
          }

          await svc.markTransactionPending(txn.id, paymeId);

          return res.json(ok(rpcId, {
            create_time: txn.createdAt.getTime(),
            transaction: txn.id,
            state: PS.PENDING,
          }));
        }

        // ────────────────────────────────────────────────────────────────
        case "PerformTransaction": {
          const paymeId = params.id as string;
          if (!paymeId) return res.json(err(rpcId, ERR.INVALID_REQ));

          const txn = await svc.findByProviderTxnId(Provider.PAYME, paymeId);
          if (!txn) return res.json(err(rpcId, ERR.TXN_NOT_FOUND));

          const creator = txn.subscription.plan.channel.creator;
          if (!creator.paymeKeyEnc || !svc.verifyPaymeAuth(req.headers.authorization, creator.paymeKeyEnc)) {
            return res.json(err(rpcId, ERR.AUTH_FAILED));
          }

          if (txn.state === TxnState.CANCELLED) {
            return res.json(err(rpcId, ERR.CANT_PERFORM));
          }

          // Idempotent: already paid
          if (txn.state === TxnState.PAID) {
            return res.json(ok(rpcId, {
              transaction: txn.id,
              perform_time: txn.paidAt!.getTime(),
              state: PS.PAID,
            }));
          }

          await svc.activateAfterPayment(txn.id);
          const updated = await svc.getTransaction(txn.id);

          return res.json(ok(rpcId, {
            transaction: txn.id,
            perform_time: updated!.paidAt!.getTime(),
            state: PS.PAID,
          }));
        }

        // ────────────────────────────────────────────────────────────────
        case "CancelTransaction": {
          const paymeId = params.id as string;
          const reason = Number(params.reason ?? 0);
          if (!paymeId) return res.json(err(rpcId, ERR.INVALID_REQ));

          const txn = await svc.findByProviderTxnId(Provider.PAYME, paymeId);
          if (!txn) return res.json(err(rpcId, ERR.TXN_NOT_FOUND));

          const creator = txn.subscription.plan.channel.creator;
          if (!creator.paymeKeyEnc || !svc.verifyPaymeAuth(req.headers.authorization, creator.paymeKeyEnc)) {
            return res.json(err(rpcId, ERR.AUTH_FAILED));
          }

          if (txn.state === TxnState.PAID) {
            return res.json(err(rpcId, ERR.CANT_PERFORM, "Already performed"));
          }

          // Idempotent: already cancelled
          if (txn.state === TxnState.CANCELLED) {
            return res.json(ok(rpcId, {
              transaction: txn.id,
              cancel_time: txn.cancelledAt!.getTime(),
              state: PS.CANCELLED_BEFORE,
            }));
          }

          const now = Date.now();
          await svc.cancelTransaction(txn.id, reason);

          return res.json(ok(rpcId, {
            transaction: txn.id,
            cancel_time: now,
            state: PS.CANCELLED_BEFORE,
          }));
        }

        // ────────────────────────────────────────────────────────────────
        case "CheckTransaction": {
          const paymeId = params.id as string;
          if (!paymeId) return res.json(err(rpcId, ERR.INVALID_REQ));

          const txn = await svc.findByProviderTxnId(Provider.PAYME, paymeId);
          if (!txn) return res.json(err(rpcId, ERR.TXN_NOT_FOUND));

          const creator = txn.subscription.plan.channel.creator;
          if (!creator.paymeKeyEnc || !svc.verifyPaymeAuth(req.headers.authorization, creator.paymeKeyEnc)) {
            return res.json(err(rpcId, ERR.AUTH_FAILED));
          }

          return res.json(ok(rpcId, {
            create_time:  txn.createdAt.getTime(),
            perform_time: txn.paidAt?.getTime() ?? 0,
            cancel_time:  txn.cancelledAt?.getTime() ?? 0,
            transaction:  txn.id,
            state:        toPaymeState(txn.state),
            reason:       txn.cancelReason ?? null,
          }));
        }

        // ────────────────────────────────────────────────────────────────
        case "GetStatement": {
          const fromMs = Number(params.from);
          const toMs   = Number(params.to);
          if (!fromMs || !toMs) return res.json(err(rpcId, ERR.INVALID_REQ));

          const txns = await svc.getStatementTransactions(req.headers.authorization, fromMs, toMs);
          if (txns === null) return res.json(err(rpcId, ERR.AUTH_FAILED));

          return res.json(ok(rpcId, {
            transactions: txns.map((t) => ({
              id:           t.id,
              time:         t.createdAt.getTime(),
              amount:       t.amountUzs * 100,
              account:      { order_id: t.id },
              create_time:  t.createdAt.getTime(),
              perform_time: t.paidAt?.getTime()      ?? 0,
              cancel_time:  t.cancelledAt?.getTime() ?? 0,
              transaction:  t.id,
              state:        toPaymeState(t.state),
              reason:       t.cancelReason ?? null,
            })),
          }));
        }

        default:
          return res.json(err(rpcId, ERR.METHOD_NOT_FOUND));
      }
    } catch (e) {
      logger.error({ err: e, method }, "Payme handler error");
      return res.json(err(rpcId, ERR.SYSTEM_ERROR));
    }
  });

  return router;
}
