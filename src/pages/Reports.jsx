import React, { useState, useEffect, useMemo } from "react";
import { Transaction } from "@/entities/Transaction";
import { User } from "@/entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import TransactionChart from "../components/dashboard/TransactionChart";
import MonthFilter from "../components/common/MonthFilter";

export default function Reports() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const currentUser = await User.me();
        const data = await Transaction.filter({ created_by: currentUser.email }, "-date");
        setTransactions(data);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date || t.created_date);
      return d.getMonth() === selectedDate.getMonth() &&
             d.getFullYear() === selectedDate.getFullYear();
    });
  }, [transactions, selectedDate]);

  const monthlyStats = useMemo(() => {
    const stats = {};
    transactions.forEach(transaction => {
      const d = new Date(transaction.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      if (!stats[key]) stats[key] = { key, label, income: 0, expense: 0, count: 0 };
      stats[key].count++;
      if (transaction.type === 'income') stats[key].income += transaction.amount;
      else stats[key].expense += Math.abs(transaction.amount);
    });
    return Object.values(stats)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6)
      .map(s => ({ ...s, balance: s.income - s.expense }));
  }, [transactions]);

  const monthStats = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    return { income, expense, balance: income - expense, count: filteredTransactions.length };
  }, [filteredTransactions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("Dashboard"))} className="hover:bg-slate-100 dark:hover:bg-slate-700">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Relatórios</h1>
              <p className="text-slate-600 dark:text-slate-300">Análise detalhada das suas finanças</p>
            </div>
          </div>
          <div className="sm:ml-auto">
            <MonthFilter selectedDate={selectedDate} onChange={setSelectedDate} />
          </div>
        </div>

        {/* Month Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-800/80">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Receitas</p>
              <p className="text-xl font-bold text-emerald-600">R$ {monthStats.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-800/80">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Despesas</p>
              <p className="text-xl font-bold text-red-600">R$ {monthStats.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-800/80">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Saldo</p>
              <p className={`text-xl font-bold ${monthStats.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                R$ {monthStats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-800/80">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Transações</p>
              <p className="text-xl font-bold text-blue-600">{monthStats.count}</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <TransactionChart transactions={filteredTransactions} />
        <TransactionChart transactions={filteredTransactions} type="pie" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Resumo dos Últimos 6 Meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyStats.map((stat, index) => (
                <motion.div
                  key={stat.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white capitalize">{stat.label}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{stat.count} transações</p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold text-emerald-600 text-sm">R$ {stat.income.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      <span className="font-semibold text-red-600 text-sm">R$ {stat.expense.toFixed(2)}</span>
                    </div>
                    <div className={`font-bold text-lg ${stat.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      R$ {stat.balance.toFixed(2)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}