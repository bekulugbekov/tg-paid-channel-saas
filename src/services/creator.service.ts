import { PrismaClient, Channel, Creator } from "@prisma/client";
import { SAAS_LIMITS } from "../lib/saas-limits";

export class CreatorService {
  constructor(private readonly db: PrismaClient) {}

  async findOrCreate(
    telegramId: bigint,
    opts?: { username?: string; firstName?: string }
  ): Promise<Creator> {
    return this.db.creator.upsert({
      where: { telegramId },
      create: { telegramId, ...opts },
      update: {},
    });
  }

  async registerChannel(
    creatorTelegramId: bigint,
    channelTelegramId: bigint,
    title: string
  ): Promise<Channel> {
    const creator = await this.findOrCreate(creatorTelegramId);
    return this.db.channel.upsert({
      where: { telegramChannelId: channelTelegramId },
      create: {
        creatorId: creator.id,
        telegramChannelId: channelTelegramId,
        title,
        isActive: true,
      },
      update: {
        title,
        isActive: true,
        creatorId: creator.id,
      },
    });
  }

  async deactivateChannel(channelTelegramId: bigint): Promise<void> {
    await this.db.channel.updateMany({
      where: { telegramChannelId: channelTelegramId },
      data: { isActive: false },
    });
  }

  async getChannels(creatorTelegramId: bigint): Promise<Channel[]> {
    const creator = await this.db.creator.findUnique({
      where: { telegramId: creatorTelegramId },
      include: { channels: { where: { isActive: true } } },
    });
    return creator?.channels ?? [];
  }

  async findChannelByTelegramId(telegramChannelId: bigint): Promise<Channel | null> {
    return this.db.channel.findUnique({ where: { telegramChannelId } });
  }

  async canAddChannel(
    creatorTelegramId: bigint
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const creator = await this.db.creator.findUnique({
      where: { telegramId: creatorTelegramId },
      include: { _count: { select: { channels: { where: { isActive: true } } } } },
    });
    if (!creator) return { allowed: true, current: 0, limit: SAAS_LIMITS.FREE.channels };

    const limit = SAAS_LIMITS[creator.saasPlan].channels;
    const current = creator._count.channels;
    return { allowed: current < limit, current, limit };
  }
}
