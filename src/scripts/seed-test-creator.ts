/**
 * Seeds a test creator with Payme/Click sandbox credentials.
 * Run: npx ts-node src/scripts/seed-test-creator.ts
 *
 * SANDBOX keys — no real money used.
 */
import { config as dotenv } from "dotenv";
dotenv();

import { PrismaClient } from "@prisma/client";
import { encrypt } from "../lib/crypto";

const prisma = new PrismaClient();

// Payme SANDBOX merchant credentials
// These are Paycom's public test credentials — safe to commit.
const PAYME_SANDBOX_MERCHANT_ID = "5e730e8e0b852a417aa49ceb"; // public sandbox
const PAYME_SANDBOX_KEY = "TEST_KEY_REPLACE_ME"; // replace with your sandbox key

// Click sandbox credentials
const CLICK_SANDBOX_SERVICE_ID = "12345";
const CLICK_SANDBOX_MERCHANT_ID = "67890";
const CLICK_SANDBOX_SECRET = "TEST_SECRET_REPLACE_ME"; // replace with your sandbox secret

const CREATOR_TELEGRAM_ID = 123456789n; // replace with real Telegram ID

async function main() {
  // Creator
  const creator = await prisma.creator.upsert({
    where: { telegramId: CREATOR_TELEGRAM_ID },
    create: {
      telegramId:      CREATOR_TELEGRAM_ID,
      firstName:       "Test",
      username:        "test_creator",
      paymeMerchantId: PAYME_SANDBOX_MERCHANT_ID,
      paymeKeyEnc:     encrypt(PAYME_SANDBOX_KEY),
      clickServiceId:  CLICK_SANDBOX_SERVICE_ID,
      clickMerchantId: CLICK_SANDBOX_MERCHANT_ID,
      clickSecretEnc:  encrypt(CLICK_SANDBOX_SECRET),
    },
    update: {
      paymeMerchantId: PAYME_SANDBOX_MERCHANT_ID,
      paymeKeyEnc:     encrypt(PAYME_SANDBOX_KEY),
      clickServiceId:  CLICK_SANDBOX_SERVICE_ID,
      clickMerchantId: CLICK_SANDBOX_MERCHANT_ID,
      clickSecretEnc:  encrypt(CLICK_SANDBOX_SECRET),
    },
  });
  console.log("Creator:", creator.id);

  // Channel (telegram ID must match a real channel where the bot is admin)
  const CHANNEL_TELEGRAM_ID = -1001234567890n; // replace with real channel ID
  const channel = await prisma.channel.upsert({
    where: { telegramChannelId: CHANNEL_TELEGRAM_ID },
    create: {
      creatorId:         creator.id,
      telegramChannelId: CHANNEL_TELEGRAM_ID,
      title:             "Test Premium Kanal",
      isActive:          true,
    },
    update: { title: "Test Premium Kanal", isActive: true },
  });
  console.log("Channel:", channel.id, "TG ID:", channel.telegramChannelId.toString());

  // Plans
  const plan1 = await prisma.plan.upsert({
    where: { id: "plan-1-month" },
    create: {
      id:           "plan-1-month",
      channelId:    channel.id,
      creatorId:    creator.id,
      name:         "1 oy",
      priceUzs:     50000,
      durationDays: 30,
      isActive:     true,
    },
    update: { priceUzs: 50000, durationDays: 30, isActive: true },
  });

  const plan3 = await prisma.plan.upsert({
    where: { id: "plan-3-month" },
    create: {
      id:           "plan-3-month",
      channelId:    channel.id,
      creatorId:    creator.id,
      name:         "3 oy",
      priceUzs:     120000,
      durationDays: 90,
      isActive:     true,
    },
    update: { priceUzs: 120000, durationDays: 90, isActive: true },
  });

  console.log("Plans:", plan1.id, plan3.id);
  console.log("\n✅ Seed complete");
  console.log(`\nBot deep link: https://t.me/YourBotUsername?start=c_${CHANNEL_TELEGRAM_ID.toString().replace("-", "")}`);
  console.log("Note: Telegram deep links don't support minus sign directly. Use the channel's numeric ID.");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
