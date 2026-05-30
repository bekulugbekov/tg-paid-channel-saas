-- AlterTable: add cancel tracking fields to Transaction
ALTER TABLE "Transaction"
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelReason" INTEGER;

-- DropIndex: replace regular index with unique constraint
DROP INDEX IF EXISTS "Transaction_provider_providerTxnId_idx";

-- CreateIndex: unique constraint for idempotency (NULLs are distinct in PostgreSQL)
CREATE UNIQUE INDEX "Transaction_provider_providerTxnId_key"
  ON "Transaction"("provider", "providerTxnId");
