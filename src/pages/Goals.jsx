import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Goal } from "@/entities/Goal";
import { User } from "@/entities/User";
import { Transaction } from "@/entities/Transaction";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, TrendingUp, Calendar, Trophy, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import GoalForm from "../components/goals/GoalForm.jsx";
import GoalCard from "../components/goals/GoalCard";

export default function Goals() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        await loadPageData(currentUser.email);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const loadPageData = async (userEmail) => {
    if (!userEmail) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [goalsData, transactionsData] = await Promise.all([
        Goal.filter({ created_by: userEmail }, "-created_date"),
        Transaction.filter({ created_by: userEmail })
      ]);
      
      setGoals(goalsData);

      const totalIncome = transactionsData
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpense = transactionsData
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      setBalance(totalIncome - totalExpense);

    } catch (error) {
      console.error("Erro ao carregar dados da página de metas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (!user) {
        console.error("Usuário não autenticado para salvar meta.");
        return;
      }
      const dataToSave = { ...formData, created_by: user.email };
      if (editingGoal) {
        await Goal.update(editingGoal.id, dataToSave);
      } else {
        await Goal.create(dataToSave);
      }
      setShowForm(false);
      setEditingGoal(null);
      await loadPageData(user.email);
    } catch (error) {
      console.error("Erro ao salvar meta:", error);
    }
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      if (!user) {
        console.error("Usuário não autenticado para excluir meta.");
        return;
      }
      await Goal.delete(id);
      await loadPageData(user.email);
    } catch (error) {
      console.error("Erro ao excluir meta:", error);
    }
  };

  const handleAddContribution = async (goal, amount) => {
    try {
      if (!user) {
        console.error("Usuário não autenticado para adicionar contribuição.");
        return;
      }
      const newAmount = Math.min(goal.current_amount + amount, goal.target_amount);
      const newStatus = newAmount >= goal.target_amount ? 'completed' : goal.status;
      
      await Goal.update(goal.id, {
        current_amount: newAmount,
        status: newStatus
      });
      await loadPageData(user.email);
    } catch (error) {
      console.error("Erro ao adicionar contribuição:", error);
    }
  };

  const stats = React.useMemo(() => {
    const total = goals.length;
    const completed = goals.filter(g => g.status === 'completed').length;
    const active = goals.filter(g => g.status === 'active').length;
    const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);
    const totalCurrent = goals.reduce((sum, g) => sum + g.current_amount, 0);
    const completionRate = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

    return {
      total,
      completed,
      active,
      totalTarget,
      totalCurrent,
      completionRate
    };
  }, [goals]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex justify-between items-center mb-6">
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
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Metas Financeiras</h1>
              <p className="text-slate-600 dark:text-slate-300">Defina e acompanhe seus objetivos financeiros</p>
            </div>
          </div>
          <Button 
            onClick={() => {
              setEditingGoal(null);
              setShowForm(true);
            }}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Meta
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total de Metas</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-emerald-600" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Concluídas</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Ativas</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Progresso Geral</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.completionRate.toFixed(0)}%</p>
                </div>
              </div>
              <Progress value={stats.completionRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingGoal(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Editar Meta' : 'Nova Meta Financeira'}</DialogTitle>
          </DialogHeader>
          <GoalForm
            goal={editingGoal}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingGoal(null); }}
          />
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal, index) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            balance={balance}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddContribution={handleAddContribution}
            index={index}
          />
        ))}
        
        {goals.length === 0 && (
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm md:col-span-2 lg:col-span-3">
            <CardContent className="p-16 text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Nenhuma meta criada</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">Defina seus objetivos financeiros para começar a economizar</p>
              <Button onClick={() => {
                setEditingGoal(null);
                setShowForm(true);
              }} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-5 h-5 mr-2" />
                Criar Primeira Meta
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}