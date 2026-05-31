import { PrismaClient, Provider, TxnState, SubStatus } from "@prisma/client";
import { Api } from "grammy";
import { createHash } from "node:crypto";
import { TelegramAccessService } from "./telegram-access.service";
import { decrypt } from "../lib/crypto";
import { logger } from "../lib/logger";

export class PaymentService {
  constructor(
    private readonly db: PrismaClient,
    private readonly botApi: Api,
    private readonly telegramAccess: TelegramAccessService
  ) {}

  async getChannelPlans(channelTelegramId: bigint) {
    return this.db.plan.findMany({
      where: { channel: { telegramChannelId: channelTelegramId }, isActive: true },
      include: { channel: true },
      orderBy: { priceUzs: "asc" },
    });
  }

  async createPendingSubscription(params: {
    subscriberTelegramId: bigint;
    planId: string;
    username?: string;
    firstName?: string;
  }) {
    const plan = await this.db.plan.findUnique({
      where: { id: params.planId },
      include: { channel: { include: { creator: true } } },
    });
    if (!plan || !plan.isActive) throw new Error("Plan topilmadi yoki faol emas");

    const subscriber = await this.db.subscriber.upsert({
      where: { telegramId: params.subscriberTelegramId },
      create: {
        telegramId: params.subscriberTelegramId,
        username: params.username,
        firstName: params.firstName,
      },
      update: {},
    });

    const subscription = await this.db.subscription.create({
      data: {
        subscriberId: subscriber.id,
        planId: plan.id,
        channelId: plan.channelId,
        status: SubStatus.PENDING,
      },
    });

    return { subscription, plan };
  }

