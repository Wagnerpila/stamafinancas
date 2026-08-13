import React, { useMemo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronRight, ChevronDown, Tag, Receipt, CreditCard, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

function formatBRL(v) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBR(dateStr) {
  if (!dateStr) return "";
  const raw = String(dateStr).slice(0, 10);
  const d = new Date(raw + "T00:00:00");
  if (isNaN(d)) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

// Labels padrão para categorias do enum antigo (fallback para transações salvas antes de
// existirem categorias customizadas por nome, ex: category: "bills").
const ENUM_LABELS = {
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

export default function CategorySpendingCompact({ transactions = [], creditCardTxs = [], budgets = [], selectedDate, yearMode = false, onCategoryChanged }) {
  const [dbCategories, setDbCategories] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [savingItemId, setSavingItemId] = useState(null);

  // Fecha a lista expandida ao trocar de mês — senão fica mostrando lançamentos de um mês que
  // não é mais o selecionado.
  useEffect(() => {
    setExpandedCategory(null);
  }, [selectedDate]);

  useEffect(() => {
    base44.auth.me().then(u => {
      base44.entities.TransactionCategory.filter({ created_by: u.email })
        .then(cats => setDbCategories(cats.filter(c => c.active !== false && c.type === "expense")))
        .catch(() => {});
    }).catch(() => {});
  }, []);

  // Resolve o valor bruto salvo em transaction.category pro nome de exibição da categoria.
  // Sem isso, uma transação antiga com category="bills" (slug do enum antigo) e uma transação
  // nova com category="Contas" (categoria customizada com o mesmo significado) eram somadas em
  // grupos separados — aparecendo como dois cards "Contas" em vez de um só somado.
  const resolveCategoryName = (raw, dbCats) => {
    if (!raw) return "Outros";
    const dbMatch = dbCats.find(c => c.name === raw);
    if (dbMatch) return dbMatch.name;
    if (ENUM_LABELS[raw]) return ENUM_LABELS[raw].name;
    return raw;
  };

  // Agrupa gastos do mês (ou do ano todo, se yearMode) por categoria — soma (`spending`) e a
  // lista de lançamentos que compõem cada soma (`itemsByCategory`), pra poder abrir "o que
  // compõe esse valor" ao clicar no card.
  const { spending, itemsByCategory } = useMemo(() => {
    const ref = selectedDate || new Date();
    const matchesPeriod = (d) => yearMode
      ? d.getFullYear() === ref.getFullYear()
      : d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
    const totals = {};
    const items = {};
    const addItem = (key, item) => {
      totals[key] = (totals[key] || 0) + Math.abs(item.amount || 0);
      if (!items[key]) items[key] = [];
      items[key].push(item);
    };

    // Transações normais (excluindo vale alimentação)
    transactions.forEach(t => {
      if (t.type !== "expense" || t.is_food_voucher) return;
      // Ignorar apenas pagamentos de fatura (têm invoice_id E categoria é o pagamento em si)
      // Manter despesas normais que possam ter invoice_id por outros motivos
      const raw = t.date || t.created_date;
      const d = raw && raw.length === 10 ? new Date(raw + "T00:00:00") : new Date(raw);
      if (!d || isNaN(d) || !matchesPeriod(d)) return;
      const key = resolveCategoryName(t.category, dbCategories);
      addItem(key, { id: `t-${t.id}`, rawId: t.id, description: t.description, amount: t.amount, date: t.date, category: key, source: "transaction" });
    });

    // Transações de cartão: sempre contabilizar pela data da compra
    creditCardTxs.forEach(t => {
      const raw = t.purchase_date || t.created_date;
      const d = raw && raw.length === 10 ? new Date(raw + "T00:00:00") : new Date(raw);
      if (!d || isNaN(d) || !matchesPeriod(d)) return;
      const key = resolveCategoryName(t.category, dbCategories);
      addItem(key, { id: `cc-${t.id}`, rawId: t.id, description: t.description, amount: t.amount, date: t.purchase_date, category: key, source: "creditcard" });
    });

    Object.values(items).forEach(list => list.sort((a, b) => new Date(b.date) - new Date(a.date)));

    return { spending: totals, itemsByCategory: items };
  }, [transactions, creditCardTxs, selectedDate, yearMode, dbCategories]);

  const totalSpent = Object.values(spending).reduce((s, v) => s + v, 0);

  // Monta lista de categorias visíveis: une categorias do banco com as que aparecem nas
  // transações. `spending` já está agrupado por nome de exibição resolvido (ver acima), então
  // basta uma entrada de metadados (ícone/cor) por nome — sem risco de duplicar o mesmo nome
  // sob duas chaves diferentes.
  const visible = useMemo(() => {
    const catMap = {};

    // Categorias do banco (com ícone e cor)
    dbCategories.forEach(c => { catMap[c.name] = { name: c.name, icon: c.icon, color: c.color }; });

    // Categorias que aparecem nos gastos mas não estão no banco (ex: categoria excluída depois,
    // ou resolvida via ENUM_LABELS)
    Object.keys(spending).forEach(key => {
      if (!catMap[key]) {
        const enumEntry = Object.values(ENUM_LABELS).find(e => e.name === key);
        catMap[key] = enumEntry || { name: key, icon: "📦", color: "#64748b" };
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

  // Muda só a categoria do lançamento selecionado na lista, sem abrir o formulário inteiro de
  // edição — chama a entidade certa conforme a origem (Transaction ou CreditCardTransaction).
  const handleChangeCategory = async (item, newCategory) => {
    if (!newCategory || newCategory === item.category) { setEditingItemId(null); return; }
    setSavingItemId(item.id);
    try {
      if (item.source === "creditcard") {
        await base44.entities.CreditCardTransaction.update(item.rawId, { category: newCategory });
      } else {
        await base44.entities.Transaction.update(item.rawId, { category: newCategory });
      }
      onCategoryChanged?.();
    } catch (err) {
      console.error("Erro ao atualizar categoria:", err);
    } finally {
      setSavingItemId(null);
      setEditingItemId(null);
    }
  };

  if (visible.length === 0) return null;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold dark:text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-500" />
            Gastos por Categoria{yearMode ? " — Ano" : ""}
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
            // Meta é sempre cadastrada como limite mensal — no ano todo, o comparativo precisa
            // ser contra a soma das 12 metas mensais, senão qualquer gasto acumulado do ano
            // pareceria "estourado" contra o limite de um único mês.
            const limit = budget?.monthly_limit ? budget.monthly_limit * (yearMode ? 12 : 1) : undefined;
            const isOver = limit && spent > limit;
            const overAmount = isOver ? spent - limit : 0;
            const limitPct = limit && limit > 0 ? (spent / limit) * 100 : null;
            const barColor = limitPct !== null ? budgetGradient(limitPct) : (cat.color || "#3b82f6");
            const barWidth = limit && limit > 0 ? Math.min((spent / limit) * 100, 100) : Math.min(pct, 100);
            const isExpanded = expandedCategory === cat.name;
            const items = itemsByCategory[cat.name] || [];
            const itemCount = items.length;
            return (
              <div key={cat.name} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedCategory(prev => (prev === cat.name ? null : cat.name))}
                  className={`w-full text-left p-3 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${isExpanded ? "ring-2 ring-inset ring-blue-400" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: (isOver ? "#ef4444" : (cat.color || "#3b82f6")) + "22" }}
                    >
                      {cat.icon || "📦"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1">
                        {cat.name}
                        {itemCount > 0 && (
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                        )}
                      </p>
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
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 animate-in fade-in duration-200">
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {items.map(item => {
                        const isEditing = editingItemId === item.id;
                        return (
                          <div key={item.id} className="rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <div className="flex items-center justify-between gap-3 py-1.5 px-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {item.source === "creditcard"
                                  ? <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  : <Receipt className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                }
                                <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{item.description}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-slate-400">{formatDateBR(item.date)}</span>
                                <span className="text-sm font-medium text-red-600 dark:text-red-400">R$ {formatBRL(item.amount)}</span>
                                <button
                                  type="button"
                                  onClick={() => setEditingItemId(prev => (prev === item.id ? null : item.id))}
                                  className="text-slate-300 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400"
                                  aria-label="Alterar categoria"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {isEditing && (
                              <div className="px-2 pb-2 flex items-center gap-2">
                                <select
                                  autoFocus
                                  defaultValue=""
                                  disabled={savingItemId === item.id}
                                  onChange={e => handleChangeCategory(item, e.target.value)}
                                  className="flex-1 text-xs rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                >
                                  <option value="" disabled>Mover para categoria...</option>
                                  {dbCategories.map(c => (
                                    <option key={c.id} value={c.name}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => setEditingItemId(null)}
                                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}