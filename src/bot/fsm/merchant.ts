import { Bot, InlineKeyboard } from "grammy";
import { PrismaClient } from "@prisma/client";
import { MyContext } from "../types";
import { fsm, MerchantState, MerchantProvider } from "./state";
import { encrypt } from "../../lib/crypto";
import { logger } from "../../lib/logger";

// ── S-08: Try to delete the user's message containing a secret key ──────────
async function tryDeleteUserMsg(ctx: MyContext): Promise<void> {
  try {
    await ctx.api.deleteMessage(ctx.chat!.id, ctx.message!.message_id);
  } catch {
    // Private chats may not allow deletion; silently ignore
  }
}

// ── Prompts ──────────────────────────────────────────────────────────────────

async function askProvider(ctx: MyContext): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text("💳 Payme",   "fsm:mp:payme")
    .text("🟢 Click",   "fsm:mp:click")
    .row()
    .text("Ikkalasi",   "fsm:mp:both")
    .text("❌ Bekor",   "fsm:cancel");

  await ctx.reply(
    "💳 *Merchant sozlamalari*\n\nQaysi to'lov tizimini sozlaysiz?",
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
}

async function ask(ctx: MyContext, text: string): Promise<void> {
  await ctx.reply(text, { parse_mode: "Markdown" });
}

// ── Text message step handler ────────────────────────────────────────────────

export async function handleMerchantMessage(
  ctx: MyContext,
  state: MerchantState,
  db: PrismaClient
): Promise<void> {
  const text = ctx.message?.text?.trim() ?? "";
  const userId = ctx.from!.id;

  // S-08: delete user's message for sensitive key fields
  const sensitiveSteps: MerchantState["step"][] = [
    "payme_key", "click_secret", "payme_mid", "click_sid", "click_mid", "click_uid",
  ];
  if (sensitiveSteps.includes(state.step)) {
    await tryDeleteUserMsg(ctx);
  }

  switch (state.step) {
    case "payme_mid": {
      state.paymeMerchantId = text;
      state.step = "payme_key";
      fsm.set(userId, state);
      await ask(ctx, "🔑 Payme Secret Key ni yuboring:\n_⚠️ Xabar xavfsizlik uchun o'chiriladi._");
      break;
    }

    case "payme_key": {
      state.paymeKey = text;
      if (state.provider === "both") {
        state.step = "click_sid";
        fsm.set(userId, state);
        await ask(ctx, "🟢 Click Service ID ni yuboring:");
      } else {
        await saveMerchant(ctx, state, db);
      }
      break;
    }

    case "click_sid": {
      state.clickServiceId = text;
      state.step = "click_mid";
      fsm.set(userId, state);
      await ask(ctx, "🟢 Click Merchant ID ni yuboring:");
      break;
    }

    case "click_mid": {
      state.clickMerchantId = text;
      state.step = "click_uid";
      fsm.set(userId, state);
      await ask(ctx, "🟢 Click Merchant User ID (ixtiyoriy, /skip ni yuboring):");
      break;
    }

    case "click_uid": {
      state.clickUserId = text === "/skip" ? undefined : text;
      state.step = "click_secret";
      fsm.set(userId, state);
      await ask(ctx, "🔑 Click Secret Key ni yuboring:\n_⚠️ Xabar xavfsizlik uchun o'chiriladi._");
      break;
    }

    case "click_secret": {
      state.clickSecret = text;
      await saveMerchant(ctx, state, db);
      break;
    }

    default:
      break;
  }
}

// ── Save to DB ───────────────────────────────────────────────────────────────

async function saveMerchant(
  ctx: MyContext,
  state: MerchantState,
  db: PrismaClient
): Promise<void> {
  const userId = ctx.from!.id;
  fsm.del(userId);

  try {
    const data: Record<string, string | undefined> = {};
    if (state.paymeMerchantId) data.paymeMerchantId = state.paymeMerchantId;
    if (state.paymeKey)        data.paymeKeyEnc      = encrypt(state.paymeKey);
    if (state.clickServiceId)  data.clickServiceId   = state.clickServiceId;
    if (state.clickMerchantId) data.clickMerchantId  = state.clickMerchantId;
    if (state.clickUserId)     data.clickUserId       = state.clickUserId;
    if (state.clickSecret)     data.clickSecretEnc    = encrypt(state.clickSecret);

    await db.creator.update({
      where: { telegramId: BigInt(userId) },
      data,
    });

    const saved: string[] = [];
    if (state.paymeMerchantId || state.paymeKey) saved.push("💳 Payme");
    if (state.clickServiceId || state.clickSecret) saved.push("🟢 Click");

    await ctx.reply(
      `✅ Merchant ma'lumotlari saqlandi!\n\n${saved.join(" va ")} sozlamalari yangilandi.\n\n` +
        `Endi obunachilar to'lov qila oladi. Dashboard'da tekshiring: /dashboard`,
      { parse_mode: "Markdown" }
    );
  } catch (e) {
    logger.error({ err: e }, "merchant FSM save error");
    await ctx.reply("❌ Saqlashda xato. Qayta urinib ko'ring.");
  }
}

// ── Callback registration ────────────────────────────────────────────────────

export function registerMerchantCallbacks(
  bot: Bot<MyContext>,
  db: PrismaClient
): void {
  // Trigger: fsm:merchant
  bot.callbackQuery("fsm:merchant", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    fsm.set(ctx.from.id, { type: "merchant", step: "provider" });
    await askProvider(ctx);
  });

  // Provider selection
  bot.callbackQuery(/^fsm:mp:(payme|click|both)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    const provider = ctx.match[1] as MerchantProvider;

    const state: MerchantState = { type: "merchant", step: "provider", provider };
    const firstStep = provider === "click" ? "click_sid" : "payme_mid";
    state.step = firstStep;
    fsm.set(ctx.from.id, state);

    if (provider === "click") {
      await ask(ctx, "🟢 Click Service ID ni yuboring:");
    } else {
      await ask(ctx, "💳 Payme Merchant ID ni yuboring:");
    }
  });
}
