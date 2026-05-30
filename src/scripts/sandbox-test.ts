/**
 * Sandbox test: simulates Payme and Click webhook calls locally.
 * Run: npx ts-node src/scripts/sandbox-test.ts
 *
 * Requires:
 *  - DB has at least one Creator with paymeMerchantId + paymeKeyEnc + clickSecretEnc set
 *  - DB has at least one active Plan for that creator's channel
 */
import { config as dotenv } from "dotenv";
dotenv();

import { createHash } from "node:crypto";
import { PrismaClient, Provider, TxnState } from "@prisma/client";
import { encrypt, decrypt } from "../lib/crypto";

const prisma = new PrismaClient();
const BASE = `http://localhost:${process.env.PORT ?? 3000}`;

async function post(url: string, body: object, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  return res.json();
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function md5(s: string) {
  return createHash("md5").update(s).digest("hex");
}

function basicAuth(paymeKey: string) {
  return "Basic " + Buffer.from(`Paycom:${paymeKey}`).toString("base64");
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Find a creator with merchant credentials ──
  const creator = await prisma.creator.findFirst({
    where: {
      paymeMerchantId: { not: null },
      paymeKeyEnc:     { not: null },
    },
    include: {
      channels: {
        where: { isActive: true },
        include: { plans: { where: { isActive: true }, take: 1 } },
        take: 1,
      },
    },
  });

  if (!creator || !creator.channels[0]?.plans[0]) {
    console.error("❌ No creator with Payme credentials + active plan found in DB.");
    console.error("   Seed one manually or run the bot to create a channel+plan first.");
    return;
  }

  const plan = creator.channels[0].plans[0];
  const paymeKey = decrypt(creator.paymeKeyEnc!);
  const auth = basicAuth(paymeKey);

  console.log(`\n✅ Using creator ${creator.id}, plan "${plan.name}" (${plan.priceUzs} UZS)\n`);

  // ── Create a test subscriber + pending subscription + transaction ──
  let subscriber = await prisma.subscriber.upsert({
    where: { telegramId: 9999999999n },
    create: { telegramId: 9999999999n, username: "sandbox_user", firstName: "Sandbox" },
    update: {},
  });

  const sub = await prisma.subscription.create({
    data: {
      subscriberId: subscriber.id,
      planId:       plan.id,
      channelId:    plan.channelId,
      status:       "PENDING",
    },
  });

  const txn = await prisma.transaction.create({
    data: {
      subscriptionId: sub.id,
      provider:       Provider.PAYME,
      amountUzs:      plan.priceUzs,
      state:          TxnState.CREATED,
    },
  });

  const orderId = txn.id;
  const amountTiyin = plan.priceUzs * 100;

  console.log("── PAYME FLOW ───────────────────────────────────────");

  // 1. CheckPerformTransaction
  let r = await post(`${BASE}/payments/payme`, {
    jsonrpc: "2.0", id: 1,
    method: "CheckPerformTransaction",
    params: { amount: amountTiyin, account: { order_id: orderId } },
  }, { Authorization: auth });
  console.log("CheckPerformTransaction:", JSON.stringify(r));

  // 2. CreateTransaction
  const paymeId = `payme_test_${Date.now()}`;
  r = await post(`${BASE}/payments/payme`, {
    jsonrpc: "2.0", id: 2,
    method: "CreateTransaction",
    params: { id: paymeId, time: Date.now(), amount: amountTiyin, account: { order_id: orderId } },
  }, { Authorization: auth });
  console.log("CreateTransaction:", JSON.stringify(r));

  // 3. PerformTransaction
  r = await post(`${BASE}/payments/payme`, {
    jsonrpc: "2.0", id: 3,
    method: "PerformTransaction",
    params: { id: paymeId },
  }, { Authorization: auth });
  console.log("PerformTransaction:", JSON.stringify(r));

  // 4. CheckTransaction (verify state = 2)
  r = await post(`${BASE}/payments/payme`, {
    jsonrpc: "2.0", id: 4,
    method: "CheckTransaction",
    params: { id: paymeId },
  }, { Authorization: auth });
  console.log("CheckTransaction:", JSON.stringify(r));

  // 5. Idempotency: PerformTransaction again → same result
  r = await post(`${BASE}/payments/payme`, {
    jsonrpc: "2.0", id: 5,
    method: "PerformTransaction",
    params: { id: paymeId },
  }, { Authorization: auth });
  console.log("PerformTransaction (idempotent):", JSON.stringify(r));

  // ── Click flow (separate transaction) ──────────────────────────────
  const clickCreator = await prisma.creator.findFirst({
    where: { clickSecretEnc: { not: null }, clickServiceId: { not: null } },
    include: {
      channels: {
        where: { isActive: true },
        include: { plans: { where: { isActive: true }, take: 1 } },
        take: 1,
      },
    },
  });

  if (!clickCreator?.channels[0]?.plans[0] || !clickCreator.clickSecretEnc) {
    console.log("\n⚠️  No creator with Click credentials — skipping Click test");
  } else {
    const clickPlan = clickCreator.channels[0].plans[0];
    const clickSecret = decrypt(clickCreator.clickSecretEnc);
    const serviceId = clickCreator.clickServiceId!;

    const clickSub = await prisma.subscription.create({
      data: {
        subscriberId: subscriber.id,
        planId:       clickPlan.id,
        channelId:    clickPlan.channelId,
        status:       "PENDING",
      },
    });
    const clickTxn = await prisma.transaction.create({
      data: {
        subscriptionId: clickSub.id,
        provider:       Provider.CLICK,
        amountUzs:      clickPlan.priceUzs,
        state:          TxnState.CREATED,
      },
    });

    const cTransId = `12345`;
    const amount = String(clickPlan.priceUzs);
    const signTime = new Date().toISOString().slice(0, 19).replace("T", " ");

    console.log("\n── CLICK FLOW ───────────────────────────────────────");

    // Prepare
    const prepareSign = md5(cTransId + serviceId + clickSecret + clickTxn.id + amount + "0" + signTime);
    r = await postForm(`${BASE}/payments/click/prepare`, {
      click_trans_id:   cTransId,
      service_id:       serviceId,
      click_paydoc_id:  "67890",
      merchant_trans_id: clickTxn.id,
      amount,
      action:           "0",
      sign_time:        signTime,
      sign_string:      prepareSign,
    });
    console.log("Click prepare:", JSON.stringify(r));

    const merchantPrepareId = (r as any).merchant_prepare_id ?? clickTxn.id;

    // Complete
    const completeSign = md5(cTransId + serviceId + clickSecret + clickTxn.id + merchantPrepareId + amount + "1" + signTime);
    r = await postForm(`${BASE}/payments/click/complete`, {
      click_trans_id:    cTransId,
      service_id:        serviceId,
      click_paydoc_id:   "67890",
      merchant_trans_id: clickTxn.id,
      merchant_prepare_id: merchantPrepareId,
      amount,
      action:            "1",
      sign_time:         signTime,
      sign_string:       completeSign,
      error:             "0",
      error_note:        "Success",
    });
    console.log("Click complete:", JSON.stringify(r));
  }

  console.log("\n✅ Sandbox test done");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
