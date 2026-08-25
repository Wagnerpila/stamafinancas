import { format, startOfMonth } from "date-fns";

// Retorna se uma bill (não recorrente) deve aparecer no mês selecionado.
// Para contas recorrentes originais, também decide se aquele mês faz parte do ciclo.
export function billAppearsInMonth(bill, selectedDate) {
  if (!bill.due_date) return false;
  const due = new Date(bill.due_date.slice(0, 10) + "T00:00:00");
  if (isNaN(due)) return false;

  const sel = startOfMonth(selectedDate);
  const origin = startOfMonth(due);

  // Contas recorrentes originais ainda pendentes: verifica só o intervalo.
  // Se a própria original já estiver com status "paid" (dado inconsistente, ex: linha
  // antiga marcada como paga antes desta lógica existir), trata como conta avulsa —
  // caso contrário ela "vazaria" como paga em todos os meses futuros para sempre.
  if (bill.recurrence && bill.recurrence !== "none" && bill.status !== "paid") {
    if (sel < origin) return false;
    if (bill.recurrence === "monthly") return true;
    if (bill.recurrence === "quarterly") {
      const diffMonths = Math.round((sel - origin) / (1000 * 60 * 60 * 24 * 30.44));
      return diffMonths % 3 === 0;
    }
    if (bill.recurrence === "yearly") {
      return due.getMonth() === selectedDate.getMonth();
    }
    return false;
  }

  // Conta não recorrente (ou recorrente-mas-já-paga-diretamente): aparece só no mês do due_date
  return format(origin, "yyyy-MM") === format(sel, "yyyy-MM");
}

// Gera uma "instância virtual" da bill para o mês selecionado (com due_date ajustado)
export function buildVirtualBill(bill, selectedDate) {
  if (!bill.recurrence || bill.recurrence === "none") return bill;
  if (bill.status === "paid") return bill;

  const due = new Date(bill.due_date.slice(0, 10) + "T00:00:00");
  const targetDue = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), due.getDate());
  return {
    ...bill,
    _virtual: true,
    _originalId: bill.id,
    due_date: format(targetDue, "yyyy-MM-dd"),
  };
}

// IDs das contas recorrentes originais que já têm uma cópia paga no mês de referenceDate.
// A cópia paga tem: status="paid", recurrence="none", linked_bill_id=<id da original>
// e due_date dentro do mês de referência.
export function getPaidRecurringIdsForMonth(bills, referenceDate) {
  const monthKey = format(startOfMonth(referenceDate), "yyyy-MM");
  const ids = new Set();
  bills.forEach(bill => {
    if (
      bill.status === "paid" &&
      (!bill.recurrence || bill.recurrence === "none") &&
      bill.linked_bill_id &&
      bill.due_date
    ) {
      const dueMth = format(startOfMonth(new Date(bill.due_date.slice(0, 10) + "T00:00:00")), "yyyy-MM");
      if (dueMth === monthKey) ids.add(bill.linked_bill_id);
    }
  });
  return ids;
}

// IDs das contas recorrentes originais que já têm uma cópia própria (paga OU só editada) no mês
// de referenceDate — a recorrência é só a relação entre os lançamentos, não um valor
// compartilhado entre eles, então uma edição pontual (ver buildBillEditAction) cria uma cópia
// vinculada igual à da "Marcar como paga", mas ainda pendente. A cópia tem: recurrence="none",
// linked_bill_id=<id da original> e due_date dentro do mês de referência (status qualquer).
export function getOverriddenRecurringIdsForMonth(bills, referenceDate) {
  const monthKey = format(startOfMonth(referenceDate), "yyyy-MM");
  const ids = new Set();
  bills.forEach(bill => {
    if (
      (!bill.recurrence || bill.recurrence === "none") &&
      bill.linked_bill_id &&
      bill.due_date
    ) {
      const dueMth = format(startOfMonth(new Date(bill.due_date.slice(0, 10) + "T00:00:00")), "yyyy-MM");
      if (dueMth === monthKey) ids.add(bill.linked_bill_id);
    }
  });
  return ids;
}

