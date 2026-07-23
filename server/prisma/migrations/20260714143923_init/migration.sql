-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "whatsapp_number" TEXT,
    "monthly_budget" REAL,
    "food_voucher_balance" REAL,
    "subscription_plan_name" TEXT NOT NULL DEFAULT 'free',
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TransactionCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📦',
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "TransactionCategory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "credit_card_id" TEXT,
    "invoice_id" TEXT,
    "notes" TEXT,
    "is_food_voucher" BOOLEAN NOT NULL DEFAULT false,
    "linked_bill_id" TEXT,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "last_digits" TEXT,
    "limit" REAL,
    "closing_day" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "color_index" INTEGER NOT NULL DEFAULT 0,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "CreditCard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditCardInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "reference_month" TEXT NOT NULL,
    "closing_date" DATETIME NOT NULL,
    "due_date" DATETIME NOT NULL,
    "total_amount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "paid_amount" REAL,
    "paid_date" DATETIME,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "CreditCardInvoice_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreditCardInvoice_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "CreditCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditCardTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "category" TEXT,
    "purchase_date" DATETIME NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "installment_number" INTEGER NOT NULL DEFAULT 1,
    "invoice_id" TEXT,
    "notes" TEXT,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "CreditCardTransaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreditCardTransaction_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "CreditCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bill" (
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
    "source_invoice_id" TEXT,
    "recurring_parent_id" TEXT,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "Bill_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Crediario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "description" TEXT,
    "total_amount" REAL NOT NULL,
    "installments" INTEGER NOT NULL,
    "installment_amount" REAL NOT NULL,
    "first_due_date" DATETIME NOT NULL,
    "notes" TEXT,
    "paid_installments" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "Crediario_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "target_amount" REAL NOT NULL,
    "current_amount" REAL NOT NULL DEFAULT 0,
    "target_date" DATETIME NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "monthly_contribution" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "Goal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategoryBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "monthly_limit" REAL NOT NULL,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "CategoryBudget_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpendingSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "reference_month" TEXT NOT NULL,
    "total_income" REAL NOT NULL,
    "total_expense" REAL NOT NULL,
    "balance" REAL NOT NULL,
    "savings_rate" REAL NOT NULL,
    "top_category" TEXT,
    "top_category_amount" REAL,
    "ai_insights" TEXT,
    "savings_tips" TEXT,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "SpendingSummary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIConsultation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "AIConsultation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "bills_due_days" INTEGER NOT NULL DEFAULT 3,
    "overdue_reminders" BOOLEAN NOT NULL DEFAULT true,
    "goals_progress" BOOLEAN NOT NULL DEFAULT true,
    "weekly_summary" BOOLEAN NOT NULL DEFAULT true,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "NotificationSettings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_by" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "features" TEXT NOT NULL,
    "pricing" TEXT NOT NULL,
    "transaction_limit" INTEGER NOT NULL DEFAULT -1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SharedFinancialData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "anonymous_id" TEXT NOT NULL,
    "display_number" INTEGER,
    "avatar_url" TEXT,
    "is_sharing" BOOLEAN NOT NULL DEFAULT false,
    "total_income" REAL NOT NULL DEFAULT 0,
    "total_expense" REAL NOT NULL DEFAULT 0,
    "monthly_average_expense" REAL NOT NULL DEFAULT 0,
    "savings_rate" REAL NOT NULL DEFAULT 0,
    "category_spending" TEXT NOT NULL DEFAULT '{}',
    "months_tracked" INTEGER NOT NULL DEFAULT 0,
    "financial_evolution" TEXT NOT NULL DEFAULT '[]',
    "last_updated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "SharedFinancialData_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConnectionRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_by" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "from_anonymous_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "to_anonymous_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "ConnectionRequest_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConnectionRequest_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_by" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_anonymous_id" TEXT,
    "receiver_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" DATETIME NOT NULL,
    CONSTRAINT "ChatMessage_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "ConnectionRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCategory_user_id_name_type_key" ON "TransactionCategory"("user_id", "name", "type");

-- CreateIndex
CREATE INDEX "Transaction_user_id_idx" ON "Transaction"("user_id");

-- CreateIndex
CREATE INDEX "Transaction_user_id_date_idx" ON "Transaction"("user_id", "date");

-- CreateIndex
CREATE INDEX "CreditCard_user_id_idx" ON "CreditCard"("user_id");

-- CreateIndex
CREATE INDEX "CreditCardInvoice_user_id_idx" ON "CreditCardInvoice"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardInvoice_card_id_reference_month_key" ON "CreditCardInvoice"("card_id", "reference_month");

-- CreateIndex
CREATE INDEX "CreditCardTransaction_user_id_idx" ON "CreditCardTransaction"("user_id");

-- CreateIndex
CREATE INDEX "CreditCardTransaction_card_id_idx" ON "CreditCardTransaction"("card_id");

-- CreateIndex
CREATE INDEX "Bill_user_id_idx" ON "Bill"("user_id");

-- CreateIndex
CREATE INDEX "Bill_user_id_due_date_idx" ON "Bill"("user_id", "due_date");

-- CreateIndex
CREATE INDEX "Crediario_user_id_idx" ON "Crediario"("user_id");

-- CreateIndex
CREATE INDEX "Goal_user_id_idx" ON "Goal"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryBudget_user_id_category_key" ON "CategoryBudget"("user_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "SpendingSummary_user_id_reference_month_key" ON "SpendingSummary"("user_id", "reference_month");

-- CreateIndex
CREATE INDEX "AIConsultation_user_id_idx" ON "AIConsultation"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_user_id_key" ON "NotificationSettings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_plan_name_key" ON "SubscriptionPlan"("plan_name");

-- CreateIndex
CREATE UNIQUE INDEX "SharedFinancialData_user_id_key" ON "SharedFinancialData"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "SharedFinancialData_anonymous_id_key" ON "SharedFinancialData"("anonymous_id");

-- CreateIndex
CREATE INDEX "ConnectionRequest_from_user_id_idx" ON "ConnectionRequest"("from_user_id");

-- CreateIndex
CREATE INDEX "ConnectionRequest_to_user_id_idx" ON "ConnectionRequest"("to_user_id");

-- CreateIndex
CREATE INDEX "ChatMessage_connection_id_idx" ON "ChatMessage"("connection_id");
