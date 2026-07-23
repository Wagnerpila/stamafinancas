import React, { useMemo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronRight, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

function formatBRL(v) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function budgetGradient(pctOfLimit) {
  const p = Math.min(pctOfLimit, 100) / 100;
  let r, g, b;
  if (p < 0.5) {
    const t = p / 0.5;
    r = Math.round(34 + (234 - 34) * t);
    g = Math.round(197 + (179 - 197) * t);
    b = Math.round(94 + (8 - 94) * t);
  } else {
    const t = (p - 0.5) / 0.5;
    r = Math.round(234 + (239 - 234) * t);
    g = Math.round(179 + (68 - 179) * t);
    b = Math.round(8 + (68 - 8) * t);
  }
  return `rgb(${r},${g},${b})`;
}

export default function CategorySpendingCompact({ transactions = [], creditCardTxs = [], budgets = [], selectedDate }) {
  const [dbCategories, setDbCategories] = useState([]);

  useEffect(() => {
    base44.auth.me().then(u => {
      base44.entities.TransactionCategory.filter({ created_by: u.email })
        .then(cats => setDbCategories(cats.filter(c => c.active !== false && c.type === "expense")))
        .catch(() => {});
    }).catch(() => {});
  }, []);

  const spending = useMemo(() => {
    const ref = selectedDate || new Date();
    const map = {};

    // Transações normais (excluindo vale alimentação)
    transactions.forEach(t => {
      if (t.type !== "expense" || t.is_food_voucher) return;
      // Ignorar apenas pagamentos de fatura (têm invoice_id E categoria é o pagamento em si)
      // Manter despesas normais que possam ter invoice_id por outros motivos
      const raw = t.date || t.created_date;
      const d = raw && raw.length === 10 ? new Date(raw + "T00:00:00") : new Date(raw);
      if (!d || isNaN(d)) return;
      if (d.getMonth() !== ref.getMonth() || d.getFullYear() !== ref.getFullYear()) return;
      const key = t.category || "Outros";
      map[key] = (map[key] || 0) + Math.abs(t.amount || 0);
    });

    // Transações de cartão: sempre contabilizar pela data da compra
    creditCardTxs.forEach(t => {
      const raw = t.purchase_date || t.created_date;
      const d = raw && raw.length === 10 ? new Date(raw + "T00:00:00") : new Date(raw);
      if (!d || isNaN(d)) return;
      if (d.getMonth() !== ref.getMonth() || d.getFullYear() !== ref.getFullYear()) return;
      const key = t.category || "Outros";
      map[key] = (map[key] || 0) + Math.abs(t.amount || 0);
    });

    return map;
  }, [transactions, creditCardTxs, selectedDate]);

  const totalSpent = Object.values(spending).reduce((s, v) => s + v, 0);

  // Monta lista de categorias visíveis: une categorias do banco com as que aparecem nas transações
  const visible = useMemo(() => {
    const catMap = {};

    // Categorias do banco (com ícone e cor)
    dbCategories.forEach(c => { catMap[c.name] = { name: c.name, icon: c.icon, color: c.color }; });

    // Labels padrão para categorias do enum (fallback para quando foram salvas pelo código antigo)
    const enumLabels = {
      food: { name: "Alimentação", icon: "🍽️", color: "#f97316" },
      transport: { name: "Transporte", icon: "🚗", color: "#f59e0b" },
      health: { name: "Saúde", icon: "❤️", color: "#ec4899" },
      education: { name: "Educação", icon: "📚", color: "#8b5cf6" },
      entertainment: { name: "Lazer", icon: "🎬", color: "#06b6d4" },
      shopping: { name: "Compras", icon: "🛍️", color: "#2563eb" },
      bills: { name: "Contas", icon: "📄", color: "#16a34a" },
      rent: { name: "Aluguel", icon: "🏠", color: "#9333ea" },
      other_expense: { name: "Outras Despesas", icon: "📦", color: "#64748b" },
    };

    // Categorias que aparecem nos gastos mas não estão no banco
    Object.keys(spending).forEach(key => {
      if (!catMap[key]) {
        // Tenta o mapa de enum primeiro, senão usa o nome bruto
        catMap[key] = enumLabels[key] || { name: key, icon: "📦", color: "#64748b" };
      }
    });

    // Categorias com budget mas não nos gastos
    budgets.forEach(b => {
      if (!catMap[b.category]) catMap[b.category] = { name: b.category, icon: "📦", color: "#64748b" };
    });

    return Object.values(catMap)
      .filter(cat => (spending[cat.name] || 0) > 0 || budgets.some(b => b.category === cat.name))
      .sort((a, b) => (spending[b.name] || 0) - (spending[a.name] || 0));
  }, [dbCategories, spending, budgets]);

  if (visible.length === 0) return null;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold dark:text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-500" />
            Gastos por Categoria
          </CardTitle>
          <Link to={createPageUrl("TransactionCategories")}>
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-blue-600 dark:text-blue-400">
              Ver todas <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map(cat => {
            const spent = spending[cat.name] || 0;
            const pct = totalSpent > 0 ? (spent / totalSpent) * 100 : 0;
            const budget = budgets.find(b => b.category === cat.name);
            const limit = budget?.monthly_limit;
            const isOver = limit && spent > limit;
            const overAmount = isOver ? spent - limit : 0;
            const limitPct = limit && limit > 0 ? (spent / limit) * 100 : null;
            const barColor = limitPct !== null ? budgetGradient(limitPct) : (cat.color || "#3b82f6");
            const barWidth = limit && limit > 0 ? Math.min((spent / limit) * 100, 100) : Math.min(pct, 100);
            return (
              <div key={cat.name} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: (isOver ? "#ef4444" : (cat.color || "#3b82f6")) + "22" }}
                  >
                    {cat.icon || "📦"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{cat.name}</p>
                    <p className="text-xs font-medium" style={{ color: isOver ? "#ef4444" : (cat.color || "#3b82f6") }}>
                      R$ {formatBRL(spent)}
                      {limit && <span className="text-slate-400 dark:text-slate-500"> / R$ {formatBRL(limit)}</span>}
                    </p>
                  </div>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                  />
                </div>
                {isOver && (
                  <p className="text-xs text-red-500 mt-1.5">⚠️ +R$ {formatBRL(overAmount)} acima do limite</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}