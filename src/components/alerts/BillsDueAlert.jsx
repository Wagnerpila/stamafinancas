import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard, Receipt } from "lucide-react";
import { getTodayBrazil } from "@/components/lib/dateUtils";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatBRL(v) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBR(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

export default function BillsDueAlert() {
  const [alertItems, setAlertItems] = useState([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const check = async () => {
      try {
        const user = await base44.auth.me();
        if (!user) return;

        const today = getTodayBrazil();
        const in2Days = addDays(today, 2);

        // 1. Bills (contas a pagar) vencendo hoje ou nos próximos 2 dias
        const allBills = await base44.entities.Bill.filter({
          type: "payable",
          status: "pending",
          created_by: user.email
        });

        const dueBills = allBills.filter(b => {
          const due = (b.due_date || "").split("T")[0];
          return due >= today && due <= in2Days;
        });

        const billItems = dueBills.map(b => ({
          id: b.id,
          label: b.title,
          amount: b.amount,
          due: b.due_date,
          type: "bill",
          isToday: b.due_date.split("T")[0] === today,
        }));

        // 2. Faturas de cartão pendentes de pagamento (status closed ou open, não paid)
        const allInvoices = await base44.entities.CreditCardInvoice.filter({
          created_by: user.email
        });
        const allCards = await base44.entities.CreditCard.list();
        const cardMap = {};
        allCards.forEach(c => { cardMap[c.id] = c.name; });

        const pendingInvoices = allInvoices.filter(inv =>
          inv.status === "closed" || inv.status === "open" || inv.status === "overdue"
        );

        const invoiceItems = pendingInvoices.map(inv => {
          const due = (inv.due_date || "").split("T")[0];
          return {
            id: inv.id,
            label: `Fatura ${inv.reference_month} — ${cardMap[inv.card_id] || "Cartão"}`,
            amount: inv.total_amount,
            due: inv.due_date,
            type: "invoice",
            isToday: due === today,
            isOverdue: due < today,
          };
        }).filter(inv => inv.due <= in2Days || inv.isOverdue);

        const all = [...billItems, ...invoiceItems];
        if (all.length > 0) {
          setAlertItems(all);
          setOpen(true);
        }
      } catch (e) {
        console.error("Erro ao verificar alertas:", e);
      }
    };

    check();
  }, []);

  if (alertItems.length === 0) return null;

  const total = alertItems.reduce((s, i) => s + (i.amount || 0), 0);

  const getUrgencyLabel = (item) => {
    if (item.isOverdue) return { text: "Em atraso", color: "text-red-600 bg-red-50" };
    if (item.isToday) return { text: "Vence hoje", color: "text-orange-600 bg-orange-50" };
    return { text: "Vence em breve", color: "text-yellow-700 bg-yellow-50" };
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <AlertDialogTitle className="text-xl">
              Pagamentos Pendentes
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            Você tem {alertItems.length} compromisso{alertItems.length > 1 ? "s" : ""} que precisam de atenção:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 my-3">
          {alertItems.map((item) => {
            const urgency = getUrgencyLabel(item);
            return (
              <div key={item.id} className="flex items-start justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-start gap-2 min-w-0">
                  {item.type === "invoice"
                    ? <CreditCard className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    : <Receipt className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                  }
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-100 text-sm leading-snug">{item.label}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${urgency.color}`}>{urgency.text}</span>
                      {item.due && <span className="text-xs text-slate-400">{formatDateBR(item.due)}</span>}
                    </div>
                  </div>
                </div>
                <span className="font-bold text-orange-600 text-sm flex-shrink-0">
                  R$ {formatBRL(item.amount)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Total pendente:</span>
            <span className="font-bold text-orange-600 text-lg">R$ {formatBRL(total)}</span>
          </div>
        </div>

        <AlertDialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          <Button onClick={() => { setOpen(false); navigate(createPageUrl("BillsToPay")); }} className="bg-orange-600 hover:bg-orange-700">
            Ver Contas
          </Button>
          <Button onClick={() => { setOpen(false); navigate(createPageUrl("CreditCards")); }} className="bg-blue-600 hover:bg-blue-700">
            Ver Faturas
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}