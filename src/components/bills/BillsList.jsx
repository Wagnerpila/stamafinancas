import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DayHeader, ListItem, StatusBadge, EmptyState, PillButton, brl } from "../stama/kit";

const dayOf = (raw) => String(raw || "").slice(0, 10);

// Lista de contas a pagar/receber agrupada por vencimento; tocar abre as ações (baixa, editar,
// excluir).
export default function BillsList({ bills, onEdit, onDelete, onMarkAsPaid, type, getPurchaseNote, emptyAction }) {
  const [active, setActive] = useState(null);
  const today = format(new Date(), "yyyy-MM-dd");

  // Placeholder de parcela futura de cartão (category="credit_card") — o comentário de
  // identificação (ex: "Sofá") mora em PurchaseNote (card_id + título), não no campo notes; cai
  // pro notes normal (auto-gerado, ex: "Conta com vencimento em...") pras demais contas.
  const resolveNotes = (bill) => (bill.category === "credit_card" && bill.card_id && getPurchaseNote?.(bill.card_id, bill.title)) || bill.notes;

  if (bills.length === 0) {
    return <EmptyState title="Nenhuma conta por aqui." text={type === "payable" ? 'Pelo WhatsApp: "aluguel 1500 todo dia 10".' : 'Pelo WhatsApp: "sexta vou receber 800 do cliente".'} action={emptyAction} />;
  }

  const groups = [];
  for (const bill of bills) {
    const day = dayOf(bill.due_date);
    let g = groups[groups.length - 1];
    if (!g || g.date !== day) {
      g = { date: day, items: [], total: 0 };
      groups.push(g);
    }
    g.items.push(bill);
    g.total += bill.amount;
  }

  const statusOf = (bill) => {
    if (bill.status === "paid") return type === "payable" ? ["Paga", "green"] : ["Recebida", "green"];
    if (dayOf(bill.due_date) < today) return ["Atrasada", "red"];
    if (dayOf(bill.due_date) === today) return ["Vence hoje", "orange"];
    return type === "payable" ? ["A pagar", "orange"] : ["A receber", "orange"];
  };

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.date} className="space-y-2">
          <DayHeader date={g.date} total={g.total} tone={type === "payable" ? "neutral" : "positive"} />
          {g.items.map((bill) => {
            const [label, tone] = statusOf(bill);
            const note = resolveNotes(bill);
            return (
              <ListItem
                key={bill._virtual ? `${bill.id}-${bill.due_date}` : bill.id}
                title={bill.title}
                meta={[bill.category === "credit_card" ? "Cartão" : bill.category, bill.recurrence && bill.recurrence !== "none" ? "Recorrente" : null].filter(Boolean).join(" · ")}
                amount={bill.amount}
                sign={type === "receivable" ? "+" : ""}
                amountTone={type === "receivable" ? "positive" : "neutral"}
                badge={<StatusBadge tone={tone}>{label}</StatusBadge>}
                dotClass={bill.status === "paid" ? "bg-brand-500" : tone === "red" ? "bg-red-500" : "bg-slate-400"}
                onClick={() => setActive(bill)}
              >
                {note && <p className="mt-1 truncate text-sm italic text-slate-400">{note}</p>}
              </ListItem>
            );
          })}
        </div>
      ))}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="sm:max-w-sm">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{active.title}</DialogTitle>
              </DialogHeader>
              <p className={`font-display text-3xl font-bold ${type === "receivable" ? "text-brand-700" : "text-slate-900 dark:text-white"}`}>R$ {brl(active.amount)}</p>
              <p className="text-sm uppercase tracking-[0.15em] text-slate-500">
                Vence {format(parseISO(dayOf(active.due_date)), "dd 'de' MMMM", { locale: ptBR })}
                {active.recurrence && active.recurrence !== "none" ? " · recorrente" : ""}
              </p>
              <div className="grid gap-2 pt-2">
                {active.status !== "paid" && (
                  <PillButton
                    onClick={() => {
                      const bill = active;
                      setActive(null);
                      onMarkAsPaid(bill);
                    }}
                  >
                    <CheckCircle className="h-4 w-4" /> {type === "payable" ? "Marcar como paga" : "Marcar como recebida"}
                  </PillButton>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <PillButton
                    tone="outline"
                    onClick={() => {
                      const bill = active;
                      setActive(null);
                      onEdit(bill);
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </PillButton>
                  <PillButton
                    tone="danger"
                    onClick={() => {
                      const bill = active;
                      setActive(null);
                      onDelete(bill.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </PillButton>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
