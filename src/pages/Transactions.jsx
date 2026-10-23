import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Trash2, CheckSquare, X, Crown, Loader2 } from "lucide-react";
import { Transaction } from "@/entities/Transaction";
import { User } from "@/entities/User";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EditTransactionDialog from "../components/transactions/EditTransactionDialog";
import TransactionFilters from "../components/transactions/TransactionFilters";
import usePurchaseNotes from "../hooks/usePurchaseNotes";
import { usePlanAccess } from "../components/common/PlanRestriction";
import PullToRefresh from "../components/mobile/PullToRefresh";
import { getBillsForMonth } from "../components/lib/billRecurrence";
import {
  usePageHeader,
  PageBody,
  MonthPill,
  StatCard,
  StatGrid,
  SearchBar,
  FilterChips,
  DayHeader,
  ListItem,
  StatusBadge,
  EmptyState,
  PillButton,
  RoundButton,
  brl,
} from "../components/stama/kit";

const PAYMENT_LABELS = { cash: "Dinheiro", pix: "Pix", debit: "Débito", credit_card: "Cartão", food_voucher: "Vale" };
const EMPTY_FILTERS = { type: "all", category: "all", source: "all", cardId: "all", search: "", dateFrom: "", dateTo: "" };

const dayOf = (raw) => String(raw || "").slice(0, 10);

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [bills, setBills] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [month, setMonth] = useState(new Date());
  const [status, setStatus] = useState("all");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [actionTx, setActionTx] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const { transactionLimit, isPremium } = usePlanAccess(user);
  const purchaseNotes = usePurchaseNotes();

  const load = useCallback(async (email) => {
    if (!email) return;
    const [txs, b] = await Promise.all([Transaction.filter({ created_by: email }, "-date"), base44.entities.Bill.filter({ created_by: email })]);
    setTransactions(txs);
    setBills(b);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await User.me();
        setUser(me);
        await load(me.email);
        base44.entities.CreditCard.filter({ created_by: me.email }).then(setCards).catch(() => {});
      } catch (error) {
        console.error("Erro ao carregar transações:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const monthKey = format(month, "yyyy-MM");
  const isAtLimit = !isPremium && transactionLimit > 0 && transactions.length >= transactionLimit;

  const data = useMemo(() => {
    const monthTxs = transactions.filter((t) => dayOf(t.date).slice(0, 7) === monthKey);
    const received = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
    const paid = monthTxs.filter((t) => t.type === "expense" && !t.is_food_voucher).reduce((s, t) => s + Math.abs(t.amount), 0);
    const pendingBills = getBillsForMonth(bills, month).filter((b) => b.status !== "paid");
    const toReceive = pendingBills.filter((b) => b.type === "receivable").reduce((s, b) => s + b.amount, 0);
    const toPay = pendingBills.filter((b) => b.type === "payable").reduce((s, b) => s + b.amount, 0);

    const search = filters.search.toLowerCase();
    const passes = (t) => {
      if (filters.type !== "all" && t.type !== filters.type) return false;
      if (filters.category !== "all" && t.category !== filters.category) return false;
      if (filters.source !== "all" && (t.source || "manual") !== filters.source) return false;
      if (filters.source === "credit_card" && filters.cardId !== "all" && t.credit_card_id !== filters.cardId) return false;
      if (search && !String(t.description).toLowerCase().includes(search)) return false;
      if (filters.dateFrom && dayOf(t.date) < filters.dateFrom) return false;
      if (filters.dateTo && dayOf(t.date) > filters.dateTo) return false;
      return true;
    };

    // Lançamentos efetivados + contas do mês ainda pendentes, como no extrato do app.
    const items = [
      ...monthTxs.map((t) => ({ kind: "tx", id: t.id, t, date: dayOf(t.date), type: t.type, status: t.type === "income" ? "received" : "paid" })),
      ...pendingBills.map((b) => ({
        kind: "bill",
        id: `bill-${b.id}-${b.due_date}`,
        b,
        date: dayOf(b.due_date),
        type: b.type === "receivable" ? "income" : "expense",
        status: b.type === "receivable" ? "to_receive" : "to_pay",
        t: { description: b.title, category: b.category, amount: b.amount, type: b.type === "receivable" ? "income" : "expense" },
      })),
    ]
      .filter((i) => (status === "all" ? true : i.status === status))
      .filter((i) => (i.kind === "tx" ? passes(i.t) : passes({ ...i.t, date: i.date, source: "manual" })))
      .sort((a, b) => b.date.localeCompare(a.date));

    const groups = [];
    for (const item of items) {
      let g = groups[groups.length - 1];
      if (!g || g.date !== item.date) {
        g = { date: item.date, items: [], total: 0 };
        groups.push(g);
      }
      g.items.push(item);
      g.total += (item.type === "income" ? 1 : -1) * Math.abs(item.t.amount);
    }

    return { received, paid, toReceive, toPay, groups, count: monthTxs.length };
  }, [transactions, bills, month, monthKey, filters, status]);

  const goAdd = useCallback(() => navigate(createPageUrl("NewTransactionOptions")), [navigate]);
  const subtitle = `${data.count} lançamento${data.count === 1 ? "" : "s"} · ${format(month, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())}`;
  const headerActions = useMemo(
    () => (
      <RoundButton onClick={() => { setSelecting((v) => !v); setSelected([]); }} label={selecting ? "Cancelar seleção" : "Selecionar"} className="hidden sm:flex">
        {selecting ? <X className="h-5 w-5" /> : <CheckSquare className="h-5 w-5" />}
      </RoundButton>
    ),
    [selecting]
  );
  usePageHeader({ title: "Transações", subtitle, onAdd: isAtLimit ? undefined : goAdd, addLabel: "Nova transação", actions: headerActions });

  // Apaga a transação e os compromissos futuros (Bill) de parcelas ligados à mesma fatura.
  const deleteWithLinkedBills = async (tx) => {
    await Transaction.delete(tx.id);
    if (tx.invoice_id) {
      const linked = await base44.entities.Bill.filter({ linked_bill_id: tx.invoice_id });
      await Promise.all(linked.map((b) => base44.entities.Bill.delete(b.id)));
    }
  };

  const removeOne = async (tx) => {
    if (!confirm(`Excluir "${tx.description}"?`)) return;
    await deleteWithLinkedBills(tx);
    setActionTx(null);
    await load(user.email);
  };

  const removeSelected = async () => {
    if (!confirm(`Excluir ${selected.length} lançamento(s)? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await Promise.all(transactions.filter((t) => selected.includes(t.id)).map(deleteWithLinkedBills));
      setSelected([]);
      setSelecting(false);
      await load(user.email);
    } finally {
      setDeleting(false);
    }
  };

  const onItemClick = (item) => {
    if (item.kind === "bill") {
      navigate(createPageUrl(item.b.type === "receivable" ? "BillsToReceive" : "BillsToPay"));
      return;
    }
    if (selecting) {
      setSelected((s) => (s.includes(item.id) ? s.filter((x) => x !== item.id) : [...s, item.id]));
      return;
    }
    setActionTx(item.t);
  };

  const filtersActive = Object.entries(filters).some(([k, v]) => k !== "search" && v && v !== "all");

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={() => load(user?.email)}>
      <PageBody>
        <MonthPill date={month} onChange={setMonth} />

        <StatCard label="Saldo do período" value={data.received - data.paid} tone={data.received - data.paid >= 0 ? "positive" : "negative"} size="lg" />
        <StatGrid>
          <StatCard label="Entradas ↑" value={data.received} tone="positive" hint={data.toReceive > 0 ? `prevista R$ ${brl(data.received + data.toReceive)}` : undefined} />
          <StatCard label="Saídas ↓" value={data.paid} hint={data.toPay > 0 ? `ainda vence R$ ${brl(data.toPay)}` : undefined} />
        </StatGrid>

        {!isPremium && transactionLimit > 0 && (
          <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${isAtLimit ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}>
            <span>
              {isAtLimit ? "Você atingiu o limite do plano gratuito" : "Plano gratuito"}: {transactions.length}/{transactionLimit} lançamentos
            </span>
            <Link to={createPageUrl("MySubscription")} className="inline-flex items-center gap-1 font-display font-semibold text-brand-700">
              <Crown className="h-4 w-4" /> Planos
            </Link>
          </div>
        )}

        <SearchBar value={filters.search} onChange={(v) => setFilters((f) => ({ ...f, search: v }))} placeholder="Buscar transação…" onFilters={() => setFiltersOpen(true)} filtersActive={filtersActive} />
        <FilterChips
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todos" },
            { value: "paid", label: "Pago" },
            { value: "to_pay", label: "A pagar" },
            { value: "received", label: "Recebido" },
            { value: "to_receive", label: "A receber" },
          ]}
        />

        {selecting && (
          <div className="sticky top-24 z-20 flex items-center justify-between rounded-full bg-slate-900 px-5 py-3 text-white shadow-lg">
            <span className="font-display text-sm">{selected.length} selecionado(s)</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setSelecting(false); setSelected([]); }} className="rounded-full px-3 py-1 text-sm text-slate-300">
                Cancelar
              </button>
              <button type="button" onClick={removeSelected} disabled={!selected.length || deleting} className="inline-flex items-center gap-1 rounded-full bg-red-500 px-4 py-1.5 text-sm font-medium disabled:opacity-50">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Excluir
              </button>
            </div>
          </div>
        )}

        {data.groups.length === 0 ? (
          <EmptyState
            title={filters.search || filtersActive || status !== "all" ? "Nada com esses filtros." : "Nenhum lançamento neste mês."}
            text={filters.search || filtersActive || status !== "all" ? "A busca ou os filtros ativos esconderam tudo." : 'Mande pro Stama no WhatsApp: "gastei 62 na farmácia".'}
            action={
              filters.search || filtersActive || status !== "all" ? (
                <PillButton tone="outline" onClick={() => { setFilters(EMPTY_FILTERS); setStatus("all"); }}>
                  limpar filtros
                </PillButton>
              ) : (
                <PillButton onClick={goAdd}>Nova transação</PillButton>
              )
            }
          />
        ) : (
          <div className="space-y-2">
            {data.groups.map((g) => (
              <div key={g.date} className="space-y-2">
                <DayHeader date={g.date} total={g.total} tone={g.total >= 0 ? "positive" : "neutral"} />
                {g.items.map((item) => {
                  const t = item.t;
                  const income = item.type === "income";
                  const note = item.kind === "tx" ? (t.credit_card_id && purchaseNotes.getNote(t.credit_card_id, t.description)) || t.notes : null;
                  const meta = [t.category, item.kind === "tx" ? PAYMENT_LABELS[t.payment_method] : item.b.recurrence && item.b.recurrence !== "none" ? "Recorrente" : null]
                    .filter(Boolean)
                    .join(" · ");
                  const badge =
                    item.status === "to_receive" ? (
                      <StatusBadge tone="orange">A receber</StatusBadge>
                    ) : item.status === "to_pay" ? (
                      <StatusBadge tone={item.date < format(new Date(), "yyyy-MM-dd") ? "red" : "orange"}>{item.date < format(new Date(), "yyyy-MM-dd") ? "Atrasada" : "A pagar"}</StatusBadge>
                    ) : null;
                  const isSelected = selected.includes(item.id);
                  return (
                    <ListItem
                      key={item.id}
                      title={t.description}
                      meta={meta}
                      amount={t.amount}
                      sign={income ? "+" : "-"}
                      amountTone={income ? "positive" : "neutral"}
                      badge={badge}
                      dotClass={isSelected ? "bg-red-500 ring-4 ring-red-100" : income ? "bg-brand-500" : "bg-slate-400"}
                      onClick={() => onItemClick(item)}
                    >
                      {note && <p className="mt-1 truncate text-sm italic text-slate-400">{note}</p>}
                    </ListItem>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center pt-2 sm:hidden">
          <PillButton tone="outline" onClick={() => { setSelecting((v) => !v); setSelected([]); }}>
            {selecting ? "Cancelar seleção" : "Selecionar vários"}
          </PillButton>
        </div>
      </PageBody>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>
          <TransactionFilters filters={filters} onFiltersChange={setFilters} cards={cards} />
          <PillButton onClick={() => setFiltersOpen(false)} className="w-full">
            Ver resultados
          </PillButton>
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionTx} onOpenChange={(o) => !o && setActionTx(null)}>
        <DialogContent className="sm:max-w-sm">
          {actionTx && (
            <>
              <DialogHeader>
                <DialogTitle>{actionTx.description}</DialogTitle>
              </DialogHeader>
              <p className={`font-display text-3xl font-bold ${actionTx.type === "income" ? "text-brand-700" : "text-slate-900 dark:text-white"}`}>
                {actionTx.type === "income" ? "+" : "-"}R$ {brl(Math.abs(actionTx.amount))}
              </p>
              <p className="text-sm uppercase tracking-[0.15em] text-slate-500">
                {[actionTx.category, PAYMENT_LABELS[actionTx.payment_method], format(new Date(dayOf(actionTx.date) + "T00:00:00"), "dd/MM/yyyy")].filter(Boolean).join(" · ")}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <PillButton tone="outline" onClick={() => { setEditing(actionTx); setActionTx(null); }}>
                  <Pencil className="h-4 w-4" /> Editar
                </PillButton>
                <PillButton tone="danger" onClick={() => removeOne(actionTx)}>
                  <Trash2 className="h-4 w-4" /> Excluir
                </PillButton>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <EditTransactionDialog transaction={editing} open={!!editing} onClose={() => setEditing(null)} onSaved={() => load(user.email)} />
    </PullToRefresh>
  );
}
