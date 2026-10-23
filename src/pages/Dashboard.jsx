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
  ShoppingCart
} from "lucide-react";
import StatsCard from "../components/dashboard/StatsCard";
import TransactionChart from "../components/dashboard/TransactionChart";
import RecentTransactions from "../components/dashboard/RecentTransactions";
import FoodVoucherConfig from "../components/dashboard/FoodVoucherConfig";
import ShareDataButton from "../components/sharing/ShareDataButton";
import FuturePlanningWidget from "../components/dashboard/FuturePlanningWidget";
import FinanceOverview from "../components/dashboard/FinanceOverview";
import CategorySpendingCompact from "../components/dashboard/CategorySpendingCompact";
import SpendingBreakdownWidget from "../components/common/SpendingBreakdownWidget";
import MonthFilter from "../components/common/MonthFilter";
import PullToRefresh from "../components/mobile/PullToRefresh";
import useRefreshOnForeground from "../hooks/useRefreshOnForeground";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

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

  // Mesmo filtro de período, mas para CreditCardTransaction (pela data da compra) — usado só pelo
  // gráfico de pizza (TransactionChart). Sem isso, o pie chart recebia TODAS as compras de cartão
  // já lançadas (não só as do mês/ano selecionado) e a fatia de cada categoria não batia com o
  // card "Gastos por Categoria" logo abaixo, que já filtra por período corretamente.
  const monthlyCreditCardTxs = useMemo(() => {
    return creditCardTxs.filter(t => {
      const raw = t.purchase_date || t.created_date;
      const d = raw && raw.length === 10 ? new Date(raw + "T00:00:00") : new Date(raw);
      if (!d || isNaN(d)) return false;
      if (yearMode) return d.getFullYear() === selectedDate.getFullYear();
      return d.getMonth() === selectedDate.getMonth() &&
             d.getFullYear() === selectedDate.getFullYear();
    });
  }, [creditCardTxs, selectedDate, yearMode]);

  // Agrupa receitas do período por categoria (Salário, Pix, Dinheiro, Investimentos, etc. — o
  // que o usuário tiver cadastrado como categoria de receita) pro widget "Receitas por Categoria".
  const incomeBreakdown = useMemo(() => {
    const totals = {};
    const items = {};
    monthlyTransactions.forEach(t => {
      if (t.type !== 'income') return;
      const key = t.category || 'other_income';
      totals[key] = (totals[key] || 0) + Math.abs(t.amount || 0);
      if (!items[key]) items[key] = [];
      items[key].push({ id: t.id, description: t.description, amount: t.amount, date: t.date, notes: t.notes });
    });
    Object.values(items).forEach(list => list.sort((a, b) => new Date(b.date) - new Date(a.date)));

    const catMeta = {};
    categories.filter(c => c.type === 'income').forEach(c => { catMeta[c.name] = c; });
    const groups = Object.keys(totals).map(key => {
      const meta = catMeta[key];
      return { key, name: meta?.name || key, icon: meta?.icon || "💰", color: meta?.color || "#10b981", amount: totals[key] };
    }).sort((a, b) => b.amount - a.amount);

    return { groups, itemsByGroup: items };
  }, [monthlyTransactions, categories]);

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
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <FinanceOverview
          transactions={transactions}
          creditCardTxs={creditCardTxs}
          bills={bills}
          budgets={budgets}
          selectedDate={selectedDate}
          onChangeDate={(d) => {
            setYearMode(false);
            setSelectedDate(d);
          }}
        />

        {/* Detalhes — widgets completos do período */}
        <div className="mb-8 mt-4 flex flex-col gap-4 border-t border-slate-200/70 pt-8 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="section-label flex-1">Detalhes</p>
          <MonthFilter
            selectedDate={selectedDate}
            onChange={setSelectedDate}
            yearMode={yearMode}
            onToggleYearMode={() => setYearMode(v => !v)}
          />
        </div>

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
            yearMode={yearMode}
            onCategoryChanged={loadInitialData}
          />
        </motion.div>

        {/* Income Breakdown — Pix, Dinheiro, Salário, Investimentos e demais categorias de receita */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.17 }}
          className="mb-8"
        >
          <SpendingBreakdownWidget
            title={`Receitas por Categoria${yearMode ? " — Ano" : ""}`}
            icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
            groups={incomeBreakdown.groups}
            itemsByGroup={incomeBreakdown.itemsByGroup}
            emptyMessage="Nenhuma receita neste período."
            positive
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
            <TransactionChart transactions={monthlyTransactions} creditCardTxs={monthlyCreditCardTxs} type="pie" />
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
          <Card className="border-2">
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