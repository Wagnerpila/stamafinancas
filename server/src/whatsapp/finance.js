// Consultas financeiras usadas pelo bot do WhatsApp (respostas a perguntas e avisos proativos).
// Os números precisam bater com o que o usuário vê no app, então as regras abaixo replicam as do
// frontend: gastos por categoria = CategorySpendingCompact.jsx, contas do mês = billRecurrence.js.

import { prisma } from '../lib/prisma.js';
import { addDays, addMonths, fromDbDate, monthStart, toDbDate } from './dates.js';

// Mesmo mapa de slugs do enum antigo usado no frontend (CategorySpendingCompact.jsx).
const ENUM_LABELS = {
  food: 'Alimentação',
  transport: 'Transporte',
  health: 'Saúde',
  education: 'Educação',
  entertainment: 'Lazer',
  shopping: 'Compras',
  bills: 'Contas',
  rent: 'Aluguel',
  other_expense: 'Outras Despesas',
};

const COMBINING_DIACRITICS = new RegExp(
  '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
  'g'
);

export function normalizeText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveCategoryName(raw) {
  if (!raw) return 'Outros';
  return ENUM_LABELS[raw] || raw;
}

// Gastos do período [start, endExclusive). Compras de cartão contam pela data da compra; as
// Transaction geradas ao pagar uma fatura (invoice_id) ficam de fora pra não contar duas vezes, e
// vale-alimentação também fica de fora — mesmas exclusões do dashboard.
export async function getExpenseItems(userId, start, endExclusive) {
  const range = { gte: toDbDate(start), lt: toDbDate(endExclusive) };
  const [transactions, cardTxs, cards] = await Promise.all([
    prisma.transaction.findMany({
      where: { user_id: userId, type: 'expense', is_food_voucher: false, invoice_id: null, date: range },
    }),
    prisma.creditCardTransaction.findMany({ where: { user_id: userId, purchase_date: range } }),
    prisma.creditCard.findMany({ where: { user_id: userId } }),
  ]);
  const cardNames = Object.fromEntries(cards.map((c) => [c.id, c.name]));

  return [
    ...transactions.map((t) => ({
      description: t.description,
      amount: Math.abs(t.amount),
      date: fromDbDate(t.date),
      category: resolveCategoryName(t.category),
      source: 'transaction',
    })),
    ...cardTxs.map((t) => ({
      description: t.description,
      amount: Math.abs(t.amount),
      date: fromDbDate(t.purchase_date),
      category: resolveCategoryName(t.category),
      source: 'card',
      card_id: t.card_id,
      card_name: cardNames[t.card_id] || 'Cartão',
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getIncomeItems(userId, start, endExclusive) {
  const transactions = await prisma.transaction.findMany({
    where: {
      user_id: userId,
      type: 'income',
      is_food_voucher: false,
      date: { gte: toDbDate(start), lt: toDbDate(endExclusive) },
    },
    orderBy: { date: 'desc' },
  });
  return transactions.map((t) => ({
    description: t.description,
    amount: Math.abs(t.amount),
    date: fromDbDate(t.date),
    category: resolveCategoryName(t.category),
  }));
}

export function groupByCategory(items) {
  const totals = {};
  for (const item of items) totals[item.category] = (totals[item.category] || 0) + item.amount;
  return Object.entries(totals)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

export async function periodSummary(userId, start, endInclusive) {
  const endExclusive = addDays(endInclusive, 1);
  const [expenses, incomes] = await Promise.all([
    getExpenseItems(userId, start, endExclusive),
    getIncomeItems(userId, start, endExclusive),
  ]);
  const expense = expenses.reduce((s, i) => s + i.amount, 0);
  const income = incomes.reduce((s, i) => s + i.amount, 0);
  return {
    expenses,
    incomes,
    expense,
    income,
    balance: income - expense,
    byCategory: groupByCategory(expenses),
  };
}

// Contas a pagar/receber de um mês, com as recorrentes projetadas para ele — mesma regra de
// billAppearsInMonth/buildVirtualBill (src/components/lib/billRecurrence.js): a recorrente
// original pendente aparece todo mês a partir da origem, a menos que aquele mês já tenha uma
// cópia própria (paga ou editada), que então aparece no lugar dela.
export async function billsForMonth(userId, refDateStr) {
  const start = monthStart(refDateStr);
  const end = addMonths(refDateStr, 1);
  const bills = await prisma.bill.findMany({ where: { user_id: userId } });

  const overridden = new Set();
  for (const b of bills) {
    const due = fromDbDate(b.due_date);
    if ((!b.recurrence || b.recurrence === 'none') && b.linked_bill_id && due >= start && due < end) {
      overridden.add(b.linked_bill_id);
    }
  }

  const result = [];
  for (const b of bills) {
    const due = fromDbDate(b.due_date);
    const recurring = b.recurrence && b.recurrence !== 'none' && b.status !== 'paid';

    if (recurring) {
      if (overridden.has(b.id) || start < monthStart(due)) continue;
      const diffMonths =
        (Number(start.slice(0, 4)) - Number(due.slice(0, 4))) * 12 + Number(start.slice(5, 7)) - Number(due.slice(5, 7));
      if (b.recurrence === 'quarterly' && diffMonths % 3 !== 0) continue;
      if (b.recurrence === 'yearly' && diffMonths % 12 !== 0) continue;
      const lastDay = Number(addDays(end, -1).slice(8, 10));
      const day = String(Math.min(Number(due.slice(8, 10)), lastDay)).padStart(2, '0');
      result.push({ ...b, due: start.slice(0, 8) + day, recurring: true, paid: false });
      continue;
    }

    if (due >= start && due < end) {
      result.push({ ...b, due, recurring: false, paid: b.status === 'paid' });
    }
  }
  return result.sort((a, b) => a.due.localeCompare(b.due));
}

// Contas avulsas pendentes com vencimento anterior ao mês de referência (atrasadas "esquecidas").
export async function overdueBillsBefore(userId, refDateStr) {
  const bills = await prisma.bill.findMany({
    where: {
      user_id: userId,
      status: { not: 'paid' },
      recurrence: 'none',
      due_date: { lt: toDbDate(monthStart(refDateStr)) },
    },
    orderBy: { due_date: 'asc' },
  });
  return bills.map((b) => ({ ...b, due: fromDbDate(b.due_date), recurring: false, paid: false }));
}
