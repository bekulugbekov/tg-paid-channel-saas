import { Bot } from "grammy";
import { MyContext } from "../types";
import { CreatorService } from "../../services/creator.service";

export function setupCreatorCommand(
  bot: Bot<MyContext>,
  creatorService: CreatorService
): void {
  bot.command("creator", async (ctx) => {
    if (!ctx.from) return;

    const channels = await creatorService.getChannels(BigInt(ctx.from.id));

    if (channels.length === 0) {
      await ctx.reply(
        `🔧 Creator paneli\n\n` +
          `Sizda hali ulangan kanal yo'q.\n\n` +
          `Kanal ulash qadamlari:\n` +
          `1. Kanalingizga kiring → Boshqarish → Adminlar\n` +
          `2. Botni admin qilib qo'shing\n` +
          `3. Huquqlar: "Foydalanuvchilarni taklif qilish" + "A'zolarni cheklash"\n\n` +
          `Bot qo'shilganda kanal avtomatik ro'yxatga olinadi ✅`
      );
      return;
    }

    const channelLines = channels
      .map((ch) => `• ${ch.title}\n  ID: \`${ch.telegramChannelId}\``)
      .join("\n\n");

    await ctx.reply(
      `🔧 Creator paneli\n\n` +
        `Ulangan kanallar (${channels.length}):\n\n${channelLines}\n\n` +
        `Test obuna yaratish: /testsub <channelId> <days>`,
      { parse_mode: "Markdown" }
    );
  });
}
