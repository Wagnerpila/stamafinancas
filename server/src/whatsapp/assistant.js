// Assistente conversacional do bot do WhatsApp: entende mensagens livres (texto ou áudio já
// transcrito) — registrar gastos/receitas, compras no cartão, perguntas sobre os dados, correção
// do último lançamento, contas a pagar — e executa no banco. A IA só interpreta (ver
// assistantIntentSchema); totais e gravações são feitos aqui, com as mesmas regras do app.

import { prisma } from '../lib/prisma.js';
import { enforceTransactionLimit } from '../services/entityConfig.js';
import { reconcilePendingBill } from '../services/billReconciliation.js';
import { assistantIntentSchema, assistantSystemPrompt } from '../services/ai/prompts.js';
import { getConversation, remember, setLastAction, setPending, takePending } from './conversation.js';
import { completeTaskByTitle, createTask, describeTask, listTasksMessage, openTasks } from './tasks.js';
import {
  billsForMonth,
  getExpenseItems,
  normalizeText,
  overdueBillsBefore,
  periodSummary,
} from './finance.js';
import {
  addDays,
  addMonths,
  describePeriod,
  formatDateBR,
  formatShortBR,
  isDateStr,
  lastDayOfMonth,
  monthStart,
  nowTimeStr,
  toDbDate,
  todayStr,
} from './dates.js';

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const PAYMENT_LABELS = { cash: 'Dinheiro', pix: 'Pix', debit: 'Débito', credit_card: 'Cartão de crédito', food_voucher: 'Vale-alimentação' };

const YES = /^(sim|s|pode|confirmo|confirma|ok|okay|isso|claro|beleza|blz|manda|yes)\b/i;
const NO = /^(n[aã]o|n|cancela|cancelar|deixa|esquece|no)\b/i;

export const HELP_TEXT =
  'Oi! Eu sou o *Stama*, seu assistente financeiro. Comigo trabalham a *Bia* (finanças) e o *Otto* (agenda e lembretes). É só falar com a gente do jeito que você fala com qualquer pessoa — por *texto*, *áudio* ou *foto*:\n\n' +
  '💸 *Registrar*: "gastei 62 na farmácia", "almoço 141,60 no cartão do Itaú", "tv 2400 em 10x no Nubank", "recebi 3000 de salário"\n' +
  '📸 *Comprovante*: manda a foto ou PDF que eu leio e lanço\n' +
  '📊 *Consultar*: "como estou esse mês?", "quanto gastei de mercado?", "gastos do cartão", "estourei o orçamento?"\n' +
  '🗓️ *Contas*: "aluguel 1500 todo dia 10", "o que vence esse mês?", "paguei a luz"\n' +
  '⏰ *Lembretes*: "me lembra de ligar pro contador amanhã às 10h", "o que tenho pra hoje?", "já liguei"\n' +
  '✏️ *Corrigir*: "na verdade foi 50", "isso é Mercado", "apaga esse"\n\n' +
  'Quando você corrige uma categoria, eu aprendo e acerto da próxima vez. 😉';

// Equipe virtual do Stama (mesma de src/components/agents/agents.jsx): cada resposta sai assinada
// pelo agente da área do pedido.
export const AGENTS = {
  stama: 'Stama',
  bia: 'Bia · finanças',
  otto: 'Otto · agenda',
};

const AGENT_BY_INTENT = {
  register: 'bia',
  query: 'bia',
  correct_last: 'bia',
  delete_last: 'bia',
  create_bill: 'bia',
  list_bills: 'bia',
  pay_bill: 'bia',
  create_task: 'otto',
  list_tasks: 'otto',
  complete_task: 'otto',
};

export function signed(agent, text) {
  return `_${AGENTS[agent] || AGENTS.stama}_\n${text}`;
}

export function formatBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Contexto do usuário e regras de categoria aprendidas
// ---------------------------------------------------------------------------

async function loadContext(user) {
  const [categories, cards, rules] = await Promise.all([
    prisma.transactionCategory.findMany({ where: { user_id: user.id, active: true } }),
    prisma.creditCard.findMany({ where: { user_id: user.id, active: true } }),
    prisma.categoryRule.findMany({ where: { user_id: user.id } }),
  ]);
  return {
    expenseCategories: categories.filter((c) => c.type === 'expense').map((c) => c.name),
    incomeCategories: categories.filter((c) => c.type === 'income').map((c) => c.name),
    cards,
    rules,
    createdCategories: [],
  };
}

