import { PrismaClient, Subscription, SubStatus } from "@prisma/client";
import { TelegramAccessService } from "./telegram-access.service";
import { logger } from "../lib/logger";

export interface ExpiredEntry {
  subscriberTelegramId: bigint;
  channelTitle: string;
}

export class SubscriptionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly telegramAccess: TelegramAccessService
  ) {}

  async createTestSubscription(params: {
    channelTelegramId: bigint;
    subscriberTelegramId: bigint;
    subscriberUsername?: string;
    subscriberFirstName?: string;
    durationDays: number;
  }): Promise<{ subscription: Subscription; inviteLink: string }> {
    const channel = await this.db.channel.findUnique({
      where: { telegramChannelId: params.channelTelegramId },
    });
    if (!channel) {
      throw new Error(`Channel ${params.channelTelegramId} topilmadi. Avval botni kanalga admin qilib qo'shing.`);
    }

    const subscriber = await this.db.subscriber.upsert({
      where: { telegramId: params.subscriberTelegramId },
      create: {
        telegramId: params.subscriberTelegramId,
        username: params.subscriberUsername,
        firstName: params.subscriberFirstName,
      },
      update: {},
    });

    // Use or create a reusable "Test" plan for this channel
    let plan = await this.db.plan.findFirst({
      where: { channelId: channel.id, name: "Test" },
    });
    if (!plan) {
      plan = await this.db.plan.create({
        data: {
          channelId: channel.id,
          creatorId: channel.creatorId,
          name: "Test",
          priceUzs: 0,
          durationDays: params.durationDays,
          isActive: true,
        },
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + params.durationDays * 24 * 60 * 60 * 1000);

    const subscription = await this.db.subscription.create({
      data: {
        subscriberId: subscriber.id,
        planId: plan.id,
        channelId: channel.id,
        status: SubStatus.ACTIVE,
        startedAt: now,
        expiresAt,
      },
    });

    const inviteLink = await this.telegramAccess.createInviteLink(
      channel.telegramChannelId,
      expiresAt
    );

    await this.db.inviteLink.create({
      data: { subscriptionId: subscription.id, link: inviteLink, expiresAt },
    });

    logger.info({ subscriptionId: subscription.id }, "Test subscription created");
    return { subscription, inviteLink };
  }

  async getActiveSubscriptions(subscriberTelegramId: bigint) {
    const subscriber = await this.db.subscriber.findUnique({
      where: { telegramId: subscriberTelegramId },
      include: {
        subscriptions: {
          where: { status: SubStatus.ACTIVE },
          include: { channel: true, plan: true },
          orderBy: { expiresAt: "asc" },
        },
      },
    });
    return subscriber?.subscriptions ?? [];
  }

  async expireSubscriptions(): Promise<ExpiredEntry[]> {
    const expired = await this.db.subscription.findMany({
      where: { status: SubStatus.ACTIVE, expiresAt: { lt: new Date() } },
      include: { channel: true, subscriber: true },
    });

    const notified: ExpiredEntry[] = [];

    for (const sub of expired) {
      try {
        await this.telegramAccess.kickMember(
          sub.channel.telegramChannelId,
          sub.subscriber.telegramId
        );
        await this.db.subscription.update({
          where: { id: sub.id },
          data: { status: SubStatus.EXPIRED },
        });
        notified.push({
          subscriberTelegramId: sub.subscriber.telegramId,
          channelTitle: sub.channel.title,
        });
        // Throttle to respect Telegram rate limits
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        logger.error({ err, subscriptionId: sub.id }, "Failed to expire subscription");
      }
    }

    return notified;
  }
}
