// Config for the generic entity CRUD router (server/src/routes/entities.routes.js).
// Most entities are single-owner: every row is scoped to req.user (user_id) transparently,
// so the client can never read/write another user's rows regardless of what it sends in a
// filter or payload. A few social entities (SharedFinancialData, ConnectionRequest,
// ChatMessage) legitimately need cross-user visibility, so they override buildWhere/canAccess.
// "accessor" is the Prisma client property name for the model (camelCase of the model name).

import { prisma } from '../lib/prisma.js';

function randomAnonymousId() {
  return 'USER-' + Math.random().toString(36).slice(2, 11).toUpperCase();
}

const transactionSchema = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    amount: { type: 'number', description: 'Valor positivo da transação' },
    type: { type: 'string', enum: ['income', 'expense'] },
    category: { type: 'string' },
    date: { type: 'string', description: 'Formato YYYY-MM-DD' },
    payment_method: { type: 'string', enum: ['cash', 'pix', 'debit', 'credit_card', 'food_voucher'] },
    source: { type: 'string', enum: ['manual', 'statement_import', 'credit_card'], description: 'Origem do lançamento (usada no filtro da tela de Transações)' },
    notes: { type: 'string' },
    is_food_voucher: { type: 'boolean' },
  },
  required: ['description', 'amount', 'type', 'date'],
};

const defaultOwned = {
  buildWhere(user, filter) {
    return { user_id: user.id, ...filter };
  },
  canAccess(row, user) {
    return row.user_id === user.id;
  },
  prepareCreate(data, user) {
    return { ...data, user_id: user.id, created_by: user.email };
  },
  prepareUpdate(data /*, user, existing */) {
    return data;
  },
};

function mergeExtra(baseWhere, filter) {
  if (!filter || Object.keys(filter).length === 0) return baseWhere;
  return { AND: [baseWhere, filter] };
}

// The plan's transaction_limit was previously only enforced client-side (trivially bypassable
// by calling the API directly). Enforce it here, driven by the actual SubscriptionPlan catalog
// row instead of a hardcoded number, so admin edits in SubscriptionAdmin.jsx take real effect.
export async function enforceTransactionLimit(user) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { plan_name: user.subscription_plan_name || 'free' } });
  const limit = plan ? plan.transaction_limit : 10;
  if (limit === -1 || limit === undefined || limit === null) return;
  const count = await prisma.transaction.count({ where: { user_id: user.id } });
  if (count >= limit) {
    const err = new Error(`Limite de ${limit} transações do plano "${user.subscription_plan_name}" atingido. Faça upgrade para continuar.`);
    err.status = 403;
    throw err;
  }
}

export const ENTITY_CONFIG = {
  Transaction: { accessor: 'transaction', schema: transactionSchema, ...defaultOwned, validateCreate: enforceTransactionLimit },
  TransactionCategory: { accessor: 'transactionCategory', ...defaultOwned },
  CreditCard: { accessor: 'creditCard', ...defaultOwned },
  CreditCardInvoice: { accessor: 'creditCardInvoice', ...defaultOwned },
  CreditCardTransaction: { accessor: 'creditCardTransaction', ...defaultOwned },
  Bill: { accessor: 'bill', ...defaultOwned },
  Crediario: { accessor: 'crediario', ...defaultOwned },
  Goal: { accessor: 'goal', ...defaultOwned },
  CategoryBudget: { accessor: 'categoryBudget', ...defaultOwned },
  SpendingSummary: { accessor: 'spendingSummary', ...defaultOwned },
  // Prisma gera o accessor a partir do nome do model preservando "AI" maiúsculo (aIConsultation,
  // não aiConsultation) — com o nome errado aqui, req.model virava undefined e toda chamada a
  // /api/entities/AIConsultation (histórico de consultoria de IA) quebrava com 500.
  AIConsultation: { accessor: 'aIConsultation', ...defaultOwned },
  NotificationSettings: { accessor: 'notificationSettings', ...defaultOwned },

  // --- Community / social entities: cross-user visibility, custom rules ---
  SharedFinancialData: {
    accessor: 'sharedFinancialData',
    buildWhere(user, filter) {
      return mergeExtra({ OR: [{ user_id: user.id }, { is_sharing: true }] }, filter);
    },
    canAccess(row, user) {
      return row.user_id === user.id;
    },
    prepareCreate(data, user) {
      return {
        ...data,
        user_id: user.id,
        created_by: user.email,
        anonymous_id: data.anonymous_id || randomAnonymousId(),
      };
    },
    prepareUpdate(data) {
      return data;
    },
  },
  ConnectionRequest: {
    accessor: 'connectionRequest',
    buildWhere(user, filter) {
      return mergeExtra({ OR: [{ from_user_id: user.id }, { to_user_id: user.id }] }, filter);
    },
    canAccess(row, user) {
      return row.from_user_id === user.id || row.to_user_id === user.id;
    },
    prepareCreate(data, user) {
      return { ...data, from_user_id: user.id, created_by: user.email };
    },
    prepareUpdate(data) {
      return data;
    },
  },
  ChatMessage: {
    accessor: 'chatMessage',
    buildWhere(user, filter) {
      return mergeExtra({ OR: [{ sender_id: user.id }, { receiver_id: user.id }] }, filter);
    },
    canAccess(row, user) {
      return row.sender_id === user.id || row.receiver_id === user.id;
    },
    prepareCreate(data, user) {
      return { ...data, sender_id: user.id, created_by: user.email };
    },
    prepareUpdate(data) {
      return data;
    },
  },
};

// Fields the client may never set directly — always derived from the session or immutable
// once a row exists (prevents a client from re-assigning a row to another user via PATCH).
export const SYSTEM_FIELDS = ['id', 'created_date', 'updated_date'];
export const OWNERSHIP_FIELDS = [
  'user_id',
  'created_by',
  'from_user_id',
  'to_user_id',
  'sender_id',
  'receiver_id',
];
