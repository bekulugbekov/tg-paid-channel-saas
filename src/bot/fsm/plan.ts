import { Bot, InlineKeyboard } from "grammy";
import { PrismaClient } from "@prisma/client";
import { MyContext } from "../types";
import { fsm, PlanState } from "./state";
import { SAAS_LIMITS } from "../../lib/saas-limits";
import { logger } from "../../lib/logger";

// ── Prompt helpers ──────────────────────────────────────────────────────────

async function askName(ctx: MyContext): Promise<void> {
  await ctx.reply(
    "📦 *Yangi tarif yaratish*\n\n*1/4* — Tarif nomini yuboring:\n_(Misol: 1 Oylik, VIP, Premium)_",
    { parse_mode: "Markdown" }
  );
}

async function askPrice(ctx: MyContext): Promise<void> {
  await ctx.reply(
    "*2/4* — Narxini so'mda yuboring (butun son):\n_(Misol: 50000)_",
    { parse_mode: "Markdown" }
  );
}

async function askDuration(ctx: MyContext): Promise<void> {
  await ctx.reply(
    "*3/4* — Necha kun davom etadi?\n_(Misol: 30)_",
    { parse_mode: "Markdown" }
  );
}

async function askDescription(ctx: MyContext): Promise<void> {
  await ctx.reply(
    "*4/4* — Tavsif (ixtiyoriy).\nO'tkazib yuborish uchun /skip yuboring.",
    { parse_mode: "Markdown" }
  );
}

async function showConfirm(ctx: MyContext, state: PlanState): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text("✅ Tasdiqlash", "fsm:confirm_plan")
    .text("❌ Bekor qilish", "fsm:cancel");

  await ctx.reply(
    `📋 *Tarif ma'lumotlari:*\n\n` +
      `📺 Kanal: ${state.channelTitle}\n` +
      `📦 Nom: ${state.name}\n` +
      `💰 Narx: ${state.priceUzs!.toLocaleString()} so'm\n` +
      `⏳ Davomiylik: ${state.durationDays} kun\n` +
      (state.description ? `📝 Tavsif: ${state.description}\n` : "") +
      `\nQayta tekshiring va tasdiqlang:`,
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
}

// ── Text message step handler ───────────────────────────────────────────────

export async function handlePlanMessage(
  ctx: MyContext,
  state: PlanState,
  db: PrismaClient
): Promise<void> {
  const text = ctx.message?.text?.trim() ?? "";
  const userId = ctx.from!.id;

  switch (state.step) {
    case "name": {
      if (text.length < 1 || text.length > 100) {
        await ctx.reply("❌ Nom 1-100 belgi bo'lishi kerak. Qayta yuboring:");
        return;
      }
      state.name = text;
      state.step = "price";
      fsm.set(userId, state);
      await askPrice(ctx);
      break;
    }

    case "price": {
      const price = parseInt(text.replace(/\s/g, ""), 10);
      if (isNaN(price) || price < 0 || price > 100_000_000) {
        await ctx.reply("❌ Narx noto'g'ri. Butun son kiriting (masalan: 50000):");
        return;
      }
      state.priceUzs = price;
      state.step = "duration";
      fsm.set(userId, state);
      await askDuration(ctx);
      break;
    }

    case "duration": {
      const days = parseInt(text, 10);
      if (isNaN(days) || days < 1 || days > 365) {
        await ctx.reply("❌ Kunlar 1-365 oralig'ida bo'lishi kerak:");
        return;
      }
      state.durationDays = days;
      state.step = "description";
      fsm.set(userId, state);
      await askDescription(ctx);
      break;
    }

    case "description": {
      state.description = text === "/skip" ? null : text.slice(0, 500);
      state.step = "confirm";
      fsm.set(userId, state);
      await showConfirm(ctx, state);
      break;
    }

    default:
      break;
  }
}

// ── Confirm callback ────────────────────────────────────────────────────────

export async function confirmPlan(
  ctx: MyContext,
  state: PlanState,
  db: PrismaClient
): Promise<void> {
  const userId = ctx.from!.id;
  fsm.del(userId);

  try {
    const creator = await db.creator.findUnique({
      where: { telegramId: BigInt(userId) },
      include: { _count: { select: { plans: { where: { isActive: true } } } } },
    });
    if (!creator) { await ctx.reply("❌ Creator topilmadi."); return; }

    const limit = SAAS_LIMITS[creator.saasPlan].plans;
    if (creator._count.plans >= limit) {
      await ctx.reply(
        `⛔ Tarif chekloviga yetdingiz!\n` +
          `${creator.saasPlan} tarifida maksimal *${limit}* ta tarif bo'lishi mumkin.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await db.plan.create({
      data: {
        channelId:    state.channelId,
        creatorId:    creator.id,
        name:         state.name!,
        priceUzs:     state.priceUzs!,
        durationDays: state.durationDays!,
        description:  state.description ?? undefined,
        isActive:     true,
      },
    });

    await ctx.reply(
      `✅ Tarif muvaffaqiyatli yaratildi!\n\n` +
        `📦 *${state.name}* — ${state.priceUzs!.toLocaleString()} so'm / ${state.durationDays} kun`,
      { parse_mode: "Markdown" }
    );
  } catch (e) {
    logger.error({ err: e }, "plan FSM confirm error");
    await ctx.reply("❌ Tarif yaratishda xato. Qayta urinib ko'ring.");
  }
}

// ── Callback registration ───────────────────────────────────────────────────

export function registerPlanCallbacks(
  bot: Bot<MyContext>,
  db: PrismaClient
): void {
  // Trigger: fsm:plan:<channelId>:<channelTitle>
  bot.callbackQuery(/^fsm:plan:([^:]+):(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    const [, channelId, channelTitle] = ctx.match;
    const state: PlanState = {
      type: "plan",
      step: "name",
      channelId,
      channelTitle: decodeURIComponent(channelTitle),
    };
    fsm.set(ctx.from.id, state);
    await askName(ctx);
  });

  bot.callbackQuery("fsm:confirm_plan", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    const state = fsm.get(ctx.from.id);
    if (!state || state.type !== "plan" || state.step !== "confirm") {
      await ctx.reply("❌ Holat topilmadi. /creator ni qayta bosing.");
      return;
    }
    await confirmPlan(ctx, state, db);
  });
}
