import React, { useState } from "react";
import { ChevronDown, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatBRL(v) {
  return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBR(dateStr) {
  if (!dateStr) return "";
  const raw = String(dateStr).slice(0, 10);
  const d = new Date(raw + "T00:00:00");
  if (isNaN(d)) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Widget compacto de "valores por X" (mesmo visual do "Gastos por Categoria" do Dashboard):
// cards clicáveis com ícone/valor/barra de proporção, que expandem pra mostrar os lançamentos
// que compõem o total. Reutilizado por Cartões e Tipo de Pagamento (Relatórios) e por Receitas
// por Categoria (Dashboard) — `positive` só troca a cor do valor de cada lançamento (verde/vermelho).
export default function SpendingBreakdownWidget({ title, icon, groups, itemsByGroup, emptyMessage, positive = false }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const total = groups.reduce((s, g) => s + g.amount, 0);
  const amountColorClass = positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold dark:text-white flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {groups.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
            {emptyMessage || "Nenhum valor no período."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map(g => {
              const pct = total > 0 ? (g.amount / total) * 100 : 0;
              const isExpanded = expandedKey === g.key;
              const items = itemsByGroup[g.key] || [];
              return (
                <div key={g.key} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedKey(prev => (prev === g.key ? null : g.key))}
                    className={`w-full text-left p-3 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${isExpanded ? "ring-2 ring-inset ring-blue-400" : ""}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                        style={{ backgroundColor: (g.color || "#3b82f6") + "22" }}
                      >
                        {g.icon || "💳"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1">
                          {g.name}
                          {items.length > 0 && (
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                          )}
                        </p>
                        <p className="text-xs font-medium" style={{ color: g.color || "#3b82f6" }}>
                          R$ {formatBRL(g.amount)}
                          <span className="text-slate-400 dark:text-slate-500"> · {pct.toFixed(0)}%</span>
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: g.color || "#3b82f6" }}
                      />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 animate-in fade-in duration-200">
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <div className="min-w-0">
                              <span className="text-sm text-slate-700 dark:text-slate-200 truncate block">{item.description}</span>
                              {item.notes && (
                                <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 italic truncate">
                                  <MessageSquare className="w-3 h-3 shrink-0" /> {item.notes}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-slate-400">{formatDateBR(item.date)}</span>
                              <span className={`text-sm font-medium ${amountColorClass}`}>R$ {formatBRL(item.amount)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
