import { Bot, InlineKeyboard } from "grammy";
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

    const keyboard = new InlineKeyboard();
    for (const ch of channels) {
      // encodeURIComponent so channel title is safe in callback data (max 64 bytes)
      const titleSlug = encodeURIComponent(ch.title).slice(0, 30);
      keyboard.text(`📦 ${ch.title}`, `fsm:plan:${ch.id}:${titleSlug}`).row();
    }
    keyboard.text("💳 Merchant sozlash", "fsm:merchant");

    const channelLines = channels
      .map((ch) => `• ${ch.title}  (\`${ch.telegramChannelId}\`)`)
      .join("\n");

    await ctx.reply(
      `🔧 Creator paneli\n\n` +
        `Ulangan kanallar (${channels.length}):\n${channelLines}\n\n` +
        `Quyidagi tugmalar orqali tarif yarating yoki to'lov sozlamalarini o'rnating:`,
      { parse_mode: "Markdown", reply_markup: keyboard }
    );
  });
}
