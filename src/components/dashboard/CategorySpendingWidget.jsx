import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tag, ChevronRight } from "lucide-react";
import { parseISO, isSameMonth } from "date-fns";

function formatBRL(v) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CategorySpendingWidget({ transactions = [], user }) {
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.TransactionCategory.list(),
      user?.email ? base44.entities.CategoryBudget.filter({ created_by: user.email }) : Promise.resolve([])
    ]).then(([cats, bgs]) => {
      setCategories(cats.filter(c => c.active !== false && c.type === "expense"));
      setBudgets(bgs);
    }).catch(() => {});
  }, [user]);

  const spending = useMemo(() => {
    const now = new Date();
    const monthTxs = transactions.filter(t => {
      if (t.type !== "expense" || t.is_food_voucher) return false;
      const d = parseISO(t.date || t.created_date);
      return isSameMonth(d, now);
    });

    const map = {};
    monthTxs.forEach(t => {
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount || 0);
    });
    return map;
  }, [transactions]);

  const totalSpent = Object.values(spending).reduce((s, v) => s + v, 0);

  // Only show categories that have spending this month
  const activeCategories = categories
    .filter(c => spending[c.name] > 0)
    .sort((a, b) => (spending[b.name] || 0) - (spending[a.name] || 0))
    .slice(0, 6);

  if (activeCategories.length === 0) return null;

  return (
    <Card className="border-0 shadow-lg border-l-4 border-emerald-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold dark:text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-500" />
            Gastos por Categoria — Mês Atual
          </CardTitle>
          <Link to={createPageUrl("TransactionCategories")}>
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-emerald-600 dark:text-emerald-400">
              Ver todas <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {activeCategories.map(cat => {
          const spent = spending[cat.name] || 0;
          const pct = totalSpent > 0 ? (spent / totalSpent) * 100 : 0;
          const budget = budgets.find(b => b.category === cat.name);
          const limit = budget?.monthly_limit;
          const isOver = limit && spent > limit;
          const overAmount = isOver ? spent - limit : 0;
          return (
            <div key={cat.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <span>{cat.icon || "📦"}</span>
                  {cat.name}
                </span>
                <span className={`text-sm font-semibold ${isOver ? "text-red-500" : "text-slate-700 dark:text-slate-300"}`}>
                  R$ {formatBRL(spent)}
                  {limit && <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">/ R$ {formatBRL(limit)}</span>}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: isOver ? "#ef4444" : (cat.color || "#3b82f6")
                  }}
                />
              </div>
              {isOver && (
                <p className="text-xs text-red-500 mt-1">
                  ⚠️ Limite ultrapassado em R$ {formatBRL(overAmount)}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}