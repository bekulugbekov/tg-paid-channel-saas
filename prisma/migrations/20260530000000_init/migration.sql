-- CreateEnum
CREATE TYPE "SaasPlan" AS ENUM ('FREE', 'PRO', 'BUSINESS');
CREATE TYPE "SubStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE "Provider"  AS ENUM ('PAYME', 'CLICK');
CREATE TYPE "TxnState"  AS ENUM ('CREATED', 'PENDING', 'PAID', 'CANCELLED', 'FAILED');

-- CreateTable: Creator
CREATE TABLE "Creator" (
  "id"              TEXT         NOT NULL PRIMARY KEY,
  "telegramId"      BIGINT       NOT NULL UNIQUE,
  "firstName"       TEXT,
  "username"        TEXT,
  "email"           TEXT,
  "paymeMerchantId" TEXT,
  "paymeKeyEnc"     TEXT,
  "clickServiceId"  TEXT,
  "clickMerchantId" TEXT,
  "clickSecretEnc"  TEXT,
  "clickUserId"     TEXT,
  "saasPlan"        "SaasPlan"   NOT NULL DEFAULT 'FREE',
  "saasExpiresAt"   TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- CreateTable: Channel
CREATE TABLE "Channel" (
  "id"                TEXT        NOT NULL PRIMARY KEY,
  "creatorId"         TEXT        NOT NULL,
  "telegramChannelId" BIGINT      NOT NULL UNIQUE,
  "title"             TEXT        NOT NULL,
  "description"       TEXT,
  "isActive"          BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Channel_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id")
);

-- CreateTable: Plan
CREATE TABLE "Plan" (
  "id"           TEXT        NOT NULL PRIMARY KEY,
  "channelId"    TEXT        NOT NULL,
  "creatorId"    TEXT        NOT NULL,
  "name"         TEXT        NOT NULL,
  "priceUzs"     INTEGER     NOT NULL,
  "durationDays" INTEGER     NOT NULL,
  "description"  TEXT,
  "isActive"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Plan_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id"),
  CONSTRAINT "Plan_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id")
);

-- CreateTable: Subscriber
CREATE TABLE "Subscriber" (
  "id"         TEXT        NOT NULL PRIMARY KEY,
  "telegramId" BIGINT      NOT NULL UNIQUE,
  "username"   TEXT,
  "firstName"  TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CreateTable: Subscription
CREATE TABLE "Subscription" (
  "id"           TEXT        NOT NULL PRIMARY KEY,
  "subscriberId" TEXT        NOT NULL,
  "planId"       TEXT        NOT NULL,
  "channelId"    TEXT        NOT NULL,
  "status"       "SubStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt"    TIMESTAMPTZ,
  "expiresAt"    TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Subscription_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id"),
  CONSTRAINT "Subscription_planId_fkey"       FOREIGN KEY ("planId")       REFERENCES "Plan"("id"),
  CONSTRAINT "Subscription_channelId_fkey"    FOREIGN KEY ("channelId")    REFERENCES "Channel"("id")
);

-- CreateTable: Transaction
CREATE TABLE "Transaction" (
  "id"             TEXT        NOT NULL PRIMARY KEY,
  "subscriptionId" TEXT        NOT NULL,
  "provider"       "Provider"  NOT NULL,
  "providerTxnId"  TEXT,
  "amountUzs"      INTEGER     NOT NULL,
  "state"          "TxnState"  NOT NULL DEFAULT 'CREATED',
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "paidAt"         TIMESTAMPTZ,
  CONSTRAINT "Transaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
);
CREATE INDEX "Transaction_provider_providerTxnId_idx" ON "Transaction"("provider", "providerTxnId");

-- CreateTable: InviteLink
CREATE TABLE "InviteLink" (
  "id"             TEXT        NOT NULL PRIMARY KEY,
  "subscriptionId" TEXT        NOT NULL,
  "link"           TEXT        NOT NULL,
  "used"           BOOLEAN     NOT NULL DEFAULT FALSE,
  "expiresAt"      TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "InviteLink_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
);
