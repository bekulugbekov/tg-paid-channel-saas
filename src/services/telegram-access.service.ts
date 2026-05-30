import { Api } from "grammy";
import { logger } from "../lib/logger";

export class TelegramAccessService {
  constructor(private readonly api: Api) {}

  async createInviteLink(channelId: bigint, expiresAt: Date): Promise<string> {
    const expireDate = Math.floor(expiresAt.getTime() / 1000);
    const result = await this.api.createChatInviteLink(Number(channelId), {
      member_limit: 1,
      expire_date: expireDate,
    });
    return result.invite_link;
  }

  async kickMember(channelId: bigint, userId: bigint): Promise<void> {
    const chatId = Number(channelId);
    const uid = Number(userId);
    await this.api.banChatMember(chatId, uid);
    // Immediately unban so the user can rejoin when they resubscribe
    await this.api.unbanChatMember(chatId, uid);
    logger.info({ chatId, userId: uid }, "Kicked member from channel");
  }
}
