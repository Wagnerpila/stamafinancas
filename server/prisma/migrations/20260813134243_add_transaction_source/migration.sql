-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "credit_card_id" TEXT,
    "invoice_id" TEXT,
    "notes" TEXT,
    "is_food_voucher" BOOLEAN NOT NULL DEFAULT false,
    "linked_bill_id" TEXT,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "category", "created_by", "created_date", "credit_card_id", "date", "description", "id", "invoice_id", "is_food_voucher", "linked_bill_id", "notes", "payment_method", "type", "updated_date", "user_id") SELECT "amount", "category", "created_by", "created_date", "credit_card_id", "date", "description", "id", "invoice_id", "is_food_voucher", "linked_bill_id", "notes", "payment_method", "type", "updated_date", "user_id" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_user_id_idx" ON "Transaction"("user_id");
CREATE INDEX "Transaction_user_id_date_idx" ON "Transaction"("user_id", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
