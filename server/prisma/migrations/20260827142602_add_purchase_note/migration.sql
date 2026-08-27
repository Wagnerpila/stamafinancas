-- CreateTable
CREATE TABLE "PurchaseNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "group_key" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "PurchaseNote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PurchaseNote_user_id_idx" ON "PurchaseNote"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseNote_user_id_card_id_group_key_key" ON "PurchaseNote"("user_id", "card_id", "group_key");
