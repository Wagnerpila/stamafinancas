import React, { useState, useEffect, useMemo } from "react";
import { Transaction } from "@/entities/Transaction";
import { Bill } from "@/entities/Bill";
import { User } from "@/entities/User";
import { base44 } from "@/api/base44Client";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ShoppingCart,
  Plus,
  Target,
  Receipt,
  CreditCard,
  Calendar
} from "lucide-react";
import StatsCard from "../components/dashboard/StatsCard";
import TransactionChart from "../components/dashboard/TransactionChart";
import RecentTransactions from "../components/dashboard/RecentTransactions";
import FoodVoucherConfig from "../components/dashboard/FoodVoucherConfig";
import ShareDataButton from "../components/sharing/ShareDataButton";
import FuturePlanningWidget from "../components/dashboard/FuturePlanningWidget";
import CategorySpendingCompact from "../components/dashboard/CategorySpendingCompact";
import MonthFilter from "../components/common/MonthFilter";
import PullToRefresh from "../components/mobile/PullToRefresh";
import useRefreshOnForeground from "../hooks/useRefreshOnForeground";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

const formatBRL = (value) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [creditCardTxs, setCreditCardTxs] = useState([]);
  const [bills, setBills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [yearMode, setYearMode] = useState(false);

  const loadInitialData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      const [transactionData, billData, catData, budgetData, ccTxData] = await Promise.all([
        Transaction.filter({ created_by: currentUser.email }, "-created_date"),
        Bill.filter({ created_by: currentUser.email }),
        base44.entities.TransactionCategory.filter({ created_by: currentUser.email }),
        base44.entities.CategoryBudget.filter({ created_by: currentUser.email }),
        base44.entities.CreditCardTransaction.filter({ created_by: currentUser.email })
      ]);
      setTransactions(transactionData);
      setBills(billData);
      setCategories(catData.filter(c => c.active !== false));
      setBudgets(budgetData);
      setCreditCardTxs(ccTxData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Reconsulta ao voltar de outra tela via bfcache/segundo plano (comum no mobile) — senão o
  // Dashboard fica preso nos dados de antes de, por exemplo, cadastrar uma conta recorrente em
  // "Contas a Pagar" e voltar, mostrando "Compromissos Futuros" desatualizado.
  useRefreshOnForeground(loadInitialData);

  // Filter transactions to selected month or year
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => {
      const raw = t.date || t.created_date;
      // Append time to avoid Safari/iOS Invalid Date on bare YYYY-MM-DD strings
      const d = raw && raw.length === 10 ? new Date(raw + "T00:00:00") : new Date(raw);
      if (!d || isNaN(d)) return false;
      if (yearMode) return d.getFullYear() === selectedDate.getFullYear();
      return d.getMonth() === selectedDate.getMonth() &&
             d.getFullYear() === selectedDate.getFullYear();
    });
  }, [transactions, selectedDate, yearMode]);

  const stats = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const foodVoucherExpense = transactions
      .filter(t => t.type === 'expense' && t.is_food_voucher)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalExpense = transactions
      .filter(t => t.type === 'expense' && !t.is_food_voucher)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const balance = totalIncome - totalExpense;

    const monthlyIncome = monthlyTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpense = monthlyTransactions
      .filter(t => t.type === 'expense' && !t.is_food_voucher)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const monthlyFoodVoucher = monthlyTransactions
      .filter(t => t.type === 'expense' && t.is_food_voucher)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const pendingReceivables = bills
      .filter(b => b.type === 'receivable' && b.status === 'pending')
      .reduce((sum, b) => sum + b.amount, 0);

    const pendingPayables = bills
      .filter(b => b.type === 'payable' && b.status === 'pending')
      .reduce((sum, b) => sum + b.amount, 0);

    const projectedBalance = balance + pendingReceivables - pendingPayables;

    // "Disponível" = receita do mês - despesa do mês (simples e intuitivo)
    const availableToSpend = (user?.monthly_budget && user.monthly_budget > 0)
      ? user.monthly_budget - monthlyExpense
      : monthlyIncome - monthlyExpense;

    const foodVoucherRemaining = (user?.food_voucher_balance || 0) - foodVoucherExpense;

    return {
      balance,
      totalIncome,
      totalExpense,
      foodVoucherExpense,
      monthlyIncome,
      monthlyExpense,
      monthlyFoodVoucher,
      transactionCount: monthlyTransactions.length,
      pendingReceivables,
      pendingPayables,
      projectedBalance,
      availableToSpend,
      foodVoucherRemaining
    };
  }, [transactions, monthlyTransactions, bills, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={loadInitialData}>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Header + Month Filter */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">Dashboard Financeiro</h1>
            <p className="text-slate-600 dark:text-slate-300">Acompanhe suas finanças de forma inteligente</p>
          </div>
          <MonthFilter
            selectedDate={selectedDate}
            onChange={setSelectedDate}
            yearMode={yearMode}
            onToggleYearMode={() => setYearMode(v => !v)}
          />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Ações Rápidas</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Link to={createPageUrl("NewTransactionOptions")}>
                  <Button className="w-full h-24 flex flex-col gap-2 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg text-white">
                    <Plus className="w-6 h-6" />
                    <span className="text-sm font-medium">Nova Transação</span>
                  </Button>
                </Link>
                <Link to={createPageUrl("TransactionCategories")}>
                  <Button className="w-full h-24 flex flex-col gap-2 bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg text-white">
                    <Target className="w-6 h-6" />
                    <span className="text-sm font-medium">Orçamentos</span>
                  </Button>
                </Link>
                <Link to={createPageUrl("BillsToPay")}>
                  <Button className="w-full h-24 flex flex-col gap-2 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg text-white">
                    <Receipt className="w-6 h-6" />
                    <span className="text-sm font-medium">Contas a Pagar</span>
                  </Button>
                </Link>
                <Link to={createPageUrl("BillsToReceive")}>
                  <Button className="w-full h-24 flex flex-col gap-2 bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg text-white">
                    <ArrowUpRight className="w-6 h-6" />
                    <span className="text-sm font-medium">Contas a Receber</span>
                  </Button>
                </Link>
                <Link to={createPageUrl("CreditCards")}>
                  <Button className="w-full h-24 flex flex-col gap-2 bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-lg text-white">
                    <CreditCard className="w-6 h-6" />
                    <span className="text-sm font-medium">Cartões</span>
                  </Button>
                </Link>
                <Link to={createPageUrl("Crediario")}>
                  <Button className="w-full h-24 flex flex-col gap-2 bg-gradient-to-br from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 shadow-lg text-white">
                    <Calendar className="w-6 h-6" />
                    <span className="text-sm font-medium">Crediário</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Category Spending — Compact Grid (between Quick Actions and Stats) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-8"
        >
          <CategorySpendingCompact
            transactions={transactions}
            creditCardTxs={creditCardTxs}
            budgets={budgets}
            selectedDate={selectedDate}
            onCategoryChanged={loadInitialData}
          />
        </motion.div>

        {/* Stats Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <StatsCard
            title="Saldo Total"
            value={`R$ ${formatBRL(stats.balance)}`}
            icon={Wallet}
            gradient={stats.balance >= 0 ? "from-emerald-500 to-emerald-600" : "from-red-500 to-red-600"}
            trend="+5.2%"
            trendIcon={ArrowUpRight}
          />
          <StatsCard
            title="Receitas Totais"
            value={`R$ ${formatBRL(stats.totalIncome)}`}
            icon={TrendingUp}
            gradient="from-emerald-500 to-emerald-600"
            trend="+12.5%"
            trendIcon={TrendingUp}
          />
        </div>

        {/* Stats Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Despesas do Salário"
            value={`R$ ${formatBRL(stats.totalExpense)}`}
            icon={TrendingDown}
            gradient="from-red-500 to-red-600"
          />
          <StatsCard
            title="Vale - Gasto"
            value={`R$ ${formatBRL(stats.foodVoucherExpense)}`}
            icon={ShoppingCart}
            gradient="from-orange-500 to-orange-600"
          />
          <StatsCard
            title="Vale - Disponível"
            value={`R$ ${formatBRL(stats.foodVoucherRemaining)}`}
            icon={ShoppingCart}
            gradient={stats.foodVoucherRemaining >= 0 ? "from-emerald-500 to-emerald-600" : "from-red-500 to-red-600"}
          />
          <StatsCard
            title="Transações"
            value={stats.transactionCount}
            icon={DollarSign}
            gradient="from-blue-500 to-blue-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-8">
          <FoodVoucherConfig user={user} onUpdate={loadInitialData} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <TransactionChart transactions={monthlyTransactions} />
          </div>
          <div>
            <TransactionChart transactions={monthlyTransactions} creditCardTxs={creditCardTxs} type="pie" />
          </div>
        </div>

        <div className="grid lg:grid-cols-1 mb-8">
          <FuturePlanningWidget bills={bills} />
        </div>

        <div className="grid lg:grid-cols-1">
          <RecentTransactions transactions={monthlyTransactions.slice(0, 5)} />
        </div>

        {/* Share Data */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8"
        >
          <Card className="border-2 shadow-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Compartilhe e Compare</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Compartilhe suas estatísticas financeiras anonimamente e compare sua evolução com outros usuários
              </p>
              <ShareDataButton />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PullToRefresh>
  );
}