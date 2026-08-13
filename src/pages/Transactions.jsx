import React, { useState, useEffect } from "react";
import { Transaction } from "@/entities/Transaction";
import { User } from "@/entities/User";
import { base44 } from "@/api/base44Client";
import EditTransactionDialog from "../components/transactions/EditTransactionDialog";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import TransactionList from "../components/transactions/TransactionList";
import TransactionFilters from "../components/transactions/TransactionFilters";
import { usePlanAccess } from "../components/common/PlanRestriction";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Crown } from "lucide-react";
import PullToRefresh from "../components/mobile/PullToRefresh";

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [cards, setCards] = useState([]);
  const [filters, setFilters] = useState({
    type: 'all',
    category: 'all',
    source: 'all',
    cardId: 'all',
    search: '',
    dateFrom: '',
    dateTo: ''
  });

  const { transactionLimit, isPremium } = usePlanAccess(user);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        await loadTransactions(currentUser.email);
        base44.entities.CreditCard.filter({ created_by: currentUser.email }).then(setCards).catch(() => {});
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const handleRefresh = async () => {
    if (user?.email) {
      await loadTransactions(user.email);
    }
  };

  const loadTransactions = async (userEmail) => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const data = await Transaction.filter({ created_by: userEmail }, "-date");
      setTransactions(data);
    } catch (error) {
      console.error("Erro ao carregar transações:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
  };

  const handleEditSaved = async () => {
    await loadTransactions(user.email);
  };

  // Apaga transação e também Bills de parcelas futuras vinculadas (invoice_id)
  const deleteTransactionWithLinkedBills = async (tx) => {
    await Transaction.delete(tx.id);
    if (tx.invoice_id) {
      const linkedBills = await base44.entities.Bill.filter({ linked_bill_id: tx.invoice_id });
      if (linkedBills.length > 0) {
        await Promise.all(linkedBills.map(b => base44.entities.Bill.delete(b.id)));
      }
    }
  };

  const handleDelete = async (id) => {
    try {
      const tx = transactions.find(t => t.id === id);
      if (tx) await deleteTransactionWithLinkedBills(tx);
      else await Transaction.delete(id);
      await loadTransactions(user.email);
    } catch (error) {
      console.error("Erro ao deletar transação:", error);
    }
  };

  const handleDeleteMany = async (ids) => {
    try {
      const txsToDelete = transactions.filter(t => ids.includes(t.id));
      await Promise.all(txsToDelete.map(tx => deleteTransactionWithLinkedBills(tx)));
      await loadTransactions(user.email);
    } catch (error) {
      console.error("Erro ao deletar transações:", error);
    }
  };

  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(transaction => {
      // Filtro por tipo
      if (filters.type !== 'all' && transaction.type !== filters.type) return false;
      
      // Filtro por categoria
      if (filters.category !== 'all' && transaction.category !== filters.category) return false;

      // Filtro por origem (extrato importado / cartão de crédito / outro)
      if (filters.source !== 'all' && (transaction.source || 'manual') !== filters.source) return false;

      // Sub-filtro por cartão específico (só relevante com origem "Cartão de crédito")
      if (filters.source === 'credit_card' && filters.cardId && filters.cardId !== 'all' && transaction.credit_card_id !== filters.cardId) return false;

      // Filtro por busca
      if (filters.search && !transaction.description.toLowerCase().includes(filters.search.toLowerCase())) return false;
      
      // Filtro por data inicial
      if (filters.dateFrom && transaction.date < filters.dateFrom) return false;
      
      // Filtro por data final
      if (filters.dateTo && transaction.date > filters.dateTo) return false;
      
      return true;
    });
  }, [transactions, filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isNearLimit = transactionLimit > 0 && transactions.length >= transactionLimit * 0.8;
  const isAtLimit = transactionLimit > 0 && transactions.length >= transactionLimit;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="hover:bg-slate-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Transações</h1>
              <p className="text-slate-600 dark:text-slate-300">Gerencie todas as suas receitas e despesas</p>
            </div>
          </div>
          
          <Link to={createPageUrl("NewTransactionOptions")}>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
              disabled={isAtLimit}
            >
              <Plus className="w-5 h-5" />
              Nova Transação
            </Button>
          </Link>
        </div>

        {/* Alerta de limite de transações */}
        {!isPremium && (
          <div className="mb-6">
            {isAtLimit ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Você atingiu o limite de {transactionLimit} transações do plano gratuito.</span>
                  <Link to={createPageUrl("MySubscription")}>
                    <Button variant="outline" size="sm" className="ml-4">
                      <Crown className="w-4 h-4 mr-2" />
                      Fazer Upgrade
                    </Button>
                  </Link>
                </AlertDescription>
              </Alert>
            ) : isNearLimit ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Você está próximo do limite de {transactionLimit} transações ({transactions.length}/{transactionLimit}).</span>
                  <Link to={createPageUrl("MySubscription")}>
                    <Button variant="outline" size="sm" className="ml-4">
                      <Crown className="w-4 h-4 mr-2" />
                      Ver Planos
                    </Button>
                  </Link>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-blue-800 dark:text-blue-300 text-sm">
                  Plano Gratuito: {transactions.length}/{transactionLimit} transações utilizadas
                </p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <EditTransactionDialog
        transaction={editingTransaction}
        open={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSaved={handleEditSaved}
      />

      <TransactionFilters filters={filters} onFiltersChange={setFilters} cards={cards} />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <TransactionList 
          transactions={filteredTransactions}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDeleteMany={handleDeleteMany}
        />
      </motion.div>
      </div>
    </PullToRefresh>
  );
}