// Expande a lista de bills para o mês selecionado: contas recorrentes originais que já têm uma
// cópia própria nesse mês (paga ou só editada) são substituídas por ela; as demais aparecem
// como instância virtual.
export function getBillsForMonth(bills, selectedDate) {
  const overriddenIds = getOverriddenRecurringIdsForMonth(bills, selectedDate);
  const result = [];

  bills.forEach(bill => {
    const isRecurringOriginal = bill.recurrence && bill.recurrence !== "none";

    if (isRecurringOriginal) {
      if (overriddenIds.has(bill.id)) return;
      if (!billAppearsInMonth(bill, selectedDate)) return;
      result.push(buildVirtualBill(bill, selectedDate));
    } else {
      if (!billAppearsInMonth(bill, selectedDate)) return;
      result.push(bill);
    }
  });

  return result;
}

// Campos editáveis de uma conta a pagar/receber pelo BillForm.
const EDITABLE_BILL_FIELDS = [
  "title", "description", "amount", "type", "category", "due_date",
  "recurrence", "notes", "is_food_voucher", "card_id",
];

// Monta o payload de salvar uma conta editada e decide se é create ou update.
//
// Regra: uma recorrência representa só a relação entre os lançamentos, não um valor
// compartilhado entre eles — cada ocorrência mensal tem seu próprio valor. Por isso, se a conta
// sendo editada é uma instância virtual (gerada por getBillsForMonth a partir do template, ainda
// sem cópia própria naquele mês), a edição cria uma cópia vinculada só para aquele mês — igual à
// da "Marcar como paga" — em vez de alterar o template. Assim o valor (ou outro campo) mudado
// vale só para a data que está sendo editada; os meses futuros continuam usando os dados
// originais da recorrência. Editar uma cópia que já existe (ou uma conta avulsa) só atualiza ela
// mesma, como sempre.
export function buildBillEditAction(editingBill, formData) {
  const fields = {};
  for (const field of EDITABLE_BILL_FIELDS) {
    if (formData[field] !== undefined) fields[field] = formData[field];
  }

  if (editingBill._virtual) {
    return {
      op: "create",
      data: {
        ...fields,
        recurrence: "none",
        status: editingBill.status || "pending",
        linked_bill_id: editingBill._originalId,
      },
    };
  }
  return { op: "update", id: editingBill.id, data: fields };
}

// Retorna a data de vencimento "efetiva" da bill para hoje: para contas recorrentes
// ainda não pagas neste mês, é o vencimento projetado no mês atual (não a data original,
// que pode estar meses/anos no passado). Retorna null se a conta não se aplica ao mês atual
// (ex: recorrência trimestral fora do ciclo) ou já foi paga neste mês.
export function getEffectiveDueDateToday(bill, bills) {
  const today = new Date();
  const isRecurringOriginal = bill.recurrence && bill.recurrence !== "none" && bill.status !== "paid";

  if (!isRecurringOriginal) {
    return bill.due_date ? bill.due_date.split("T")[0] : null;
  }

  const overriddenIds = getOverriddenRecurringIdsForMonth(bills, today);
  if (overriddenIds.has(bill.id)) return null;
  if (!billAppearsInMonth(bill, today)) return null;

  return buildVirtualBill(bill, today).due_date;
}

export function normalizeTitle(str) {
  return String(str || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

// Procura, entre as transações já existentes do usuário, uma que corresponda a esse mesmo
// pagamento — mesmo título (normalizado), mesmo valor, mesmo tipo, dentro de uma janela de dias
// em torno do vencimento — e que ainda não esteja vinculada a nenhuma conta.
//
// Usado por "Marcar como Paga/Recebida": se o usuário já tinha lançado a transação manualmente
// (ex: antes de configurar a conta como recorrente, ou por hábito) antes de vir marcar a conta
// como paga no app, criar uma transação nova duplicaria a despesa/receita — o valor real já
// tinha sido lançado, só a conta é que não sabia disso.
export function findMatchingTransaction(transactions, { title, amount, type, referenceDate, windowDays = 10 }) {
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) return null;

  const ref = referenceDate instanceof Date
    ? referenceDate
    : new Date(String(referenceDate || "").slice(0, 10) + "T00:00:00");
  if (isNaN(ref)) return null;

  return transactions.find(t => {
    if (t.linked_bill_id) return false; // já vinculada a outra conta
    if (t.type !== type) return false;
    if (Math.abs((t.amount || 0) - amount) >= 0.01) return false;
    if (normalizeTitle(t.description) !== normalizedTitle) return false;
    if (!t.date) return false;
    const td = new Date(t.date.slice(0, 10) + "T00:00:00");
    if (isNaN(td)) return false;
    const diffDays = Math.abs((td - ref) / (1000 * 60 * 60 * 24));
    return diffDays <= windowDays;
  }) || null;
}
