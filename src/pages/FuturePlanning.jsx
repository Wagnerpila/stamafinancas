import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import {
  AlertTriangle, CreditCard, TrendingDown, Calendar, ArrowLeft,
  DollarSign, Zap, LayoutList, CalendarRange, MessageSquare
} from "lucide-react";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import useRefreshOnForeground from "../hooks/useRefreshOnForeground";

const MONTHS_AHEAD = 6;
const MONTHS_MAX = 36; // máximo de meses a considerar para "todos"

function getMonthKey(date) {
  return format(date, "yyyy-MM");
}

function formatBRL(v) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthLabel(date) {
  return format(date, "MMM/yy", { locale: ptBR });
}

export default function FuturePlanning() {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [user, setUser] = useState(null);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [incomeByMonth, setIncomeByMonth] = useState({});
  const [showAllMonths, setShowAllMonths] = useState(false);

  const load = async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);
      const [bls, txs, receivableBills] = await Promise.all([
        base44.entities.Bill.filter({ created_by: u.email }),
        base44.entities.Transaction.filter({ created_by: u.email, type: "income" }),
        base44.entities.Bill.filter({ created_by: u.email, type: "receivable" }),
      ]);
      setBills(bls);
      // Agrupa receitas por mês: transações de receita + contas a receber (pagas ou pendentes)
      const now = new Date();
      const incomeByMonth = {};

      // 1. Transações de receita lançadas
      txs.forEach(t => {
        // t.date vem da API como ISO completo ("...T12:00:00.000Z"), não "YYYY-MM-DD" puro —
        // concatenar "T00:00:00" nele direto formava uma data inválida.
        const d = t.date ? new Date(String(t.date).slice(0, 10) + "T00:00:00") : new Date(t.created_date);
        const key = format(d, "yyyy-MM");
        incomeByMonth[key] = (incomeByMonth[key] || 0) + (t.amount || 0);
      });

        // 2. Contas a receber mensais recorrentes e pendentes (salário, etc.)
        // Só adiciona se não há transação de receita já lançada nesse mês (evita dupla contagem)
        receivableBills.forEach(b => {
          if (!b.due_date || !b.amount) return;
          const d = new Date(b.due_date.slice(0, 10) + "T00:00:00");
          if (isNaN(d)) return;

          if (b.recurrence === "monthly") {
            for (let i = -6; i < 12; i++) {
              const projected = addMonths(startOfMonth(d), i);
              const key = format(projected, "yyyy-MM");
              // Se já há receita lançada nesse mês, não sobrescreve
              if (!incomeByMonth[key]) {
                incomeByMonth[key] = b.amount;
              }
            }
          } else {
            const key = format(d, "yyyy-MM");
            if (!incomeByMonth[key]) {
              incomeByMonth[key] = b.amount;
            }
          }
        });

        // Receita do mês atual como referência para meses futuros sem dados
        const currentKey = format(now, "yyyy-MM");
        const currentMonthIncome = incomeByMonth[currentKey] || 0;
      setMonthlyIncome(currentMonthIncome);
      setIncomeByMonth(incomeByMonth);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Reconsulta ao voltar de outra tela via bfcache/segundo plano (comum no mobile) — senão a
  // tela fica presa em dados de antes de, por exemplo, importar uma fatura com novas parcelas.
  useRefreshOnForeground(load);

  // Build months array: 6 próximos ou todos com lançamentos
  const months = useMemo(() => {
    const now = new Date();
    if (!showAllMonths) {
      return Array.from({ length: MONTHS_AHEAD }, (_, i) => addMonths(startOfMonth(now), i));
    }
    // Todos os meses que possuem algum bill pendente (até MONTHS_MAX meses à frente)
    const allMonths = Array.from({ length: MONTHS_MAX }, (_, i) => addMonths(startOfMonth(now), i));
    const keysWithData = new Set();
    bills.forEach(b => {
      if (!b.due_date || b.status === "paid") return;
      try {
        const d = new Date(b.due_date.slice(0, 10) + "T00:00:00");
        if (!isNaN(d)) keysWithData.add(format(startOfMonth(d), "yyyy-MM"));
      } catch { /* skip */ }
    });
    // Sempre inclui meses recorrentes futuros
    bills.filter(b => b.type === "payable" && b.recurrence === "monthly" && b.status !== "paid").forEach(() => {
      allMonths.forEach(m => keysWithData.add(format(m, "yyyy-MM")));
    });
    return allMonths.filter(m => keysWithData.has(format(m, "yyyy-MM")));
  }, [showAllMonths, bills]);

  // Parcelas futuras de cartão: Bills com category="credit_card" e pending
  const installmentsByMonth = useMemo(() => {
    const map = {};
    months.forEach(m => { map[getMonthKey(m)] = 0; });

    bills.forEach(b => {
      if (b.type !== "payable" || b.status === "paid" || b.category !== "credit_card") return;
      if (!b.due_date) return;
      try {
        const d = new Date(b.due_date.slice(0, 10) + "T00:00:00");
        if (isNaN(d)) return;
        const key = format(startOfMonth(d), "yyyy-MM");
        if (map[key] !== undefined) {
          map[key] += b.amount || 0;
        }
      } catch { /* skip */ }
    });

    return map;
  }, [bills, months]);

  // Contas mensais recorrentes (não de cartão)
  const recurringBillsByMonth = useMemo(() => {
    const map = {};
    months.forEach(m => { map[getMonthKey(m)] = 0; });

    // IDs de contas recorrentes que já foram pagas em cada mês
    // (cópia paga: status="paid", recurrence="none", linked_bill_id=<id_original>)
    const paidByMonth = {}; // { "2026-05": Set([billId, ...]) }
    bills.forEach(b => {
      if (b.status === "paid" && (!b.recurrence || b.recurrence === "none") && b.linked_bill_id && b.due_date) {
        const d = new Date(b.due_date.slice(0, 10) + "T00:00:00");
        if (!isNaN(d)) {
          const key = format(startOfMonth(d), "yyyy-MM");
          if (!paidByMonth[key]) paidByMonth[key] = new Set();
          paidByMonth[key].add(b.linked_bill_id);
        }
      }
    });

    const monthlyBills = bills.filter(b =>
      b.type === "payable" &&
      b.recurrence === "monthly" &&
      b.status !== "paid"
    );

    months.forEach(m => {
      const key = getMonthKey(m);
      const paidIds = paidByMonth[key] || new Set();
      monthlyBills.forEach(b => {
        // Não conta se já existe cópia paga neste mês
        if (!paidIds.has(b.id)) {
          map[key] += b.amount || 0;
        }
      });
    });

    return map;
  }, [bills, months]);

  // Para cada mês: usa a receita real daquele mês se existir, senão usa a do mês atual como referência
  const getBudgetForMonth = (monthKey) => {
    if (incomeByMonth[monthKey] && incomeByMonth[monthKey] > 0) return incomeByMonth[monthKey];
    if (monthlyIncome > 0) return monthlyIncome;
    return 0;
  };

  const chartData = useMemo(() => {
    return months.map(m => {
      const key = getMonthKey(m);
      const installments = installmentsByMonth[key] || 0;
      const recurring = recurringBillsByMonth[key] || 0;
      const budget = getBudgetForMonth(key);
      return {
        month: getMonthLabel(m),
        key,
        installments,
        recurring,
        total: installments + recurring,
        budget,
      };
    });
  }, [months, installmentsByMonth, recurringBillsByMonth, incomeByMonth, monthlyIncome, showAllMonths]);

  // IDs de recorrentes já pagos no mês atual (cópia paga gerada)
  const paidRecurringIdsCurrentMonth = useMemo(() => {
    const currentKey = format(startOfMonth(new Date()), "yyyy-MM");
    const ids = new Set();
    bills.forEach(b => {
      if (b.status === "paid" && (!b.recurrence || b.recurrence === "none") && b.linked_bill_id && b.due_date) {
        const d = new Date(b.due_date.slice(0, 10) + "T00:00:00");
        if (!isNaN(d) && format(startOfMonth(d), "yyyy-MM") === currentKey) {
          ids.add(b.linked_bill_id);
        }
      }
    });
    return ids;
  }, [bills]);

  // Monthly recurring bills list (for detail display) - exclui os já pagos no mês atual
  const monthlyRecurringBills = useMemo(() =>
    bills.filter(b =>
      b.type === "payable" &&
      b.recurrence === "monthly" &&
      b.status !== "paid" &&
      !paidRecurringIdsCurrentMonth.has(b.id)
    ),
    [bills, paidRecurringIdsCurrentMonth]
  );

  // Pending bills for next 3 months
  const upcomingBills = useMemo(() => {
    const now = new Date();
    const end = addMonths(now, 3);
    return bills
      .filter(b => {
        if (!b.due_date || b.status === "paid") return false;
        try {
          const d = new Date(b.due_date.slice(0, 10) + "T00:00:00");
          if (isNaN(d)) return false;
          return d >= now && d <= end;
        } catch { return false; }
      })
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  }, [bills]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <Link to={createPageUrl("Dashboard")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Planejamento Futuro</h1>
          <p className="text-slate-600 dark:text-slate-300">Visibilidade dos compromissos financeiros dos próximos meses</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant={!showAllMonths ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAllMonths(false)}
            className="gap-1.5"
          >
            <LayoutList className="w-4 h-4" /> Próximos 6 meses
          </Button>
          <Button
            variant={showAllMonths ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAllMonths(true)}
            className="gap-1.5"
          >
            <CalendarRange className="w-4 h-4" /> Todos os meses
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {chartData.slice(0, showAllMonths ? chartData.length : 3).map((d, i) => {
          const isCritical = d.budget > 0 && d.total > 0 && (d.total / d.budget) >= 0.7;
          return (
            <motion.div key={d.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className={`border-0 shadow-lg ${isCritical ? "border-l-4 border-red-500" : "border-l-4 border-blue-500"}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase">{d.month}</span>
                    {isCritical && <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">⚠ Alto</Badge>}
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">R$ {formatBRL(d.total)}</p>
                  <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> Parcelas CC</span>
                      <span>R$ {formatBRL(d.installments)}</span>
                    </div>
                    {d.recurring > 0 && (
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Contas mensais recorrentes</span>
                          <span>R$ {formatBRL(d.recurring)}</span>
                        </div>
                        {monthlyRecurringBills.map(b => (
                          <div key={b.id} className="flex justify-between pl-3 text-slate-400 dark:text-slate-500">
                            <span>• {b.title}{b.notes ? ` — ${b.notes}` : ""}</span>
                            <span>R$ {formatBRL(b.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {d.recurring === 0 && (
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Contas mensais recorrentes</span>
                        <span>R$ 0,00</span>
                      </div>
                    )}
                  </div>
                  {d.budget > 0 && (
                    <div className="mt-3">
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${isCritical ? "bg-red-500" : "bg-blue-500"}`}
                          style={{ width: `${Math.min((d.total / d.budget) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {Math.round((d.total / d.budget) * 100)}% da receita comprometida
                        {d.budget > 0 && <span className="text-slate-400"> (ref: R$ {formatBRL(d.budget)})</span>}
                      </p>
                    </div>
                  )}
                  {d.budget === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">
                      Lance receitas para ver o % comprometido
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Chart */}
      <Card className="border-0 shadow-lg mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-white">
            <TrendingDown className="w-5 h-5 text-red-500" />
            {showAllMonths ? `Tendência de Compromissos — ${months.length} Meses` : "Tendência de Compromissos — Próximos 6 Meses"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `R$ ${formatBRL(v)}`} />
              <Legend />
              <Bar dataKey="installments" name="Parcelas CC" fill="#6366f1" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="recurring" name="Contas Fixas (est.)" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
          {monthlyIncome <= 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2">
              Lance receitas para ver o percentual comprometido.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upcoming bills */}
      {upcomingBills.length > 0 && (
        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <Calendar className="w-5 h-5 text-orange-500" />
              Contas a Vencer nos Próximos 90 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingBills.map(bill => {
                const dueDate = new Date(bill.due_date.slice(0, 10) + "T00:00:00");
                const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
                const isUrgent = daysLeft <= 7;
                return (
                  <div key={bill.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 dark:text-white text-sm">{bill.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Vence em {format(dueDate, "dd/MM/yyyy")} • {daysLeft} dias
                      </p>
                      {bill.notes && (
                        <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 italic mt-0.5">
                          <MessageSquare className="w-3 h-3 shrink-0" /> {bill.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-red-600 dark:text-red-400 text-sm">R$ {formatBRL(bill.amount)}</span>
                      {isUrgent && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert */}
      {chartData[0]?.budget > 0 && chartData[0]?.total > 0 && (chartData[0].total / chartData[0].budget) >= 0.7 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
          <Card className="border-0 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 shadow-lg">
            <CardContent className="p-5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-300">Atenção: alto comprometimento de renda</p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  Seus compromissos fixos + parcelas do mês atual representam{" "}
                  <strong>{Math.round((chartData[0].total / chartData[0].budget) * 100)}%</strong> da sua receita.
                  Evite novas despesas para manter a saúde financeira.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* CTA */}
      <div className="flex flex-wrap gap-3 mt-4">
        <Link to={createPageUrl("CreditCards")}>
          <Button variant="outline" className="gap-2">
            <CreditCard className="w-4 h-4" /> Gerenciar Cartões
          </Button>
        </Link>
        <Link to={createPageUrl("BillsToPay")}>
          <Button variant="outline" className="gap-2">
            <DollarSign className="w-4 h-4" /> Contas a Pagar
          </Button>
        </Link>
      </div>
    </div>
  );
}