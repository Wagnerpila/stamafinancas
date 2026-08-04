import { prisma } from '../lib/prisma.js';

// Regex construída via String.fromCharCode (em vez de um escape \uXXXX ou caractere literal no
// fonte) para casar marcas diacríticas combinantes (intervalo Unicode 0300–036F) sem depender de
// caracteres não-imprimíveis no arquivo.
const COMBINING_DIACRITICS = new RegExp(
  '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
  'g'
);

function normalizeTitle(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '') // remove acentos
    .toLowerCase()
    .trim();
}

// Projeta o vencimento de uma conta recorrente para o mes da data de referencia, mantendo o
// mesmo dia do mes original (arredondado para o ultimo dia se o mes de referencia for mais
// curto) — mesma logica de src/components/lib/billRecurrence.js (buildVirtualBill), reproduzida
// aqui porque este lado roda em Node/Prisma, sem acesso ao codigo do frontend.
function projectDueDate(originalDueDate, referenceDate) {
  const day = originalDueDate.getDate();
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDayOfMonth));
}

/**
 * Tenta casar uma transacao recem-lancada automaticamente (ex: foto/PDF via bot do WhatsApp,
 * onde nao ha revisao manual antes de salvar) com uma conta a pagar/receber pendente do mesmo
 * usuario — mesmo titulo (normalizado) e valor.
 *
 * Sem isso, a conta em "Contas a Pagar/Receber" nunca sabe que foi quitada: continua vencendo
 * todo mes, o sino de notificações insiste nela, e se o usuário depois usar "Marcar como Paga"
 * pra fazer a notificação parar, uma SEGUNDA transação é lançada para o mesmo pagamento —
 * duplicando a despesa/receita.
 *
 * Quando encontra uma conta correspondente, replica o mesmo comportamento do "Marcar como Paga"
 * manual (BillsToPay/BillsToReceive): conta recorrente ganha uma cópia paga só daquele mês (a
 * original continua pendente pros meses seguintes); conta avulsa é marcada como paga direto.
 * Retorna o id a gravar em Transaction.linked_bill_id, ou null se não achou correspondência (ou
 * se aquele mês da recorrência já tinha sido pago antes — evita duplicar a própria cópia paga).
 */
export async function reconcilePendingBill({ userId, description, amount, type, dateStr }) {
  const amountNum = Math.abs(Number(amount) || 0);
  const normalizedTitle = normalizeTitle(description);
  if (!normalizedTitle || !amountNum) return null;

  const billType = type === 'income' ? 'receivable' : 'payable';
  const candidates = await prisma.bill.findMany({
    where: { user_id: userId, type: billType, status: 'pending' },
  });

  const match = candidates.find(
    (b) => normalizeTitle(b.title) === normalizedTitle && Math.abs(b.amount - amountNum) < 0.01
  );
  if (!match) return null;

  const referenceDate = dateStr && !Number.isNaN(new Date(dateStr).getTime()) ? new Date(dateStr) : new Date();
  const today = new Date();

  if (match.recurrence && match.recurrence !== 'none') {
    const dueDate = projectDueDate(match.due_date, referenceDate);
    const monthStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
    const monthEnd = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 1);

    const alreadyPaidThisCycle = await prisma.bill.findFirst({
      where: {
        linked_bill_id: match.id,
        status: 'paid',
        due_date: { gte: monthStart, lt: monthEnd },
      },
    });
    if (alreadyPaidThisCycle) return null;

    await prisma.bill.create({
      data: {
        user_id: userId,
        created_by: match.created_by,
        title: match.title,
        description: match.description,
        amount: match.amount,
        type: match.type,
        category: match.category,
        due_date: dueDate,
        paid_date: today,
        status: 'paid',
        recurrence: 'none',
        notes: match.notes,
        is_food_voucher: match.is_food_voucher,
        linked_bill_id: match.id,
      },
    });
    return match.id;
  }

  await prisma.bill.update({
    where: { id: match.id },
    data: { status: 'paid', paid_date: today },
  });
  return match.id;
}
