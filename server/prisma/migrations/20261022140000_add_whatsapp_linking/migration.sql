-- AlterTable
ALTER TABLE "User" ADD COLUMN "whatsapp_lid" TEXT;
ALTER TABLE "User" ADD COLUMN "whatsapp_verified_at" DATETIME;
ALTER TABLE "User" ADD COLUMN "whatsapp_link_code" TEXT;
ALTER TABLE "User" ADD COLUMN "whatsapp_link_expires" DATETIME;
