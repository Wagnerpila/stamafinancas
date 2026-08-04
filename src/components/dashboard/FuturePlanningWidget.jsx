import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreditCard, ChevronRight, Zap } from "lucide-react";
import { billAppearsInMonth, getPaidRecurringIdsForMonth } from "../lib/billRecurrence";

function formatBRL(v) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FuturePlanningWidget({ bills = [] }) {
  const months = useMemo(() =>
    Array.from({ length: 3 }, (_, i) => addMonths(startOfMonth(new Date()), i)),
    []
  );

  const summary = useMemo(() => {
    return months.map(m => {
      const key = format(m, "yyyy-MM");
      const label = format(m, "MMM/yy", { locale: ptBR });
      // IDs de contas recorrentes que já têm cópia paga neste mês específico — mesma lógica
      // (e mesma fonte) usada em BillsToPay/BillsToReceive, evitando reimplementar aqui um
      // cálculo de recorrência divergente que só cobria "monthly" e ignorava trimestral/anual.
      const paidIds = getPaidRecurringIdsForMonth(bills, m);

      // Parcelas futuras de cartão
      const installmentBills = bills.filter(b => {
        if (b.type !== "payable" || b.status === "paid") return false;
        if (b.category !== "credit_card") return false;
        if (!b.due_date) return false;
        const d = new Date(b.due_date.slice(0, 10) + "T00:00:00");
        if (isNaN(d)) return false;
        return format(startOfMonth(d), "yyyy-MM") === key;
      });
      const ccTotal = installmentBills.reduce((s, b) => s + (b.amount || 0), 0);

      // Contas recorrentes (mensal/trimestral/anual) que caem neste mês, excluindo as já pagas
      const recurringBills = bills.filter(b => {
        if (b.type !== "payable" || b.status === "paid") return false;
        if (!b.recurrence || b.recurrence === "none") return false;
        if (paidIds.has(b.id)) return false; // já paga neste mês
        return billAppearsInMonth(b, m);
      });
      const billTotal = recurringBills.reduce((s, b) => s + (b.amount || 0), 0);

      const total = ccTotal + billTotal;
      return { key, label, ccTotal, recurring: billTotal, total };
    });
  }, [months, bills]);

  return (
    <Card className="border-0 shadow-lg border-l-4 border-indigo-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold dark:text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-500" />
            Compromissos Futuros
          </CardTitle>
          <Link to={createPageUrl("FuturePlanning")}>
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-indigo-600 dark:text-indigo-400">
              Ver detalhes <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-2">
          {summary.map((s) => (
            <div key={s.key} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">{s.label}</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">R$ {formatBRL(s.total)}</p>
              <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                <p className="flex items-center justify-center gap-1">
                  <CreditCard className="w-2.5 h-2.5" /> {formatBRL(s.ccTotal)}
                </p>
                <p className="flex items-center justify-center gap-1">
                  <Zap className="w-2.5 h-2.5" /> {formatBRL(s.recurring)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}