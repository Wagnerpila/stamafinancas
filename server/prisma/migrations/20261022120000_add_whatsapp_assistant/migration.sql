-- AlterTable
ALTER TABLE "NotificationSettings" ADD COLUMN "whatsapp_last_digest" TEXT;
ALTER TABLE "NotificationSettings" ADD COLUMN "whatsapp_last_weekly" TEXT;

-- CreateTable
CREATE TABLE "CategoryRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "CategoryRule_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CategoryRule_user_id_idx" ON "CategoryRule"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryRule_user_id_keyword_type_key" ON "CategoryRule"("user_id", "keyword", "type");
