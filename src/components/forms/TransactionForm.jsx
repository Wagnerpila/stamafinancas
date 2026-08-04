import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { User } from "@/entities/User";
import { Transaction } from "@/entities/Transaction";
import { getTodayBrazil, toLocalISOString, toLocalDateString } from "@/components/lib/dateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowUpRight, ArrowDownRight, Save, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { usePlanAccess } from "../common/PlanRestriction";
import { Alert, AlertDescription } from "@/components/ui/alert";

const repeatFrequencyOptions = [
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
];

const REPEAT_INTERVAL_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 };

// Soma "monthsToAdd" meses a uma data "YYYY-MM-DD" mantendo o mesmo dia do mês, arredondado pro
// último dia caso o mês de destino seja mais curto (ex: dia 31 de janeiro + 1 mês -> 28/29 de
// fevereiro). Opera direto na string, sem passar por Date, pra não sofrer com fuso horário.
function addMonthsToDateString(dateStr, monthsToAdd) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const totalMonths = (month - 1) + monthsToAdd;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

export default function TransactionForm({ onSubmit, isSubmitting = false, initialData = null }) {
  const [dynamicCategories, setDynamicCategories] = useState({ income: [], expense: [] });

  useEffect(() => {
    base44.auth.me().then(u => {
      base44.entities.TransactionCategory.filter({ created_by: u.email }).then(cats => {
        const active = cats.filter(c => c.active !== false);
        setDynamicCategories({
          income: active.filter(c => c.type === 'income').map(c => ({ value: c.name, label: c.name, icon: c.icon })),
          expense: active.filter(c => c.type === 'expense').map(c => ({ value: c.name, label: c.name, icon: c.icon })),
        });
      }).catch(() => {});
    }).catch(() => {});
  }, []);


  const [formData, setFormData] = useState({
    description: initialData?.description || '',
    amount: initialData?.amount || '',
    type: initialData?.type || 'expense',
    category: initialData?.category || '',
    date: initialData?.date ? toLocalDateString(initialData.date) : getTodayBrazil(),
    payment_method: initialData?.payment_method || 'cash',
    notes: initialData?.notes || '',
    is_food_voucher: initialData?.is_food_voucher || false
  });

  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [createBill, setCreateBill] = useState(false);
  const [billDueDate, setBillDueDate] = useState('');
  const [createReceivable, setCreateReceivable] = useState(false);
  const [receivableDueDate, setReceivableDueDate] = useState('');
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState('monthly');
  const [creditCards, setCreditCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardLimit, setCardLimit] = useState(null);
  const [categoryBudget, setCategoryBudget] = useState(null);
  const [categorySpent, setCategorySpent] = useState(0);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        const cards = await base44.entities.CreditCard.filter({ created_by: currentUser.email, active: true });
        setCreditCards(cards);
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
      }
    };
    checkUser();
  }, []);

  // Load card limit info when card is selected
  useEffect(() => {
    if (!formData.credit_card_id || !user) return;
    const loadCardLimit = async () => {
      try {
        const card = creditCards.find(c => c.id === formData.credit_card_id);
        if (!card) return;

        // Get all invoices for this card
        const allInvoices = await base44.entities.CreditCardInvoice.filter({
          card_id: card.id
        });

        // Calculate current used amount (unpaid invoices)
        let currentMonthUsed = 0;
        allInvoices.forEach(invoice => {
          if (invoice.status !== 'paid') {
            currentMonthUsed += invoice.total_amount;
          }
        });

        const availableLimit = card.limit - currentMonthUsed;

        setSelectedCard(card);
        setCardLimit({
          total: card.limit,
          used: currentMonthUsed,
          available: availableLimit > 0 ? availableLimit : 0
        });
      } catch (e) {
        console.error("Erro ao carregar limite do cartão:", e);
      }
    };
    loadCardLimit();
  }, [formData.credit_card_id, user, creditCards]);

  // Load budget info when category changes
  useEffect(() => {
    if (!formData.category || formData.type !== 'expense' || !user) return;
    const loadBudget = async () => {
      try {
        const budgets = await base44.entities.CategoryBudget.filter({ created_by: user.email, category: formData.category });
        const budget = budgets[0] || null;
        setCategoryBudget(budget);
        if (budget) {
          const now = new Date();
          const txs = await base44.entities.Transaction.filter({ created_by: user.email, type: "expense", category: formData.category });
          const monthTxs = txs.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          });
          setCategorySpent(monthTxs.reduce((s, t) => s + Math.abs(t.amount), 0));
        }
      } catch (e) { /* ignore */ }
    };
    loadBudget();
  }, [formData.category, formData.type, user]);

  const { transactionLimit } = usePlanAccess(user);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    const isRepeating = !initialData && repeatEnabled;

    // Check transaction limit for new transactions (not edits)
    if (!initialData && transactionLimit > 0) {
      try {
        const existingTransactions = await Transaction.filter({ created_by: user?.email });
        if (existingTransactions.length >= transactionLimit) {
          setError("Limite de transações atingido para o plano gratuito. Faça upgrade para Premium.");
          return; // Stop form submission
        }
      } catch (error) {
        console.error("Erro ao verificar limite:", error);
        setError("Erro ao verificar limite de transações. Tente novamente.");
        return;
      }
    }

    const processedData = {
      ...formData,
      amount: Math.abs(parseFloat(formData.amount)),
      date: toLocalISOString(formData.date)
    };

    try {
      await onSubmit(processedData);

      // Repetir esta transação nos próximos meses/trimestres/anos: em vez de já criar cada mês
      // futuro como uma Transaction real (o que descontava do saldo e inflava "Gastos por
      // Categoria" antes mesmo de o mês chegar), gera uma conta a pagar/receber recorrente a
      // partir do próximo ciclo — a mesma lógica que já projeta corretamente mês a mês em
      // "Contas a Pagar/Receber" e "Compromissos Futuros", e só vira transação (e só desconta do
      // saldo) quando o usuário marcar aquele mês como pago/recebido.
      if (isRepeating) {
        const intervalMonths = REPEAT_INTERVAL_MONTHS[repeatFrequency] || 1;
        const nextDueDate = addMonthsToDateString(formData.date, intervalMonths);
        await base44.entities.Bill.create({
          title: formData.description,
          description: formData.notes || '',
          amount: processedData.amount,
          type: formData.type === 'income' ? 'receivable' : 'payable',
          category: formData.category,
          due_date: toLocalISOString(nextDueDate),
          recurrence: repeatFrequency,
        });
      }

      // If user wants to also create a bill to pay
      // Usa a mesma categoria selecionada na transação — antes disso, um filtro contra uma
      // lista antiga de slugs (anterior às categorias customizadas por nome) fazia a conta
      // gerada cair sempre em "bills"/"other", ignorando a categoria que o usuário escolheu.
      if (createBill && formData.type === 'expense' && billDueDate) {
        await base44.entities.Bill.create({
          title: formData.description,
          description: formData.notes || '',
          amount: processedData.amount,
          type: "payable",
          category: formData.category,
          due_date: toLocalISOString(billDueDate),
          recurrence: "none"
        });
      }

      // If user wants to also create a bill to receive
      if (createReceivable && formData.type === 'income' && receivableDueDate) {
        await base44.entities.Bill.create({
          title: formData.description,
          description: formData.notes || '',
          amount: processedData.amount,
          type: "receivable",
          category: formData.category,
          due_date: toLocalISOString(receivableDueDate),
          recurrence: "none"
        });
      }
    } catch (error) {
      console.error("Erro ao salvar transação:", error);
      setError('Erro ao salvar transação. Tente novamente.');
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // Reset category when type changes
      ...(field === 'type' ? { category: '' } : {})
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {formData.type === 'income' ? (
              <ArrowUpRight className="w-5 h-5 text-emerald-600" />
            ) : (
              <ArrowDownRight className="w-5 h-5 text-red-600" />
            )}
            {initialData ? 'Editar Transação' : 'Nova Transação'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="type" className="font-medium text-slate-700 dark:text-slate-200">Tipo</Label>
                <Select value={formData.type} onValueChange={(value) => handleChange('type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                        Receita
                      </div>
                    </SelectItem>
                    <SelectItem value="expense">
                      <div className="flex items-center gap-2">
                        <ArrowDownRight className="w-4 h-4 text-red-600" />
                        Despesa
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount" className="font-medium text-slate-700 dark:text-slate-200">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  placeholder="0,00"
                  required
                  className="text-lg font-semibold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-medium text-slate-700 dark:text-slate-200">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Ex: Compra no supermercado"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="category" className="font-medium text-slate-700 dark:text-slate-200">Categoria</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => handleChange('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Se a categoria já salva na transação (ex: revisão de lançamento importado
                        por foto/PDF) não existir mais na lista atual — renomeada ou excluída —
                        mostra o valor salvo mesmo assim, em vez de deixar o campo em branco. */}
                    {formData.category && !(dynamicCategories[formData.type] || []).some(c => c.value === formData.category) && (
                      <SelectItem value={formData.category}>
                        {formData.category} (categoria removida)
                      </SelectItem>
                    )}
                    {(dynamicCategories[formData.type] || []).map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.icon ? `${category.icon} ${category.label}` : category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date" className="font-medium text-slate-700 dark:text-slate-200">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleChange('date', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="font-medium text-slate-700 dark:text-slate-200">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Adicione observações sobre esta transação..."
                className="h-20"
              />
            </div>

            {/* Budget Alert for selected category */}
            {formData.type === 'expense' && formData.category && categoryBudget && (
              <div className={`p-4 rounded-lg border ${(categorySpent + parseFloat(formData.amount || 0)) > categoryBudget.monthly_limit ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : categorySpent / categoryBudget.monthly_limit >= 0.8 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}`}>
                 <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">Orçamento: {formData.category}</p>
                 <div className="w-full bg-white dark:bg-slate-600 rounded-full h-2 mb-1">
                   <div className={`h-2 rounded-full ${(categorySpent + parseFloat(formData.amount || 0)) > categoryBudget.monthly_limit ? 'bg-red-500' : 'bg-blue-500'}`}
                     style={{ width: `${Math.min(((categorySpent + parseFloat(formData.amount || 0)) / categoryBudget.monthly_limit) * 100, 100)}%` }} />
                 </div>
                 <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                   <span>Gasto: R$ {categorySpent.toFixed(2)}</span>
                   <span className="font-medium">
                     Disponível: R$ {Math.max(categoryBudget.monthly_limit - categorySpent, 0).toFixed(2)} de R$ {categoryBudget.monthly_limit.toFixed(2)}
                   </span>
                 </div>
               </div>
            )}

            {/* Payment method */}
            <div className="space-y-2">
              <Label className="font-medium text-slate-700 dark:text-slate-200">Forma de Pagamento</Label>
              <Select value={formData.payment_method} onValueChange={v => handleChange('payment_method', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                  <SelectItem value="food_voucher">Vale Alimentação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Credit card selection */}
            {formData.payment_method === 'credit_card' && creditCards.length > 0 && (
              <div className="space-y-2">
                <Label className="font-medium text-slate-700 dark:text-slate-200">Cartão de Crédito</Label>
                <Select value={formData.credit_card_id || ''} onValueChange={v => handleChange('credit_card_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                  <SelectContent>
                    {creditCards.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} {c.last_digits ? `**** ${c.last_digits}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Card Limit Alert */}
            {formData.payment_method === 'credit_card' && formData.credit_card_id && cardLimit && (
              <div className={`p-4 rounded-lg border ${
                (cardLimit.used + parseFloat(formData.amount || 0)) > cardLimit.total 
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                  : cardLimit.available < cardLimit.total * 0.2
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' 
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}>
                 <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                   Limite: {selectedCard?.name}
                 </p>
                 <div className="w-full bg-white dark:bg-slate-600 rounded-full h-2 mb-1">
                   <div 
                     className={`h-2 rounded-full ${
                       (cardLimit.used + parseFloat(formData.amount || 0)) > cardLimit.total 
                         ? 'bg-red-500' 
                         : 'bg-blue-500'
                     }`}
                     style={{ 
                       width: `${Math.min(((cardLimit.used + parseFloat(formData.amount || 0)) / cardLimit.total) * 100, 100)}%` 
                     }} 
                   />
                 </div>
                 <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                   <span>Usado: R$ {cardLimit.used.toFixed(2)}</span>
                   <span className="font-medium">
                     Disponível: R$ {Math.max(cardLimit.available - parseFloat(formData.amount || 0), 0).toFixed(2)} de R$ {cardLimit.total.toFixed(2)}
                   </span>
                 </div>
               </div>
            )}

            {formData.type === 'expense' && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                <div className="space-y-0.5">
                  <Label htmlFor="food-voucher" className="font-medium text-slate-900 dark:text-slate-100">
                    Pago com Vale Alimentação
                  </Label>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Esta despesa não afetará seu saldo total
                  </p>
                </div>
                <Switch
                  id="food-voucher"
                  checked={formData.is_food_voucher}
                  onCheckedChange={(checked) => handleChange('is_food_voucher', checked)}
                />
              </div>
            )}

            {/* Repeat transaction toggle */}
            {!initialData && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                <div className="space-y-0.5">
                  <Label htmlFor="repeat-transaction" className="font-medium text-slate-900 dark:text-slate-100">Repetir Transação</Label>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Criar uma conta a {formData.type === 'income' ? 'receber' : 'pagar'} recorrente pros próximos meses
                  </p>
                </div>
                <Switch id="repeat-transaction" checked={repeatEnabled} onCheckedChange={setRepeatEnabled} />
              </div>
            )}

            {!initialData && repeatEnabled && (
              <div className="space-y-2">
                <Label className="font-medium text-slate-700 dark:text-slate-200">Frequência</Label>
                <Select value={repeatFrequency} onValueChange={setRepeatFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {repeatFrequencyOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta transação de hoje é lançada normalmente. A partir do próximo ciclo
                  ({repeatFrequency === 'monthly' ? 'mês' : repeatFrequency === 'quarterly' ? 'trimestre' : 'ano'}),
                  ela vira uma conta a {formData.type === 'income' ? 'receber' : 'pagar'} recorrente — aparece em
                  "Contas a {formData.type === 'income' ? 'Receber' : 'Pagar'}" e nos compromissos futuros, mas só
                  entra no saldo quando você marcar cada mês como {formData.type === 'income' ? 'recebido' : 'pago'}.
                </p>
              </div>
            )}

            {/* Create Bill toggle */}
            {formData.type === 'expense' && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                <div className="space-y-0.5">
                  <Label htmlFor="create-bill" className="font-medium text-slate-900 dark:text-slate-100">Gerar Conta a Pagar</Label>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Vincular esta despesa a uma conta a pagar futura</p>
                </div>
                <Switch id="create-bill" checked={createBill} onCheckedChange={setCreateBill} />
              </div>
            )}

            {createBill && formData.type === 'expense' && (
              <div className="space-y-2">
                <Label className="font-medium text-slate-700 dark:text-slate-200">Data de Vencimento da Conta</Label>
                <Input type="date" value={billDueDate} onChange={e => setBillDueDate(e.target.value)} required />
              </div>
            )}

            {/* Create Receivable toggle */}
            {formData.type === 'income' && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="space-y-0.5">
                  <Label htmlFor="create-receivable" className="font-medium text-slate-900 dark:text-slate-100">Gerar Conta a Receber</Label>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Vincular esta receita a uma conta a receber futura</p>
                </div>
                <Switch id="create-receivable" checked={createReceivable} onCheckedChange={setCreateReceivable} />
              </div>
            )}

            {createReceivable && formData.type === 'income' && (
              <div className="space-y-2">
                <Label className="font-medium text-slate-700 dark:text-slate-200">Data de Recebimento Esperado</Label>
                <Input type="date" value={receivableDueDate} onChange={e => setReceivableDueDate(e.target.value)} required />
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              {initialData ? 'Atualizar' : 'Salvar'} Transação
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}