  async createOrGetTransaction(subscriptionId: string, provider: Provider) {
    const existing = await this.db.transaction.findFirst({
      where: {
        subscriptionId,
        provider,
        state: { notIn: [TxnState.CANCELLED, TxnState.FAILED] },
      },
    });
    if (existing) return existing;

    const subscription = await this.db.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });
    if (!subscription) throw new Error("Subscription topilmadi");

    return this.db.transaction.create({
      data: {
        subscriptionId,
        provider,
        amountUzs: subscription.plan.priceUzs,
        state: TxnState.CREATED,
      },
    });
  }

  async buildPayUrl(transactionId: string, provider: Provider): Promise<string> {
    const txn = await this.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        subscription: {
          include: { plan: { include: { channel: { include: { creator: true } } } } },
        },
      },
    });
    if (!txn) throw new Error("Transaction topilmadi");

    const creator = txn.subscription.plan.channel.creator;

    if (provider === Provider.PAYME) {
      if (!creator.paymeMerchantId) throw new Error("Creator Payme merchant ID kiritilmagan");
      const params = `m=${creator.paymeMerchantId}&ac.order_id=${transactionId}&a=${txn.amountUzs * 100}`;
      return `https://checkout.paycom.uz/${Buffer.from(params).toString("base64")}`;
    }

    if (!creator.clickServiceId || !creator.clickMerchantId) {
      throw new Error("Creator Click ma'lumotlari kiritilmagan");
    }
    const qs = new URLSearchParams({
      service_id: creator.clickServiceId,
      merchant_id: creator.clickMerchantId,
      amount: String(txn.amountUzs),
      transaction_param: transactionId,
    });
    if (creator.clickUserId) qs.set("merchant_user_id", creator.clickUserId);
    return `https://my.click.uz/services/pay?${qs.toString()}`;
  }

  async getSubscriptionWithPlan(subscriptionId: string) {
    return this.db.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, subscriber: true },
    });
  }

  async getTransaction(transactionId: string) {
    return this.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        subscription: {
          include: {
            subscriber: true,
            plan: { include: { channel: { include: { creator: true } } } },
          },
        },
      },
    });
  }

  async findByProviderTxnId(provider: Provider, providerTxnId: string) {
    return this.db.transaction.findFirst({
      where: { provider, providerTxnId },
      include: {
        subscription: {
          include: {
            subscriber: true,
            plan: { include: { channel: { include: { creator: true } } } },
          },
        },
      },
    });
  }

  async markTransactionPending(transactionId: string, providerTxnId: string): Promise<void> {
    await this.db.transaction.update({
      where: { id: transactionId },
      data: { state: TxnState.PENDING, providerTxnId },
    });
  }

  async activateAfterPayment(transactionId: string): Promise<void> {
    const txn = await this.getTransaction(transactionId);
    if (!txn) throw new Error("Transaction topilmadi");

    if (txn.state === TxnState.PAID) {
      logger.info({ transactionId }, "Already PAID — idempotent skip");
      return;
    }

    const now = new Date();
    const durationDays = txn.subscription.plan.durationDays;

    // If subscriber already has an ACTIVE sub for this channel (renewal case),
    // start the new period from that sub's end date so time isn't wasted.
    const existingActive = await this.db.subscription.findFirst({
      where: {
        channelId: txn.subscription.channelId,
        subscriberId: txn.subscription.subscriberId,
        status: SubStatus.ACTIVE,
        id: { not: txn.subscriptionId },
      },
      orderBy: { expiresAt: "desc" },
    });
    const base = existingActive?.expiresAt && existingActive.expiresAt > now
      ? existingActive.expiresAt
      : now;
    const expiresAt = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await this.db.$transaction([
      this.db.transaction.update({
        where: { id: transactionId },
        data: { state: TxnState.PAID, paidAt: now },
      }),
      this.db.subscription.update({
        where: { id: txn.subscriptionId },
        data: { status: SubStatus.ACTIVE, startedAt: now, expiresAt },
      }),
    ]);

    // Idempotency guard: only send invite once
    const existingLink = await this.db.inviteLink.findFirst({
      where: { subscriptionId: txn.subscriptionId },
    });
    if (existingLink) {
      logger.info({ transactionId }, "Invite link already exists — skip resend");
      return;
    }

    const link = await this.telegramAccess.createInviteLink(
      txn.subscription.plan.channel.telegramChannelId,
      expiresAt
    );
    await this.db.inviteLink.create({
      data: { subscriptionId: txn.subscriptionId, link, expiresAt },
    });

    logger.info({ transactionId, subscriptionId: txn.subscriptionId }, "Payment activated");

    // Non-fatal: user might not have started the bot yet
    try {
      await this.botApi.sendMessage(
        Number(txn.subscription.subscriber.telegramId),
        `✅ To'lov qabul qilindi!\n\n🔗 Kirish havolasi:\n${link}\n\n` +
          `⏳ Obuna ${durationDays} kun davomida amal qiladi.\n` +
          `Havola bir martalik — faqat siz uchun.`
      );
    } catch (e) {
      logger.error({ err: e, transactionId }, "Invite link send failed — user may not have started bot");
    }
  }

  async getStatementTransactions(
    authHeader: string | undefined,
    fromMs: number,
    toMs: number,
    urlCreatorId?: string
  ) {
    const creators = await this.db.creator.findMany({
      where: { paymeKeyEnc: { not: null }, ...(urlCreatorId ? { id: urlCreatorId } : {}) },
      select: { id: true, paymeKeyEnc: true },
    });

    let creatorId: string | null = null;
    for (const c of creators) {
      if (c.paymeKeyEnc && this.verifyPaymeAuth(authHeader, c.paymeKeyEnc)) {
        creatorId = c.id;
        break;
      }
    }
    if (!creatorId) return null;

    return this.db.transaction.findMany({
      where: {
        provider: "PAYME" as const,
        createdAt: { gte: new Date(fromMs), lte: new Date(toMs) },
        subscription: { plan: { channel: { creatorId } } },
      },
    });
  }

  async cancelTransaction(transactionId: string, cancelReason: number): Promise<void> {
    const txn = await this.db.transaction.findUnique({ where: { id: transactionId } });
    if (!txn || txn.state === TxnState.CANCELLED) return; // idempotent

    await this.db.transaction.update({
      where: { id: transactionId },
      data: { state: TxnState.CANCELLED, cancelledAt: new Date(), cancelReason },
    });
  }

  verifyPaymeAuth(authHeader: string | undefined, paymeKeyEnc: string): boolean {
    if (!authHeader?.startsWith("Basic ")) return false;
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx < 0) return false;
    const key = decoded.slice(colonIdx + 1);
    try {
      return key === decrypt(paymeKeyEnc);
    } catch {
      return false;
    }
  }

  buildClickSign(parts: string[]): string {
    return createHash("md5").update(parts.join("")).digest("hex");
  }
}
