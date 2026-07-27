import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { parseISO } from 'date-fns';
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUpRight, ArrowDownRight, Target, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import MonthFilter from '../components/common/MonthFilter';

const DEFAULT_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#6366f1'];

const EMOJI_LIST = [
  '💰','💵','💸','💳','🏦','📈','📉','💹','🪙','💎',
  '🍔','🍕','🥗','🍜','☕','🛒','🥩','🍎','🥤','🍺',
  '🚗','🚌','✈️','🚂','⛽','🚕','🛵','🚲','🛺','🚁',
  '🏥','💊','🩺','🏋️','🧘','🌡️','💉','🦷','👓','🩹',
  '📚','🎓','✏️','🖥️','📖','🔬','🏫','🧑‍💻','📝','🎒',
  '🎮','🎬','🎵','🎭','🎪','🏖️','🎯','🎲','🎸','📺',
  '🛍️','👗','👠','⌚','👜','💄','🧴','🪞','🛋️','🛏️',
  '📄','💡','📱','💻','🖨️','🔌','🔧','🏠','🔑','📦',
  '🏠','🏢','🏗️','🏡','🌳','🌊','🔥','⚡','💧','🌿',
  '👶','🐶','🐱','🌹','🎁','🎉','❤️','⭐','🌙','☀️',
];

const DEFAULT_CATEGORIES = [
  { name: 'Salário', type: 'income', icon: '💰', color: '#10b981', is_default: true },
  { name: 'Freelance', type: 'income', icon: '💻', color: '#3b82f6', is_default: true },
  { name: 'Investimento', type: 'income', icon: '📈', color: '#8b5cf6', is_default: true },
  { name: 'Outras Receitas', type: 'income', icon: '💵', color: '#06b6d4', is_default: true },
  { name: 'Alimentação', type: 'expense', icon: '🍔', color: '#f59e0b', is_default: true },
  { name: 'Transporte', type: 'expense', icon: '🚗', color: '#6366f1', is_default: true },
  { name: 'Saúde', type: 'expense', icon: '🏥', color: '#ef4444', is_default: true },
  { name: 'Educação', type: 'expense', icon: '📚', color: '#3b82f6', is_default: true },
  { name: 'Entretenimento', type: 'expense', icon: '🎮', color: '#ec4899', is_default: true },
  { name: 'Compras', type: 'expense', icon: '🛍️', color: '#f97316', is_default: true },
  { name: 'Contas', type: 'expense', icon: '📄', color: '#84cc16', is_default: true },
  { name: 'Aluguel', type: 'expense', icon: '🏠', color: '#06b6d4', is_default: true },
  { name: 'Outras Despesas', type: 'expense', icon: '💸', color: '#6366f1', is_default: true },
];

const emptyForm = { name: '', type: 'expense', icon: '📦', color: '#3b82f6', monthly_limit: '' };

