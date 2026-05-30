import { Bot } from "grammy";
import { MyContext } from "../types";
import { CreatorService } from "../../services/creator.service";
import { logger } from "../../lib/logger";

export function setupChannelAdminHandler(
  bot: Bot<MyContext>,
  creatorService: CreatorService
): void {
  bot.on("my_chat_member", async (ctx) => {
    const update = ctx.myChatMember;
    const { chat, from, new_chat_member, old_chat_member } = update;

    if (chat.type !== "channel") return;

    const isNowAdmin = new_chat_member.status === "administrator";
    const wasAdmin = old_chat_member.status === "administrator";

    if (isNowAdmin && !wasAdmin) {
      try {
        await creatorService.registerChannel(
          BigInt(from.id),
          BigInt(chat.id),
          chat.title ?? "Unnamed channel"
        );
        logger.info(
          { creatorId: from.id, channelId: chat.id, title: chat.title },
          "Channel registered"
        );
        await ctx.api.sendMessage(
          from.id,
          `✅ Kanal muvaffaqiyatli ulandi!\n\n` +
            `📺 Kanal: ${chat.title}\n` +
            `🆔 ID: ${chat.id}\n\n` +
            `Endi /creator buyrug'i orqali kanallaringizni boshqaring.`
        );
      } catch (err) {
        logger.error({ err, channelId: chat.id }, "Failed to register channel");
      }
      return;
    }

    const isNowRemoved =
      new_chat_member.status === "left" ||
      new_chat_member.status === "kicked" ||
      new_chat_member.status === "member";

    if (wasAdmin && isNowRemoved) {
      try {
        await creatorService.deactivateChannel(BigInt(chat.id));
        logger.info({ channelId: chat.id }, "Channel deactivated");
        await ctx.api.sendMessage(
          from.id,
          `⚠️ Bot "${chat.title}" kanalidan admin huquqlaridan mahrum qilindi.\n` +
            `Kanal o'chirildi. Qayta ulash uchun botni yana admin qilib qo'shing.`
        );
      } catch (err) {
        logger.error({ err, channelId: chat.id }, "Failed to deactivate channel");
      }
    }
  });
}