export function ruleKeyword(description) {
  return normalizeText(description)
    .replace(/\(\d+\/\d+\)/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function applyCategoryRules(rules, description, type, category) {
  const text = ruleKeyword(description);
  if (!text) return category;
  const match = rules
    .filter((r) => r.type === type && r.keyword && text.includes(r.keyword))
    .sort((a, b) => b.keyword.length - a.keyword.length)[0];
  return match ? match.category : category;
}

async function learnCategoryRule(user, description, type, category) {
  const keyword = ruleKeyword(description);
  if (!keyword || !category) return;
  await prisma.categoryRule.upsert({
    where: { user_id_keyword_type: { user_id: user.id, keyword, type } },
    create: { user_id: user.id, created_by: user.email, keyword, type, category },
    update: { category },
  });
}

export async function loadCategoryRules(userId) {
  return prisma.categoryRule.findMany({ where: { user_id: userId } });
}

function fallbackCategory(type, ctx) {
  const list = type === 'income' ? ctx.incomeCategories : ctx.expenseCategories;
  const other = list.find((c) => /^outr/i.test(normalizeText(c)));
  return other || (type === 'income' ? 'Outras Receitas' : 'Outras Despesas');
}

function validCategory(category, type, ctx) {
  const list = type === 'income' ? ctx.incomeCategories : ctx.expenseCategories;
  if (!list.length) return category || fallbackCategory(type, ctx);
  const exact = list.find((c) => c === category);
  if (exact) return exact;
  const loose = list.find((c) => normalizeText(c) === normalizeText(category));
  return loose || fallbackCategory(type, ctx);
}

const NEW_CATEGORY_COLORS = ['#0d8462', '#f59e0b', '#6366f1', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#8b5cf6'];

// Como validCategory, mas uma categoria que ainda não existe (e não é genérica tipo "Outros")
// é criada na conta do usuário — "amanhã vou receber 200 de freelancer" cria "Freelancer".
// As criadas ficam em ctx.createdCategories pra resposta avisar.
async function ensureCategory(user, category, type, ctx) {
  const name = String(category || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const list = type === 'income' ? ctx.incomeCategories : ctx.expenseCategories;
  const existing = list.find((c) => normalizeText(c) === normalizeText(name));
  if (existing) return existing;
  if (!name || /^outr/.test(normalizeText(name)) || /^[a-z_]+$/.test(name)) return fallbackCategory(type, ctx);

  const pretty = name.charAt(0).toUpperCase() + name.slice(1);
  await prisma.transactionCategory.create({
    data: {
      user_id: user.id,
      created_by: user.email,
      name: pretty,
      type,
      icon: type === 'income' ? '💵' : '🏷️',
      color: NEW_CATEGORY_COLORS[(list.length + 1) % NEW_CATEGORY_COLORS.length],
    },
  });
  list.push(pretty);
  ctx.createdCategories.push(pretty);
  return pretty;
}

function createdCategoriesNotice(ctx) {
  if (!ctx.createdCategories.length) return '';
  const names = ctx.createdCategories.map((c) => `*${c}*`).join(', ');
  return `\n\n🏷️ Criei ${ctx.createdCategories.length > 1 ? 'as categorias' : 'a categoria'} ${names} pra você.`;
}

function findCard(cards, name) {
  const wanted = normalizeText(name);
  if (!wanted) return null;
  return (
    cards.find((c) => normalizeText(c.name) === wanted) ||
    cards.find((c) => normalizeText(c.name).includes(wanted) || wanted.includes(normalizeText(c.name))) ||
    cards.find((c) => c.last_digits && wanted.includes(String(c.last_digits))) ||
    null
  );
}

function describeAction(action) {
  return action ? action.summary : null;
}

// ---------------------------------------------------------------------------
// Gravação de lançamentos
// ---------------------------------------------------------------------------

async function normalizeItem(user, raw, ctx, today) {
  const type = raw.type === 'income' ? 'income' : 'expense';
  const description = String(raw.description || '').trim() || (type === 'income' ? 'Receita' : 'Despesa');
  const payment = PAYMENT_LABELS[raw.payment_method] ? raw.payment_method : 'pix';
  // Regra aprendida tem prioridade sobre o palpite da IA (e evita criar categoria à toa).
  const learned = applyCategoryRules(ctx.rules, description, type, null);
  const category = learned || (await ensureCategory(user, raw.category, type, ctx));
  return {
    description: description.charAt(0).toUpperCase() + description.slice(1),
    amount: Math.abs(Number(raw.amount) || 0),
    type,
    category,
    date: isDateStr(raw.date) ? raw.date : today,
    payment_method: type === 'income' && payment === 'credit_card' ? 'pix' : payment,
    card_name: raw.card_name || null,
    installments: Math.max(1, Math.min(48, Number.parseInt(raw.installments, 10) || 1)),
  };
}

async function createTransaction(user, item, notes = 'Lançado pelo Stama no WhatsApp.') {
  await enforceTransactionLimit(user);
  let linkedBillId = null;
  try {
    linkedBillId = await reconcilePendingBill({
      userId: user.id,
      description: item.description,
      amount: item.amount,
      type: item.type,
      dateStr: item.date,
    });
  } catch (err) {
    console.error('[whatsapp] Erro ao reconciliar com conta pendente:', err);
  }

  const tx = await prisma.transaction.create({
    data: {
      description: item.description,
      amount: item.amount,
      type: item.type,
      category: item.category,
      date: toDbDate(item.date),
      payment_method: item.payment_method,
      is_food_voucher: item.payment_method === 'food_voucher',
      notes,
      user_id: user.id,
      created_by: user.email,
      ...(linkedBillId ? { linked_bill_id: linkedBillId } : {}),
    },
  });
  return { tx, linkedBillId };
}

// Mesmo formato do lançamento manual em CreditCardTransactions.jsx (handleSubmit): uma linha por
// parcela, valor dividido, sufixo "(i/n)" na descrição e a data da compra em todas.
async function createCardPurchase(user, card, item) {
  const n = item.installments;
  const ids = [];
  for (let i = 1; i <= n; i++) {
    const row = await prisma.creditCardTransaction.create({
      data: {
        user_id: user.id,
        created_by: user.email,
        card_id: card.id,
        description: n > 1 ? `${item.description} (${i}/${n})` : item.description,
        amount: Math.round((item.amount / n) * 100) / 100,
        category: item.category,
        purchase_date: toDbDate(item.date),
        installments: n,
        installment_number: i,
      },
    });
    ids.push(row.id);
  }
  return ids;
}

function itemLine(item, cardName) {
  const icon = item.type === 'income' ? '💰' : '💸';
  const where = cardName
    ? ` · 💳 ${cardName}${item.installments > 1 ? ` em ${item.installments}x de R$ ${formatBRL(item.amount / item.installments)}` : ''}`
    : ` · ${PAYMENT_LABELS[item.payment_method] || ''}`;
  return `${icon} *${item.description}* — R$ ${formatBRL(item.amount)}\n   ${item.category} · ${formatShortBR(item.date)}${where}`;
}

async function registerItems(user, items, ctx, chosenCard = null) {
  const lines = [];
  const notices = [];
  let lastAction = null;

  // Compra no cartão sem cartão identificável e mais de um cartão cadastrado: pergunta antes.
  const needsCard = items.filter((i) => i.payment_method === 'credit_card');
  if (!chosenCard && needsCard.length && ctx.cards.length > 1 && needsCard.some((i) => !findCard(ctx.cards, i.card_name))) {
    setPending(user.id, { kind: 'choose_card', items });
    return (
      'Em qual cartão foi?\n\n' +
      ctx.cards.map((c, idx) => `${idx + 1}. ${c.name}${c.last_digits ? ` (final ${c.last_digits})` : ''}`).join('\n') +
      '\n\nResponde com o número ou o nome.'
    );
  }

  for (const item of items) {
    if (!item.amount) continue;
    if (item.payment_method === 'credit_card' && item.type === 'expense') {
      const card = chosenCard || findCard(ctx.cards, item.card_name) || (ctx.cards.length === 1 ? ctx.cards[0] : null);
      if (card) {
        const ids = await createCardPurchase(user, card, item);
        lines.push(itemLine(item, card.name));
        lastAction = {
          kind: 'card',
          ids,
          item: { ...item, card_id: card.id, card_name: card.name },
          summary: `compra no cartão ${card.name}: ${item.description}, R$ ${formatBRL(item.amount)}${item.installments > 1 ? ` em ${item.installments}x` : ''}, categoria ${item.category}, data ${item.date}`,
        };
        continue;
      }
      notices.push('Você ainda não tem cartão cadastrado no app, então lancei como despesa comum.');
    }

    const { tx, linkedBillId } = await createTransaction(user, item);
    lines.push(itemLine(item));
    if (linkedBillId) notices.push(`📌 "${item.description}" batia com uma conta pendente — já marquei como paga.`);
    lastAction = {
      kind: 'transaction',
      ids: [tx.id],
      item,
      summary: `${item.type === 'income' ? 'receita' : 'despesa'}: ${item.description}, R$ ${formatBRL(item.amount)}, categoria ${item.category}, data ${item.date}, ${PAYMENT_LABELS[item.payment_method]}`,
    };
  }

  if (!lines.length) return 'Não consegui identificar o valor. Pode mandar de novo com o valor? Ex: "gastei 35 no almoço".';
  setLastAction(user.id, lastAction);

  return (
    `✅ ${lines.length > 1 ? `${lines.length} lançamentos registrados` : 'Registrado'}!\n\n` +
    lines.join('\n\n') +
    (notices.length ? `\n\n${notices.join('\n')}` : '') +
    createdCategoriesNotice(ctx) +
    '\n\nAlgo errado? É só me dizer (ex: "na verdade foi 50" ou "isso é Mercado").'
  );
}

// Lançamento vindo da leitura de foto/PDF (messageHandler.js) — guarda como último registro pra
// que "isso é Mercado" logo depois também funcione nesse fluxo.
export function rememberReceiptTransaction(user, tx) {
  const item = {
    description: tx.description,
    amount: tx.amount,
    type: tx.type,
    category: tx.category,
    date: tx.date.toISOString().slice(0, 10),
    payment_method: tx.payment_method,
    installments: 1,
  };
  setLastAction(user.id, {
    kind: 'transaction',
    ids: [tx.id],
    item,
    summary: `${item.type === 'income' ? 'receita' : 'despesa'} (lida de comprovante): ${item.description}, R$ ${formatBRL(item.amount)}, categoria ${item.category}, data ${item.date}`,
  });
}

// ---------------------------------------------------------------------------
// Correção / exclusão do último registro
// ---------------------------------------------------------------------------

async function correctLast(user, correction, ctx) {
  const action = getConversation(user.id).lastAction;
  if (!action) return 'Não achei um lançamento recente meu pra corrigir. Você pode editar direto no app, ou me dizer o lançamento completo de novo.';
  if (action.kind === 'task') return 'Pra ajustar essa tarefa, edite em *Agenda > Tarefas e lembretes* no app — ou me peça pra apagar e mande de novo.';
  if (action.kind === 'bill') return 'Pra ajustar essa conta, edite direto em *Contas a Pagar/Receber* no app — ou me peça pra apagar e mande de novo.';

  const item = { ...action.item };
  const changes = [];
  if (correction?.description) {
    item.description = correction.description;
    changes.push(`descrição → ${item.description}`);
  }
  if (correction?.amount) {
    item.amount = Math.abs(Number(correction.amount));
    changes.push(`valor → R$ ${formatBRL(item.amount)}`);
  }
  if (correction?.date && isDateStr(correction.date)) {
    item.date = correction.date;
    changes.push(`data → ${formatDateBR(item.date)}`);
  }
  let learned = false;
  if (correction?.category) {
    item.category = await ensureCategory(user, correction.category, item.type, ctx);
    changes.push(`categoria → ${item.category}`);
    await learnCategoryRule(user, item.description, item.type, item.category);
    learned = true;
  }
  if (correction?.payment_method && action.kind === 'transaction') {
    item.payment_method = correction.payment_method;
    changes.push(`pagamento → ${PAYMENT_LABELS[item.payment_method]}`);
  }
  if (!changes.length) return 'Não entendi o que mudar. Ex: "na verdade foi 50", "isso é Mercado", "foi ontem".';

  if (action.kind === 'transaction') {
    await prisma.transaction.update({
      where: { id: action.ids[0] },
      data: {
        description: item.description,
        amount: item.amount,
        category: item.category,
        date: toDbDate(item.date),
        payment_method: item.payment_method,
        is_food_voucher: item.payment_method === 'food_voucher',
      },
    });
  } else {
    const n = item.installments || action.ids.length;
    const rows = await prisma.creditCardTransaction.findMany({ where: { id: { in: action.ids }, user_id: user.id } });
    for (const row of rows) {
      await prisma.creditCardTransaction.update({
        where: { id: row.id },
        data: {
          description: n > 1 ? `${item.description} (${row.installment_number}/${n})` : item.description,
          amount: Math.round((item.amount / n) * 100) / 100,
          category: item.category,
          purchase_date: toDbDate(item.date),
        },
      });
    }
  }

  setLastAction(user.id, { ...action, item, summary: action.summary.replace(/:.*/, `: ${item.description}, R$ ${formatBRL(item.amount)}, categoria ${item.category}, data ${item.date}`) });
  return (
    `✏️ Corrigido: ${changes.join(', ')}.` +
    (learned ? `\n\n🧠 Anotado! Da próxima vez que aparecer "${item.description}", já coloco em *${item.category}*.` : '') +
    createdCategoriesNotice(ctx)
  );
}

async function askDeleteLast(user) {
  const action = getConversation(user.id).lastAction;
  if (!action) return 'Não achei um lançamento recente meu pra apagar. Você pode excluir direto no app.';
  setPending(user.id, { kind: 'confirm_delete', action });
  return `Apagar ${action.summary}?\n\nResponde *sim* pra confirmar.`;
}

async function deleteAction(user, action) {
  if (action.kind === 'transaction') {
    await prisma.transaction.deleteMany({ where: { id: { in: action.ids }, user_id: user.id } });
  } else if (action.kind === 'card') {
    await prisma.creditCardTransaction.deleteMany({ where: { id: { in: action.ids }, user_id: user.id } });
  } else if (action.kind === 'bill') {
    await prisma.bill.deleteMany({ where: { id: { in: action.ids }, user_id: user.id } });
  } else if (action.kind === 'task') {
    await prisma.task.deleteMany({ where: { id: { in: action.ids }, user_id: user.id } });
  }
  setLastAction(user.id, null);
  return '🗑️ Apagado.';
}

// ---------------------------------------------------------------------------
// Contas a pagar/receber
// ---------------------------------------------------------------------------

const RECURRENCE_LABELS = { none: '', monthly: 'todo mês', quarterly: 'a cada 3 meses', yearly: 'todo ano' };

async function createBill(user, bill, ctx, today) {
  if (!bill?.title || !bill?.amount) return 'Pra cadastrar a conta preciso do nome e do valor. Ex: "aluguel 1500 todo dia 10".';
  const type = bill.type === 'receivable' ? 'receivable' : 'payable';
  const recurrence = RECURRENCE_LABELS[bill.recurrence] !== undefined ? bill.recurrence : 'none';
  const due = isDateStr(bill.due_date) ? bill.due_date : today;
  const category = bill.category ? await ensureCategory(user, bill.category, type === 'receivable' ? 'income' : 'expense', ctx) : null;

  const row = await prisma.bill.create({
    data: {
      user_id: user.id,
      created_by: user.email,
      title: bill.title,
      amount: Math.abs(Number(bill.amount)),
      type,
      category,
      due_date: toDbDate(due),
      recurrence,
      notes: 'Cadastrada pelo Stama no WhatsApp.',
    },
  });
  setLastAction(user.id, {
    kind: 'bill',
    ids: [row.id],
    summary: `conta ${type === 'receivable' ? 'a receber' : 'a pagar'}: ${row.title}, R$ ${formatBRL(row.amount)}, vencimento ${due}${recurrence !== 'none' ? `, ${RECURRENCE_LABELS[recurrence]}` : ''}`,
  });
  return (
    `🗓️ Conta ${type === 'receivable' ? 'a receber' : 'a pagar'} cadastrada!\n\n` +
    `*${row.title}* — R$ ${formatBRL(row.amount)}\n` +
    `Vence ${formatDateBR(due)}${recurrence !== 'none' ? ` · repete ${RECURRENCE_LABELS[recurrence]}` : ''}\n\n` +
    (type === 'receivable'
      ? 'Te lembro no dia. Quando o dinheiro cair, é só me dizer "recebi".'
      : 'Eu te aviso antes do vencimento. Quando pagar, é só me dizer "paguei".') +
    createdCategoriesNotice(ctx)
  );
}

async function listBills(user, today) {
  const [month, overdueOld] = await Promise.all([billsForMonth(user.id, today), overdueBillsBefore(user.id, today)]);
  const pending = [...overdueOld, ...month.filter((b) => !b.paid)];
  const paid = month.filter((b) => b.paid);
  if (!pending.length && !paid.length) return 'Você não tem contas cadastradas pra este mês. Quer cadastrar? Ex: "aluguel 1500 todo dia 10".';

  const line = (b) => {
    const late = b.due < today ? ' ⚠️ *atrasada*' : b.due === today ? ' ⏰ *vence hoje*' : '';
    return `${b.type === 'receivable' ? '🟢' : '🔴'} ${formatShortBR(b.due)} · *${b.title}* — R$ ${formatBRL(b.amount)}${late}`;
  };
  const payable = pending.filter((b) => b.type === 'payable').reduce((s, b) => s + b.amount, 0);
  const receivable = pending.filter((b) => b.type === 'receivable').reduce((s, b) => s + b.amount, 0);

  return (
    `🗓️ *Contas de ${describePeriod(monthStart(today), lastDayOfMonth(today))}*\n\n` +
    (pending.length ? pending.map(line).join('\n') : 'Nada pendente! 🎉') +
    `\n\nA pagar: *R$ ${formatBRL(payable)}*` +
    (receivable ? ` · A receber: *R$ ${formatBRL(receivable)}*` : '') +
    (paid.length ? `\n✅ Já quitadas no mês: ${paid.length}` : '')
  );
}

async function askPayBill(user, title, today) {
  const month = await billsForMonth(user.id, today);
  const overdueOld = await overdueBillsBefore(user.id, today);
  const pending = [...overdueOld, ...month.filter((b) => !b.paid)];
  const wanted = normalizeText(title);
  const bill =
    pending.find((b) => normalizeText(b.title) === wanted) ||
    pending.find((b) => normalizeText(b.title).includes(wanted) || wanted.includes(normalizeText(b.title)));
  if (!bill) return null;
  setPending(user.id, { kind: 'confirm_pay', bill: { id: bill.id, title: bill.title, amount: bill.amount, type: bill.type, due: bill.due, category: bill.category } });
  return `Marcar *${bill.title}* (R$ ${formatBRL(bill.amount)}, venc. ${formatShortBR(bill.due)}) como ${bill.type === 'receivable' ? 'recebida' : 'paga'} hoje?\n\nIsso lança a ${bill.type === 'receivable' ? 'receita' : 'despesa'} no app. Responde *sim* pra confirmar.`;
}

async function payBill(user, bill, ctx, today) {
  const type = bill.type === 'receivable' ? 'income' : 'expense';
  // A transação usa o título e valor exatos da conta: assim reconcilePendingBill (dentro de
  // createTransaction) reconhece a conta e faz a mesma baixa do "Marcar como Paga" do app. As
  // recorrentes só são oferecidas aqui no mês corrente (billsForMonth), então "hoje" projeta o
  // ciclo certo; atrasadas de meses anteriores são sempre avulsas e só viram "paga".
  const item = {
    description: bill.title,
    amount: bill.amount,
    type,
    category: bill.category ? validCategory(bill.category, type, ctx) : fallbackCategory(type, ctx),
    date: today,
    payment_method: 'pix',
    installments: 1,
  };
  const { tx } = await createTransaction(user, item);
  setLastAction(user.id, { kind: 'transaction', ids: [tx.id], item, summary: `pagamento da conta ${bill.title}, R$ ${formatBRL(bill.amount)}` });
  return `✅ *${bill.title}* marcada como ${type === 'income' ? 'recebida' : 'paga'} — R$ ${formatBRL(bill.amount)} lançado hoje.`;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

function periodFromQuery(query, today) {
  let start = isDateStr(query?.start_date) ? query.start_date : monthStart(today);
  let end = isDateStr(query?.end_date) ? query.end_date : lastDayOfMonth(start);
  if (end < start) [start, end] = [end, start];
  return { start, end };
}

// Compras parceladas são gravadas uma linha por parcela, todas na data da compra — na listagem
// junta numa linha só ("TV (10x)") somando as parcelas.
function collapseInstallments(items) {
  const groups = new Map();
  for (const item of items) {
    const m = String(item.description).match(/^(.*) \((\d+)\/(\d+)\)$/);
    const key = m ? `${item.card_id || ''}|${item.date}|${m[1]}|${m[3]}` : Symbol('single');
    const existing = groups.get(key);
    if (existing) existing.amount += item.amount;
    else groups.set(key, { ...item, description: m ? `${m[1]} (${m[3]}x)` : item.description });
  }
  return [...groups.values()];
}

function pct(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function categoryBars(byCategory, total, limit = 8) {
  return byCategory
    .slice(0, limit)
    .map((c) => `• ${c.name}: *R$ ${formatBRL(c.total)}* (${pct(c.total, total)}%)`)
    .join('\n');
}

async function answerQuery(user, query, ctx, today) {
  const kind = query?.kind || 'summary';
  const { start, end } = periodFromQuery(query, today);
  const label = describePeriod(start, end);

  if (kind === 'budget') {
    const s = await periodSummary(user.id, monthStart(today), lastDayOfMonth(today));
    const budgets = await prisma.categoryBudget.findMany({ where: { user_id: user.id } });
    const lines = [];
    if (user.monthly_budget) {
      lines.push(`Orçamento geral: R$ ${formatBRL(s.expense)} de R$ ${formatBRL(user.monthly_budget)} (${pct(s.expense, user.monthly_budget)}%)${s.expense > user.monthly_budget ? ' 🚨' : ''}`);
    }
    for (const b of budgets) {
      const spent = s.byCategory.find((c) => c.name === b.category)?.total || 0;
      const p = pct(spent, b.monthly_limit);
      lines.push(`${p >= 100 ? '🚨' : p >= 80 ? '⚠️' : '✅'} ${b.category}: R$ ${formatBRL(spent)} de R$ ${formatBRL(b.monthly_limit)} (${p}%)`);
    }
    if (!lines.length) return 'Você ainda não definiu orçamento. Dá pra configurar limites por categoria no app, em *Orçamento*.';
    return `🎯 *Orçamento de ${describePeriod(monthStart(today), lastDayOfMonth(today))}*\n\n${lines.join('\n')}`;
  }

  if (kind === 'projection') {
    const lines = [];
    for (let i = 1; i <= 3; i++) {
      const ref = addMonths(today, i);
      const bills = (await billsForMonth(user.id, ref)).filter((b) => !b.paid);
      const out = bills.filter((b) => b.type === 'payable').reduce((s, b) => s + b.amount, 0);
      const inc = bills.filter((b) => b.type === 'receivable').reduce((s, b) => s + b.amount, 0);
      lines.push(`• ${describePeriod(monthStart(ref), lastDayOfMonth(ref))}: sai *R$ ${formatBRL(out)}*${inc ? ` · entra R$ ${formatBRL(inc)}` : ''}`);
    }
    let avg = 0;
    for (let i = 1; i <= 3; i++) {
      const ref = addMonths(today, -i);
      avg += (await periodSummary(user.id, monthStart(ref), lastDayOfMonth(ref))).expense;
    }
    avg /= 3;
    return (
      `🔮 *Compromissos dos próximos meses* (contas fixas e parcelas já cadastradas)\n\n${lines.join('\n')}` +
      `\n\nSua média de gastos nos últimos 3 meses foi *R$ ${formatBRL(avg)}*/mês.`
    );
  }

  if (kind === 'installments') {
    const future = await prisma.bill.findMany({
      where: { user_id: user.id, status: { not: 'paid' }, card_id: { not: null }, due_date: { gte: toDbDate(today) } },
      orderBy: { due_date: 'asc' },
    });
    if (!future.length) return 'Não encontrei parcelas futuras de cartão cadastradas. 🎉';
    const byMonth = {};
    for (const b of future) {
      const key = b.due_date.toISOString().slice(0, 7);
      byMonth[key] = (byMonth[key] || 0) + b.amount;
    }
    const total = future.reduce((s, b) => s + b.amount, 0);
    const last = future[future.length - 1].due_date.toISOString().slice(0, 10);
    return (
      `🧾 *Parcelas futuras do cartão*\n\n` +
      Object.entries(byMonth)
        .slice(0, 6)
        .map(([m, v]) => `• ${describePeriod(m + '-01', lastDayOfMonth(m + '-01'))}: R$ ${formatBRL(v)}`)
        .join('\n') +
      `\n\nTotal comprometido: *R$ ${formatBRL(total)}* · última parcela em ${formatDateBR(last)}`
    );
  }

  const s = await periodSummary(user.id, start, end);

  if (kind === 'income') {
    if (!s.incomes.length) return `Nenhuma receita registrada em ${label}.`;
    return (
      `💰 *Receitas de ${label}*: R$ ${formatBRL(s.income)}\n\n` +
      s.incomes.slice(0, 10).map((i) => `• ${formatShortBR(i.date)} ${i.description} — R$ ${formatBRL(i.amount)}`).join('\n')
    );
  }

  if (kind === 'recent') {
    const items = [...collapseInstallments(s.expenses).map((e) => ({ ...e, sign: '-' })), ...s.incomes.map((i) => ({ ...i, sign: '+' }))]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
    if (!items.length) return `Nenhum lançamento em ${label}.`;
    return (
      `🧾 *Últimos lançamentos (${label})*\n\n` +
      items.map((i) => `${i.sign === '+' ? '🟢' : '🔴'} ${formatShortBR(i.date)} ${i.description} — R$ ${formatBRL(i.amount)}${i.card_name ? ` 💳` : ''}`).join('\n')
    );
  }

  if (kind === 'card') {
    let items = collapseInstallments(s.expenses.filter((e) => e.source === 'card'));
    const card = query?.card_name ? findCard(ctx.cards, query.card_name) : null;
    if (card) items = items.filter((e) => e.card_id === card.id);
    if (!items.length) return `Nenhuma compra no ${card ? `cartão ${card.name}` : 'cartão'} em ${label}.`;
    const total = items.reduce((t, e) => t + e.amount, 0);
    const byCard = {};
    for (const e of items) byCard[e.card_name] = (byCard[e.card_name] || 0) + e.amount;
    return (
      `💳 *Cartão${card ? ` ${card.name}` : ''} — ${label}*: R$ ${formatBRL(total)}\n\n` +
      (card ? '' : Object.entries(byCard).map(([n, v]) => `• ${n}: R$ ${formatBRL(v)}`).join('\n') + '\n\n') +
      items.slice(0, 8).map((e) => `${formatShortBR(e.date)} ${e.description} — R$ ${formatBRL(e.amount)}`).join('\n')
    );
  }

  if (kind === 'category_total') {
    const wanted = normalizeText(query?.category);
    const cat = s.byCategory.find((c) => normalizeText(c.name) === wanted) || s.byCategory.find((c) => normalizeText(c.name).includes(wanted));
    if (!cat) return `Nada em *${query?.category || 'essa categoria'}* em ${label}.`;
    const items = collapseInstallments(s.expenses.filter((e) => e.category === cat.name));
    return (
      `🏷️ *${cat.name} — ${label}*: R$ ${formatBRL(cat.total)} (${pct(cat.total, s.expense)}% dos gastos)\n\n` +
      items.slice(0, 10).map((e) => `• ${formatShortBR(e.date)} ${e.description} — R$ ${formatBRL(e.amount)}`).join('\n') +
      (items.length > 10 ? `\n…e mais ${items.length - 10}` : '')
    );
  }

  if (kind === 'by_category') {
    if (!s.byCategory.length) return `Nenhum gasto registrado em ${label}.`;
    return `📊 *Gastos por categoria — ${label}*\n\n${categoryBars(s.byCategory, s.expense, 15)}\n\nTotal: *R$ ${formatBRL(s.expense)}*`;
  }

  // summary — com comparação contra o período anterior de mesmo tamanho
  const isFullMonth = start === monthStart(start) && end === lastDayOfMonth(start);
  const prevStart = isFullMonth ? addMonths(start, -1) : addDays(start, -(Math.round((toDbDate(end) - toDbDate(start)) / 86400000) + 1));
  const prevEnd = isFullMonth ? lastDayOfMonth(prevStart) : addDays(start, -1);
  // No mês corrente, compara com o mesmo trecho do mês anterior (dia 1 até o mesmo dia).
  const partial = isFullMonth && start === monthStart(today);
  const prevCut = partial ? addDays(prevStart, Number(today.slice(8, 10)) - 1) : prevEnd;
  const prev = (await getExpenseItems(user.id, prevStart, addDays(prevCut < prevEnd ? prevCut : prevEnd, 1))).reduce((t, e) => t + e.amount, 0);
  const diff = prev ? Math.round(((s.expense - prev) / prev) * 100) : null;

  return (
    `📊 *Resumo de ${label}*\n\n` +
    `🟢 Entradas: *R$ ${formatBRL(s.income)}*\n` +
    `🔴 Saídas: *R$ ${formatBRL(s.expense)}*\n` +
    `${s.balance >= 0 ? '💚' : '🚨'} Saldo: *R$ ${formatBRL(s.balance)}*` +
    (diff !== null ? `\n\n${diff > 0 ? '📈' : '📉'} Gastos ${diff > 0 ? `${diff}% acima` : `${Math.abs(diff)}% abaixo`} do ${partial ? 'mesmo período do mês passado' : 'período anterior'}.` : '') +
    (s.byCategory.length ? `\n\n*Onde mais gastou:*\n${categoryBars(s.byCategory, s.expense, 5)}` : '')
  );
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

async function resolvePending(user, pending, text, ctx, today) {
  const clean = text.trim();
  if (pending.kind === 'confirm_delete') {
    if (YES.test(clean)) return deleteAction(user, pending.action);
    if (NO.test(clean)) return 'Ok, mantive como estava. 👍';
    return null;
  }
  if (pending.kind === 'confirm_pay') {
    if (YES.test(clean)) return payBill(user, pending.bill, ctx, today);
    if (NO.test(clean)) return 'Ok, não mexi na conta. 👍';
    return null;
  }
  if (pending.kind === 'choose_card') {
    if (NO.test(clean)) return 'Ok, cancelei esse lançamento.';
    const idx = Number.parseInt(clean, 10);
    const card = Number.isInteger(idx) && ctx.cards[idx - 1] ? ctx.cards[idx - 1] : findCard(ctx.cards, clean);
    if (!card) return null;
    return registerItems(user, pending.items, ctx, card);
  }
  return null;
}

export async function handleAssistantText(user, text, provider) {
  const today = todayStr();
  const ctx = await loadContext(user);
  const conv = getConversation(user.id);

  const pending = takePending(user.id);
  if (pending) {
    const resolved = await resolvePending(user, pending, text, ctx, today);
    if (resolved) {
      remember(user.id, 'user', text);
      remember(user.id, 'assistant', resolved);
      return signed(pending.action?.kind === 'task' ? 'otto' : 'bia', resolved);
    }
  }

  const monthBills = (await billsForMonth(user.id, today)).filter((b) => !b.paid);
  const tasks = await openTasks(user.id);
  const system = assistantSystemPrompt({
    today,
    now: nowTimeStr(),
    openTasks: tasks.slice(0, 30).map((t) => t.title),
    weekday: WEEKDAYS[new Date(today + 'T12:00:00Z').getUTCDay()],
    expenseCategories: ctx.expenseCategories,
    incomeCategories: ctx.incomeCategories,
    cards: ctx.cards.map((c) => c.name),
    pendingBills: monthBills.map((b) => `${b.title} (R$ ${formatBRL(b.amount)}, vence ${b.due})`),
    lastAction: describeAction(conv.lastAction),
    history: conv.history,
  });

  const result = await provider.generateStructured({ system, prompt: text, schema: assistantIntentSchema });

  let answer;
  switch (result.intent) {
    case 'register': {
      const items = [];
      for (const t of result.transactions || []) items.push(await normalizeItem(user, t, ctx, today));
      answer = await registerItems(user, items, ctx);
      break;
    }
    case 'query':
      answer = await answerQuery(user, result.query, ctx, today);
      break;
    case 'correct_last':
      answer = await correctLast(user, result.correction, ctx);
      break;
    case 'delete_last':
      answer = await askDeleteLast(user);
      break;
    case 'create_bill':
      answer = await createBill(user, result.bill, ctx, today);
      break;
    case 'list_bills':
      answer = await listBills(user, today);
      break;
    case 'pay_bill':
      answer = (await askPayBill(user, result.bill_title || '', today)) ||
        'Não achei essa conta entre as pendentes. Se foi um gasto avulso, me diga o valor que eu registro (ex: "paguei 230 de luz").';
      break;
    case 'create_task': {
      const { task, error } = await createTask(user, result.task);
      if (error) {
        answer = error;
        break;
      }
      setLastAction(user.id, { kind: 'task', ids: [task.id], summary: `tarefa: ${task.title}` });
      answer =
        `✅ ${task.remind_at ? 'Lembrete criado' : 'Tarefa criada'}!\n\n${describeTask(task)}` +
        (task.remind_at ? '\n\nEu te chamo aqui na hora. 😉' : '');
      break;
    }
    case 'list_tasks':
      answer = await listTasksMessage(user.id, result.task_scope || 'all');
      break;
    case 'complete_task': {
      const done = await completeTaskByTitle(user.id, result.task_title || '');
      answer = !done
        ? 'Não achei essa tarefa entre as abertas. Manda "minhas tarefas" pra ver a lista.'
        : done.recurring
          ? `✅ *${done.task.title}* feito! Como é recorrente, já deixei a próxima agendada.`
          : `✅ *${done.task.title}* concluída. Mandou bem! 💪`;
      break;
    }
    case 'help':
      answer = HELP_TEXT;
      break;
    default:
      answer = result.reply || 'Posso te ajudar a registrar gastos, ver seu saldo ou suas contas. Manda "ajuda" pra ver exemplos. 🙂';
  }

  remember(user.id, 'user', text);
  remember(user.id, 'assistant', answer);
  return signed(AGENT_BY_INTENT[result.intent] || 'stama', answer);
}
