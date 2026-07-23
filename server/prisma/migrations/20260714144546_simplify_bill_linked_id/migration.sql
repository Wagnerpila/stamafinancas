/*
  Warnings:

  - You are about to drop the column `recurring_parent_id` on the `Bill` table. All the data in the column will be lost.
  - You are about to drop the column `source_invoice_id` on the `Bill` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "due_date" DATETIME NOT NULL,
    "paid_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recurrence" TEXT NOT NULL DEFAULT 'none',
    "notes" TEXT,
    "is_food_voucher" BOOLEAN NOT NULL DEFAULT false,
    "card_id" TEXT,
    "linked_bill_id" TEXT,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "Bill_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Bill" ("amount", "card_id", "category", "created_by", "created_date", "description", "due_date", "id", "is_food_voucher", "notes", "paid_date", "recurrence", "status", "title", "type", "updated_date", "user_id") SELECT "amount", "card_id", "category", "created_by", "created_date", "description", "due_date", "id", "is_food_voucher", "notes", "paid_date", "recurrence", "status", "title", "type", "updated_date", "user_id" FROM "Bill";
DROP TABLE "Bill";
ALTER TABLE "new_Bill" RENAME TO "Bill";
CREATE INDEX "Bill_user_id_idx" ON "Bill"("user_id");
CREATE INDEX "Bill_user_id_due_date_idx" ON "Bill"("user_id", "due_date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