export default function TransactionCategories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [creditCardTxs, setCreditCardTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expense');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentUser, setCurrentUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setCurrentUser(u);
      Promise.all([
        base44.entities.Transaction.filter({ created_by: u.email }, "-date", 200),
        base44.entities.CreditCardTransaction.filter({ created_by: u.email }),
        base44.entities.CategoryBudget.filter({ created_by: u.email }),
      ]).then(([txs, ccTxs, budgetData]) => {
        setTransactions(txs);
        setCreditCardTxs(ccTxs);
        setBudgets(budgetData);
      });
      loadCategories(u);
    }).catch(() => {});
  }, []);

  const loadCategories = async (user) => {
    setLoading(true);
    try {
      const u = user || currentUser;
      if (!u) return;
      let cats = await base44.entities.TransactionCategory.filter({ created_by: u.email });
      if (cats.length === 0) {
        await base44.entities.TransactionCategory.bulkCreate(DEFAULT_CATEGORIES);
        cats = await base44.entities.TransactionCategory.filter({ created_by: u.email });
      }
      setCategories(cats);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const reloadBudgets = async () => {
    if (!currentUser) return;
    const b = await base44.entities.CategoryBudget.filter({ created_by: currentUser.email });
    setBudgets(b);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, type: activeTab });
    setShowDialog(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    const budget = budgets.find(b => b.category === cat.name);
    setForm({
      name: cat.name,
      type: cat.type,
      icon: cat.icon || '📦',
      color: cat.color || '#3b82f6',
      monthly_limit: budget ? String(budget.monthly_limit) : '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const catData = { name: form.name, type: form.type, icon: form.icon, color: form.color };
      let savedCatName = form.name;

      if (editing) {
        await base44.entities.TransactionCategory.update(editing.id, catData);
        savedCatName = form.name;
      } else {
        await base44.entities.TransactionCategory.create(catData);
      }

      // Gerenciar orçamento (só para despesas)
      if (form.type === 'expense') {
        const limitValue = parseFloat(form.monthly_limit);
        const existingBudget = budgets.find(b => b.category === (editing?.name || savedCatName));

        if (!isNaN(limitValue) && limitValue > 0) {
          if (existingBudget) {
            await base44.entities.CategoryBudget.update(existingBudget.id, { category: savedCatName, monthly_limit: limitValue });
          } else {
            await base44.entities.CategoryBudget.create({ category: savedCatName, monthly_limit: limitValue });
          }
        } else if (existingBudget) {
          // Apagar orçamento se o limite foi limpo
          await base44.entities.CategoryBudget.delete(existingBudget.id);
        }
        await reloadBudgets();
      }

      await loadCategories();
      setShowDialog(false);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleDelete = (cat) => {
    setDeleteTarget(cat);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const cat = deleteTarget;
    setDeleteTarget(null);
    await base44.entities.TransactionCategory.delete(cat.id);
    const budget = budgets.find(b => b.category === cat.name);
    if (budget) await base44.entities.CategoryBudget.delete(budget.id);
    setCategories(prev => prev.filter(c => c.id !== cat.id));
    setBudgets(prev => prev.filter(b => b.category !== cat.name));
  };

  const filtered = categories.filter(c => c.type === activeTab && c.active !== false);

  const monthlySpending = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      if (t.type !== 'expense' || t.is_food_voucher || t.invoice_id) return;
      const raw = t.date || t.created_date;
      const d = raw && raw.length === 10 ? new Date(raw + "T00:00:00") : new Date(raw);
      if (!d || isNaN(d)) return;
      if (d.getMonth() !== selectedDate.getMonth() || d.getFullYear() !== selectedDate.getFullYear()) return;
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount || 0);
    });
    creditCardTxs.forEach(t => {
      const raw = t.purchase_date || t.created_date;
      const d = raw && raw.length === 10 ? new Date(raw + "T00:00:00") : new Date(raw);
      if (!d || isNaN(d)) return;
      if (d.getMonth() !== selectedDate.getMonth() || d.getFullYear() !== selectedDate.getFullYear()) return;
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount || 0);
    });
    return map;
  }, [transactions, creditCardTxs, selectedDate]);

  const monthlyIncome = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      if (t.type !== 'income') return;
      const d = parseISO(t.date || t.created_date);
      if (d.getMonth() !== selectedDate.getMonth() || d.getFullYear() !== selectedDate.getFullYear()) return;
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount || 0);
    });
    return map;
  }, [transactions, selectedDate]);

  const maxSpending = useMemo(() =>
    Math.max(...filtered.map(c => monthlySpending[c.name] || 0), 1),
    [filtered, monthlySpending]
  );

  const maxIncome = useMemo(() => {
    const incomeFiltered = categories.filter(c => c.type === 'income' && c.active !== false);
    return Math.max(...incomeFiltered.map(c => monthlyIncome[c.name] || 0), 1);
  }, [categories, monthlyIncome]);

  const formatBRL = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-2">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("Dashboard"))}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Categorias</h1>
              <p className="text-slate-600 dark:text-slate-300">Gerencie categorias e orçamentos mensais</p>
            </div>
          </div>
          <div className="sm:ml-auto pl-12 sm:pl-0">
            <MonthFilter selectedDate={selectedDate} onChange={setSelectedDate} />
          </div>
        </div>
      </motion.div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('expense')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'expense'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <ArrowDownRight className="w-4 h-4" /> Despesas
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'income'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" /> Receitas
        </button>
        <div className="flex-1" />
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cat, i) => {
            const budget = budgets.find(b => b.category === cat.name);
            const spent = monthlySpending[cat.name] || 0;
            const limit = budget?.monthly_limit;
            const isOver = limit && spent > limit;
            const isWarning = limit && !isOver && (spent / limit) >= 0.8;

            return (
              <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className={`border-0 shadow-md bg-white dark:bg-slate-800 hover:shadow-lg transition-shadow ${isOver ? 'ring-2 ring-red-400' : isWarning ? 'ring-2 ring-yellow-400' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4 mb-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                        style={{ backgroundColor: (cat.color || '#3b82f6') + '22' }}
                      >
                        {cat.icon || '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{cat.name}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {cat.is_default && <Badge variant="secondary" className="text-xs">Padrão</Badge>}
                          {limit && (
                            <span className="text-xs flex items-center gap-1" style={{ color: isOver ? '#ef4444' : cat.color || '#3b82f6' }}>
                              <Target className="w-3 h-3" /> Limite: R$ {formatBRL(limit)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(cat)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    {activeTab === 'expense' && (
                      <div>
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                          <span>Gasto este mês</span>
                          <span className={`font-medium ${isOver ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                            R$ {formatBRL(spent)}{limit ? ` / R$ ${formatBRL(limit)}` : ''}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${limit ? Math.min((spent / limit) * 100, 100) : Math.min((spent / maxSpending) * 100, 100)}%`,
                              backgroundColor: isOver ? '#ef4444' : isWarning ? '#f59e0b' : (cat.color || '#3b82f6')
                            }}
                          />
                        </div>
                        {isOver && <p className="text-xs text-red-500 mt-1">⚠️ +R$ {formatBRL(spent - limit)} acima do limite</p>}
                      </div>
                    )}

                    {activeTab === 'income' && (
                      <div>
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                          <span>Recebido este mês</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {monthlyIncome[cat.name] ? `R$ ${formatBRL(monthlyIncome[cat.name])}` : 'R$ 0,00'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(((monthlyIncome[cat.name] || 0) / maxIncome) * 100, 100)}%`,
                              backgroundColor: cat.color || '#10b981'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
              Nenhuma categoria encontrada. Crie uma nova!
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Remover categoria?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a categoria <strong>"{deleteTarget?.name}"</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="dark:bg-slate-800 max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="dark:text-white">{editing ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="dark:text-slate-200">Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger className="dark:bg-slate-700 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="dark:text-slate-200">Nome</Label>
              <Input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Academia, Streaming..."
                className="dark:bg-slate-700 dark:text-white"
              />
            </div>

            {form.type === 'expense' && (
              <div className="space-y-1.5">
                <Label className="dark:text-slate-200 flex items-center gap-1.5">
                  <Target className="w-4 h-4" /> Limite Mensal (R$) — opcional
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.monthly_limit}
                  onChange={e => setForm(p => ({ ...p, monthly_limit: e.target.value }))}
                  placeholder="Ex: 500,00"
                  className="dark:bg-slate-700 dark:text-white"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="dark:text-slate-200">Emoji / Ícone</Label>
              <div className="border border-input dark:border-slate-600 rounded-lg p-2 max-h-36 overflow-y-auto bg-white dark:bg-slate-700">
                <div className="grid grid-cols-10 gap-1">
                  {EMOJI_LIST.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, icon: emoji }))}
                      className={`text-xl p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors ${form.icon === emoji ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500' : ''}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="dark:text-slate-200">Cor</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200"
                />
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(p => ({ ...p, color: c }))}
                      className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c, borderColor: form.color === c ? '#1e293b' : 'transparent' }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: form.color + '33' }}>
                {form.icon || '📦'}
              </div>
              <span className="font-medium text-slate-800 dark:text-white">{form.name || 'Nome da categoria'}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="dark:border-slate-600 dark:text-slate-200">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="bg-blue-600 hover:bg-blue-700">
              {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}