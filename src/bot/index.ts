import { Bot } from "grammy";
import { MyContext } from "./types";
import { CreatorService } from "../services/creator.service";
import { SubscriptionService } from "../services/subscription.service";
import { PaymentService } from "../services/payment.service";
import { setupStartCommand } from "./commands/start";
import { setupStatusCommand } from "./commands/status";
import { setupCreatorCommand } from "./commands/creator";
import { setupHelpCommand } from "./commands/help";
import { setupTestSubCommand } from "./commands/test-sub";
import { setupChannelAdminHandler } from "./handlers/channel-admin";
import { setupSubscribeHandlers } from "./handlers/subscribe";
import { logger } from "../lib/logger";

export interface BotServices {
  creatorService: CreatorService;
  subscriptionService: SubscriptionService;
  paymentService: PaymentService;
}

export function registerHandlers(bot: Bot<MyContext>, services: BotServices): void {
  setupStartCommand(bot, services.paymentService);
  setupStatusCommand(bot, services.subscriptionService);
  setupCreatorCommand(bot, services.creatorService);
  setupHelpCommand(bot);
  setupTestSubCommand(bot, services);
  setupChannelAdminHandler(bot, services.creatorService);
  setupSubscribeHandlers(bot, services.paymentService);

  bot.catch((err) => {
    logger.error({ err: err.error, update: err.ctx.update }, "Unhandled bot error");
  });
}
