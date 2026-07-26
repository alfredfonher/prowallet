-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "signature" TEXT,
    "blockSlot" INTEGER,
    "walletAddress" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "tokenAmount" DOUBLE PRECISION NOT NULL,
    "paymentAmount" DOUBLE PRECISION,
    "paymentToken" TEXT NOT NULL DEFAULT 'SOL',
    "tokenPrice" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "gasUsed" DOUBLE PRECISION,
    "gasCost" DOUBLE PRECISION,
    "error" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "minted" BOOLEAN NOT NULL DEFAULT false,
    "minting" BOOLEAN NOT NULL DEFAULT false,
    "mintSignature" TEXT,
    "mintStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3)
);

-- CreateIndex
CREATE INDEX "transactions_walletAddress_idx" ON "transactions"("walletAddress");
CREATE INDEX "transactions_transactionId_idx" ON "transactions"("transactionId");
CREATE UNIQUE INDEX "transactions_transactionId_key" ON "transactions"("transactionId");
CREATE INDEX "transactions_signature_idx" ON "transactions"("signature");
CREATE INDEX "transactions_blockSlot_idx" ON "transactions"("blockSlot");
CREATE INDEX "transactions_status_idx" ON "transactions"("status");
CREATE INDEX "transactions_minted_idx" ON "transactions"("minted");
CREATE INDEX "transactions_mintSignature_idx" ON "transactions"("mintSignature");
CREATE INDEX "transactions_completedAt_idx" ON "transactions"("completedAt");
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");
CREATE INDEX "transactions_transactionType_status_createdAt_idx" ON "transactions"("transactionType", "status", "createdAt");
CREATE INDEX "transactions_paymentToken_createdAt_idx" ON "transactions"("paymentToken", "createdAt");

-- CreateTable
CREATE TABLE "metadata_jobs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3)
);

-- CreateIndex
CREATE INDEX "metadata_jobs_transactionId_idx" ON "metadata_jobs"("transactionId");
CREATE INDEX "metadata_jobs_status_idx" ON "metadata_jobs"("status");
CREATE INDEX "metadata_jobs_jobType_idx" ON "metadata_jobs"("jobType");
CREATE INDEX "metadata_jobs_createdAt_idx" ON "metadata_jobs"("createdAt");
CREATE UNIQUE INDEX "metadata_jobs_jobId_key" ON "metadata_jobs"("jobId");

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "solanaPublicKey" TEXT,
    "tokenBalance" BIGINT NOT NULL DEFAULT 0,
    "usdSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "password" TEXT,
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "password_reset_token" TEXT,
    "password_reset_expires" TIMESTAMP(3)
);

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_solanaPublicKey_key" ON "users"("solanaPublicKey");
CREATE INDEX "users_is_email_verified_idx" ON "users"("is_email_verified");
CREATE INDEX "users_password_reset_token_idx" ON "users"("password_reset_token");

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3)
);

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens"("expires_at");
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3)
);

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
CREATE INDEX "refresh_tokens_revoked_at_idx" ON "refresh_tokens"("revoked_at");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateTable
CREATE TABLE "user_transactions" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "amountTokens" BIGINT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "priceAtTx" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "user_transactions_email_idx" ON "user_transactions"("email");
CREATE INDEX "user_transactions_type_idx" ON "user_transactions"("type");
CREATE INDEX "user_transactions_createdAt_idx" ON "user_transactions"("createdAt");

-- CreateTable
CREATE TABLE "user_transfers" (
    "id" SERIAL NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "amountTokens" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "user_transfers_fromEmail_idx" ON "user_transfers"("fromEmail");
CREATE INDEX "user_transfers_toEmail_idx" ON "user_transfers"("toEmail");
CREATE INDEX "user_transfers_createdAt_idx" ON "user_transfers"("createdAt");

-- CreateTable
CREATE TABLE "whitelist_entries" (
    "id" SERIAL NOT NULL,
    "wallet" TEXT NOT NULL,
    "addedBy" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'offchain'
);

-- CreateIndex
CREATE INDEX "whitelist_entries_wallet_idx" ON "whitelist_entries"("wallet");
CREATE INDEX "whitelist_entries_addedBy_idx" ON "whitelist_entries"("addedBy");
CREATE UNIQUE INDEX "whitelist_entries_wallet_key" ON "whitelist_entries"("wallet");

-- CreateTable
CREATE TABLE "saved_addresses" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "recipient_address" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "saved_addresses_wallet_address_idx" ON "saved_addresses"("wallet_address");
CREATE INDEX "saved_addresses_recipient_address_idx" ON "saved_addresses"("recipient_address");
CREATE INDEX "saved_addresses_is_favorite_idx" ON "saved_addresses"("is_favorite");
CREATE INDEX "saved_addresses_created_at_idx" ON "saved_addresses"("created_at");
CREATE UNIQUE INDEX "saved_addresses_wallet_address_recipient_address_key" ON "saved_addresses"("wallet_address", "recipient_address");

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_transactions" ADD CONSTRAINT "user_transactions_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_transfers" ADD CONSTRAINT "user_transfers_fromEmail_fkey" FOREIGN KEY ("fromEmail") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;
