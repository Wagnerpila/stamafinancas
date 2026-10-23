import React, { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BillForm from "./BillForm";
import BillsList from "./BillsList";
import { AgentBubble } from "../agents/agents";
import { usePageHeader, PageBody, MonthPill, StatCard, StatGrid, SearchBar, FilterChips, PillButton, brl } from "../stama/kit";

const dayOf = (raw) => String(raw || "").slice(0, 10);

// Tela de contas a pagar ou a receber (BillsToPay / BillsToReceive): as páginas cuidam de dados e
// regras de baixa; aqui fica só a apresentação.
export default function BillsPageView({
  type,
  loading,
  bills,
  selectedDate,
  onChangeDate,
  yearMode,
  onToggleYearMode,
  showForm,
  editingBill,
  onOpenNew,
  onCloseForm,
  onSubmit,
  onEdit,
  onDelete,
  onMarkAsPaid,
  getPurchaseNote,
}) {
  const [status, setStatus] = useState("open");
  const [search, setSearch] = useState("");
  const payable = type === "payable";
  const today = format(new Date(), "yyyy-MM-dd");

  const data = useMemo(() => {
    const open = bills.filter((b) => b.status !== "paid");
    const overdue = open.filter((b) => dayOf(b.due_date) < today);
    const paid = bills.filter((b) => b.status === "paid");
    const q = search.toLowerCase();
    const list = bills
      .filter((b) => (status === "open" ? b.status !== "paid" : status === "overdue" ? b.status !== "paid" && dayOf(b.due_date) < today : status === "paid" ? b.status === "paid" : true))
      .filter((b) => !q || String(b.title).toLowerCase().includes(q));
    const sum = (arr) => arr.reduce((s, b) => s + b.amount, 0);
    return { open, overdue, paid, list, openTotal: sum(open), overdueTotal: sum(overdue), paidTotal: sum(paid) };
  }, [bills, status, search, today]);

  const period = yearMode ? `ano de ${selectedDate.getFullYear()}` : format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });
  usePageHeader({
    title: payable ? "Contas a pagar" : "Contas a receber",
    subtitle: `${bills.length} conta${bills.length === 1 ? "" : "s"} · ${period.replace(/^./, (c) => c.toUpperCase())}`,
    onAdd: onOpenNew,
    addLabel: payable ? "Nova conta a pagar" : "Nova conta a receber",
  });

  const onChips = useCallback(setStatus, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <PageBody>
      <MonthPill
        date={selectedDate}
        onChange={onChangeDate}
        extra={
          <button
            type="button"
            onClick={onToggleYearMode}
            className={`rounded-full px-4 py-2.5 font-display text-sm font-medium ${yearMode ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
          >
            Ano
          </button>
        }
      />

      <StatCard label={payable ? "Ainda a pagar" : "Ainda a receber"} value={data.openTotal} tone={payable ? "neutral" : "positive"} size="lg" hint={`${data.open.length} em aberto`} />
      <StatGrid>
        <StatCard label="Atrasadas" value={data.overdueTotal} tone={data.overdue.length ? "negative" : "neutral"} hint={`${data.overdue.length} conta${data.overdue.length === 1 ? "" : "s"}`} />
        <StatCard label={payable ? "Pagas" : "Recebidas"} value={data.paidTotal} tone="positive" hint={`${data.paid.length} no período`} />
      </StatGrid>

      {data.overdue.length > 0 && (
        <AgentBubble agent="bia">
          você tem <strong>{data.overdue.length} conta{data.overdue.length > 1 ? "s" : ""} atrasada{data.overdue.length > 1 ? "s" : ""}</strong> somando <strong>R$ {brl(data.overdueTotal)}</strong>.
          {payable ? " Quando pagar, me avisa no WhatsApp que eu dou baixa." : " Quando cair, me avisa que eu dou baixa."}
        </AgentBubble>
      )}

      <SearchBar value={search} onChange={setSearch} placeholder="Buscar conta…" />
      <FilterChips
        value={status}
        onChange={onChips}
        options={[
          { value: "open", label: "Em aberto", count: data.open.length },
          { value: "overdue", label: "Atrasadas", count: data.overdue.length },
          { value: "paid", label: payable ? "Pagas" : "Recebidas", count: data.paid.length },
          { value: "all", label: "Todas" },
        ]}
      />

      <BillsList
        bills={data.list}
        onEdit={onEdit}
        onDelete={onDelete}
        onMarkAsPaid={onMarkAsPaid}
        type={type}
        getPurchaseNote={getPurchaseNote}
        emptyAction={<PillButton onClick={onOpenNew}>{payable ? "Nova conta a pagar" : "Nova conta a receber"}</PillButton>}
      />

      <Dialog open={showForm} onOpenChange={(open) => !open && onCloseForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBill ? (payable ? "Editar conta a pagar" : "Editar conta a receber") : payable ? "Nova conta a pagar" : "Nova conta a receber"}</DialogTitle>
          </DialogHeader>
          <BillForm bill={editingBill} onSubmit={onSubmit} onCancel={onCloseForm} billType={type} />
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
