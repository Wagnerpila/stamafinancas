import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Target, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
const FALLBACK_COLOR = "bg-blue-500";

export default function CategoryBudgets() {
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ category: "", monthly_limit: "" });

  useEffect(() => {
    const load = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        await reload(u.email);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const reload = async (email) => {
    const now = new Date();
    const [b, t, cats] = await Promise.all([
      base44.entities.CategoryBudget.filter({ created_by: email }),
      base44.entities.Transaction.filter({ created_by: email, type: "expense" }, "-date"),
      base44.entities.TransactionCategory.filter({ created_by: email }),
    ]);
    // Deduplicar por nome (evitar duplicatas no banco)
    const seen = new Set();
    const unique = cats.filter(c => {
      if (c.active === false || c.type !== "expense") return false;
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });
    setExpenseCategories(unique);
    setBudgets(b);
    const monthlyT = t.filter(tx => {
      // tx.date vem da API como ISO completo ("...T12:00:00.000Z"), não "YYYY-MM-DD" puro —
      // concatenar "T00:00:00" nele direto formava uma data inválida (NaN em getMonth/getFullYear),
      // fazendo esse filtro nunca bater com nada.
      const d = new Date(String(tx.date).slice(0, 10) + "T00:00:00");
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    setTransactions(monthlyT);
  };

  const getSpent = (category) =>
    transactions.filter(t => t.category === category).reduce((s, t) => s + Math.abs(t.amount), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { ...formData, monthly_limit: parseFloat(formData.monthly_limit) };
    if (editingBudget) {
      await base44.entities.CategoryBudget.update(editingBudget.id, data);
    } else {
      await base44.entities.CategoryBudget.create(data);
    }
    setShowForm(false);
    setEditingBudget(null);
    setFormData({ category: "", monthly_limit: "" });
    await reload(user.email);
  };

  const handleEdit = (budget) => {
    setEditingBudget(budget);
    setFormData({ category: budget.category, monthly_limit: budget.monthly_limit });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Excluir este orçamento?")) {
      await base44.entities.CategoryBudget.delete(id);
      await reload(user.email);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Previsão Orçamentária</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">Defina limites mensais por categoria e acompanhe em tempo real</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingBudget(null); setFormData({ category: "", monthly_limit: "" }); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-5 h-5 mr-2" /> Nova Categoria
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
            <CardHeader>
              <CardTitle>{editingBudget ? "Editar Orçamento" : "Novo Orçamento por Categoria"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                     <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                     <SelectContent>
                       {expenseCategories.map(cat => (
                           <SelectItem key={cat.id} value={cat.name}>
                             {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
                           </SelectItem>
                         ))}
                     </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Limite Mensal (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={formData.monthly_limit} onChange={e => setFormData(p => ({ ...p, monthly_limit: e.target.value }))} required />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingBudget(null); }}>Cancelar</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Salvar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {budgets.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-16 text-center">
            <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Nenhum orçamento definido</h3>
            <p className="text-slate-500">Defina limites por categoria para controlar seus gastos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((budget) => {
            const spent = getSpent(budget.category);
            const pct = Math.min((spent / budget.monthly_limit) * 100, 100);
            const remaining = budget.monthly_limit - spent;
            const isOver = remaining < 0;
            const isWarning = pct >= 80 && !isOver;
            const catObj = expenseCategories.find(c => c.name === budget.category);
              const colorClass = isOver ? "bg-red-500" : isWarning ? "bg-yellow-500" : FALLBACK_COLOR;
            return (
              <motion.div key={budget.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className={`border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 ${isOver ? 'ring-2 ring-red-300' : isWarning ? 'ring-2 ring-yellow-300' : ''}`}>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">{catObj ? `${catObj.icon || ""} ${catObj.name}`.trim() : budget.category}</h3>
                        <div className="flex gap-4 mt-1 text-sm">
                          <span className="text-slate-500 dark:text-slate-400">Gasto: <span className={`font-semibold ${isOver ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>R$ {spent.toFixed(2)}</span></span>
                          <span className="text-slate-500 dark:text-slate-400">Limite: <span className="font-semibold text-slate-700 dark:text-slate-300">R$ {budget.monthly_limit.toFixed(2)}</span></span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(budget)}><Edit2 className="w-4 h-4 text-slate-400" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(budget.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 mb-2">
                      <div className={`h-3 rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 dark:text-slate-400">{pct.toFixed(0)}% utilizado</span>
                      <span className={`font-semibold ${isOver ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isOver ? `R$ ${Math.abs(remaining).toFixed(2)} acima` : `R$ ${remaining.toFixed(2)} disponível`}
                      </span>
                    </div>
                    {(isOver || isWarning) && (
                      <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${isOver ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'}`}>
                        {isOver ? "⚠️ Limite ultrapassado nesta categoria!" : "⚠️ Atenção: mais de 80% do limite utilizado"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}