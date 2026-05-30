/**
 * Sets the Telegram webhook URL for the bot.
 * Run after deploy: npx ts-node scripts/set-webhook.ts
 *
 * Reads BOT_TOKEN and PUBLIC_URL from .env.production (or .env as fallback).
 */
import { Bot } from "grammy";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const root = resolve(__dirname, "..");
const prodEnv = resolve(root, ".env.production");
dotenvConfig({ path: existsSync(prodEnv) ? prodEnv : resolve(root, ".env") });

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL;

if (!BOT_TOKEN) {
  console.error("❌  BOT_TOKEN is not set");
  process.exit(1);
}
if (!PUBLIC_URL) {
  console.error("❌  PUBLIC_URL is not set");
  process.exit(1);
}

const webhookUrl = `${PUBLIC_URL}/bot/${BOT_TOKEN}`;

async function main(): Promise<void> {
  const bot = new Bot(BOT_TOKEN!);

  console.log(`Setting webhook → ${webhookUrl}`);

  await bot.api.setWebhook(webhookUrl, {
    allowed_updates: ["message", "callback_query", "my_chat_member", "chat_member"],
    drop_pending_updates: true,
  });

  const info = await bot.api.getWebhookInfo();
  console.log("✅  Webhook configured:");
  console.log(`    URL:             ${info.url}`);
  console.log(`    Pending updates: ${info.pending_update_count}`);
  if (info.last_error_message) {
    console.warn(`⚠️   Last error:      ${info.last_error_message}`);
    console.warn(`    (at ${new Date((info.last_error_date ?? 0) * 1000).toISOString()})`);
  }
}

main().catch((err) => {
  console.error("❌  Failed to set webhook:", err);
  process.exit(1);
});
