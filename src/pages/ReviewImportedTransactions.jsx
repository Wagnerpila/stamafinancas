import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Save, Trash2, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { motion } from 'framer-motion';

export default function ReviewImportedTransactions() {
  const navigate = useNavigate();
  const location = useLocation();
  const [transactions, setTransactions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [dbCategories, setDbCategories] = useState({ income: [], expense: [] });

  useEffect(() => {
    base44.entities.TransactionCategory.list().then(cats => {
      const active = cats.filter(c => c.active !== false);
      setDbCategories({
        income: active.filter(c => c.type === 'income').map(c => ({ value: c.name, label: c.name })),
        expense: active.filter(c => c.type === 'expense').map(c => ({ value: c.name, label: c.name }))
      });
    });
  }, []);

  useEffect(() => {
    if (location.state?.transactions) {
      const formattedTransactions = location.state.transactions.map((t, index) => ({
        ...t,
        id: `temp-${index}`,
        type: t.type || (t.amount < 0 ? 'expense' : 'income'),
        amount: Math.abs(t.amount),
        category: t.category || '',
        date: t.date ? new Date(t.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        source: 'statement_import' // esta tela só é alcançada a partir da importação de extrato
      }));
      setTransactions(formattedTransactions);
    } else {
      navigate(createPageUrl("ImportStatement"));
    }
  }, [location.state, navigate]);

  const handleTransactionChange = (index, field, value) => {
    const newTransactions = [...transactions];
    newTransactions[index][field] = value;
    if (field === 'type') {
      newTransactions[index].category = ''; // Reset category on type change
    }
    setTransactions(newTransactions);
  };

  const handleDeleteTransaction = (index) => {
    const newTransactions = transactions.filter((_, i) => i !== index);
    setTransactions(newTransactions);
  };

  const handleSaveAll = async () => {
    setError('');
    const invalidTransaction = transactions.some(t => !t.category || !t.description || !t.amount);
    if (invalidTransaction) {
      setError("Por favor, preencha todos os campos obrigatórios, especialmente a categoria, para todas as transações.");
      return;
    }

    setIsSaving(true);
    try {
      const transactionsToCreate = transactions.map(({ id, ...rest }) => rest);
      await base44.entities.Transaction.bulkCreate(transactionsToCreate);
      setSuccess(true);
      setTimeout(() => navigate(createPageUrl("Transactions")), 2000);
    } catch (err) {
      setError("Ocorreu um erro ao salvar as transações. Tente novamente.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };
  
  if (success) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto flex items-center justify-center min-h-[50vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg"
        >
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Transações Importadas!</h2>
          <p className="text-slate-600 dark:text-slate-300 mt-2">Redirecionando para a sua lista de transações...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center mb-8"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("ImportStatement"))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Revise suas Transações</h1>
            <p className="text-slate-600 dark:text-slate-300">Ajuste e categorize as transações importadas antes de salvar.</p>
          </div>
        </div>
        <Button onClick={handleSaveAll} disabled={isSaving || transactions.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar {transactions.length} Transações
        </Button>
      </motion.div>

      {error && <Alert variant="destructive" className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="space-y-4">
        {transactions.map((t, index) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-800 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-3">
                    <Input
                      placeholder="Descrição"
                      value={t.description}
                      onChange={(e) => handleTransactionChange(index, 'description', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      type="number"
                      placeholder="Valor"
                      value={t.amount}
                      onChange={(e) => handleTransactionChange(index, 'amount', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                     <Select value={t.type} onValueChange={(val) => handleTransactionChange(index, 'type', val)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Receita</SelectItem>
                          <SelectItem value="expense">Despesa</SelectItem>
                        </SelectContent>
                      </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Select value={t.category} onValueChange={(val) => handleTransactionChange(index, 'category', val)}>
                      <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                      <SelectContent>
                        {dbCategories[t.type]?.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      type="date"
                      value={t.date}
                      onChange={(e) => handleTransactionChange(index, 'date', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-1 text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(index)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {transactions.length === 0 && !isSaving &&
          <Card className="py-12 text-center border-dashed">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Todas as transações foram removidas.</h3>
            <p className="text-slate-500 dark:text-slate-400">Volte para importar um novo extrato.</p>
          </Card>
        }
      </div>
    </div>
  );
}