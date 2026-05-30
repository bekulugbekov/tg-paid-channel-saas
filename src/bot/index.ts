import { Bot } from "grammy";
import { PrismaClient } from "@prisma/client";
import { MyContext } from "./types";
import { CreatorService } from "../services/creator.service";
import { SubscriptionService } from "../services/subscription.service";
import { PaymentService } from "../services/payment.service";
import { setupStartCommand } from "./commands/start";
import { setupStatusCommand } from "./commands/status";
import { setupCreatorCommand } from "./commands/creator";
import { setupHelpCommand } from "./commands/help";
import { setupRenewCommand } from "./commands/renew";
import { setupTestSubCommand } from "./commands/test-sub";
import { setupDashboardCommand } from "./commands/dashboard";
import { setupChannelAdminHandler } from "./handlers/channel-admin";
import { setupSubscribeHandlers } from "./handlers/subscribe";
import { fsm } from "./fsm/state";
import { handlePlanMessage, registerPlanCallbacks } from "./fsm/plan";
import { handleMerchantMessage, registerMerchantCallbacks } from "./fsm/merchant";
import { logger } from "../lib/logger";

export interface BotServices {
  creatorService: CreatorService;
  subscriptionService: SubscriptionService;
  paymentService: PaymentService;
  db: PrismaClient;
}

export function registerHandlers(bot: Bot<MyContext>, services: BotServices): void {
  // ── Core commands ────────────────────────────────────────────────────────
  setupStartCommand(bot, services.paymentService);
  setupStatusCommand(bot, services.subscriptionService);
  setupCreatorCommand(bot, services.creatorService);
  setupHelpCommand(bot);
  setupRenewCommand(bot, services.subscriptionService);
  setupTestSubCommand(bot, services);
  setupDashboardCommand(bot, services.db);
  setupChannelAdminHandler(bot, services.creatorService);
  setupSubscribeHandlers(bot, services.paymentService);

  // ── FSM callbacks ────────────────────────────────────────────────────────
  registerPlanCallbacks(bot, services.db);
  registerMerchantCallbacks(bot, services.db);

  // Shared cancel callback for any active FSM
  bot.callbackQuery("fsm:cancel", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    fsm.del(ctx.from.id);
    await ctx.reply("❌ Bekor qilindi.");
  });

  // ── FSM text message handler ─────────────────────────────────────────────
  // Runs after command handlers; only activates when user has an FSM state.
  bot.on("message:text", async (ctx) => {
    if (!ctx.from) return;
    const userId = ctx.from.id;
    const state = fsm.get(userId);
    if (!state) return;

    const text = ctx.message.text.trim();

    // /cancel clears any active FSM
    if (text === "/cancel") {
      fsm.del(userId);
      await ctx.reply("❌ Bekor qilindi.");
      return;
    }

    // Other slash-commands pass through (let command handlers run); FSM persists
    if (text.startsWith("/") && text !== "/skip") return;

    if (state.type === "plan") {
      await handlePlanMessage(ctx, state, services.db);
    } else if (state.type === "merchant") {
      await handleMerchantMessage(ctx, state, services.db);
    }
  });

  bot.catch((err) => {
    logger.error({ err: err.error, update: err.ctx.update }, "Unhandled bot error");
  });
}
