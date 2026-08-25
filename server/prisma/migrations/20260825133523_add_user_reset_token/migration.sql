-- AlterTable
ALTER TABLE "User" ADD COLUMN "reset_token_expires" DATETIME;
ALTER TABLE "User" ADD COLUMN "reset_token_hash" TEXT;
