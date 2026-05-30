import { PrismaClient, Channel, Creator } from "@prisma/client";

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
}
