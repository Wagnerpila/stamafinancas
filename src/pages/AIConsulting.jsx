import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AIConsultation } from "@/entities/AIConsultation";
import { Transaction } from "@/entities/Transaction";
import { Bill } from "@/entities/Bill";
import { Goal } from "@/entities/Goal";
import { User } from "@/entities/User";
import { monthlySummaryAI, consultingChatAI } from "@/api/integrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Lightbulb, TrendingUp, PieChart, Target, Loader2, RefreshCw, BookOpen, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { usePlanAccess, PlanRestriction, requestUpgrade } from "../components/common/PlanRestriction";

const quickQuestions = [
  {
    question: "Como posso melhorar meu controle de gastos?",
    category: "expense_analysis",
    icon: PieChart
  },
  {
    question: "Qual a melhor estratégia para quitar minhas dívidas?",
    category: "debt_management", 
    icon: TrendingUp
  },
  {
    question: "Como planejar minha reserva de emergência?",
    category: "savings_strategy",
    icon: Target
  },
  {
    question: "Análise minha situação financeira atual",
    category: "budget_planning",
    icon: Lightbulb
  }
];

export default function AIConsulting() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [financialData, setFinancialData] = useState(null);
  const [user, setUser] = useState(null);
  const [savedSummary, setSavedSummary] = useState(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const { hasAccess } = usePlanAccess(user);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        await Promise.all([
          loadData(currentUser.email),
          loadConsultations(currentUser.email),
          loadSummary(currentUser.email)
        ]);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };
    loadInitialData();
  }, []);

  const loadSummary = async (userEmail) => {
    try {
      const now = new Date();
      const refMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const summaries = await base44.entities.SpendingSummary.filter({ created_by: userEmail, reference_month: refMonth });
      if (summaries.length > 0) setSavedSummary(summaries[0]);
    } catch (e) { /* ignore */ }
  };

  const generateMonthlySummary = async () => {
    if (!financialData || !user) return;
    setGeneratingSummary(true);
    try {
      const now = new Date();
      const refMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const { transactions } = financialData;
      const monthTxs = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const totalIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const totalExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
      const byCategory = monthTxs.filter(t => t.type === 'expense').reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount); return acc;
      }, {});
      const topCategoryEntry = Object.entries(byCategory).sort(([,a],[,b]) => b - a)[0];
      const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
      const { output } = await monthlySummaryAI({
        income: totalIncome,
        expense: totalExpense,
        balance: totalIncome - totalExpense,
        savings_rate: savingsRate,
        category_spending: byCategory,
      });
      const summaryData = {
        reference_month: refMonth,
        total_income: totalIncome,
        total_expense: totalExpense,
        balance: totalIncome - totalExpense,
        savings_rate: savingsRate,
        top_category: topCategoryEntry ? topCategoryEntry[0] : '',
        top_category_amount: topCategoryEntry ? topCategoryEntry[1] : 0,
        ai_insights: output.insights,
        savings_tips: output.tips
      };
      const existing = savedSummary;
      if (existing) {
        const updated = await base44.entities.SpendingSummary.update(existing.id, summaryData);
        setSavedSummary(updated);
      } else {
        const created = await base44.entities.SpendingSummary.create(summaryData);
        setSavedSummary(created);
      }
    } catch (e) {
      console.error("Erro ao gerar resumo:", e);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const loadData = async (userEmail) => {
    if (!userEmail) return;
    try {
      const [transactions, bills, goals] = await Promise.all([
        Transaction.filter({ created_by: userEmail }, "-date"),
        Bill.filter({ created_by: userEmail }, "-due_date"),
        Goal.filter({ created_by: userEmail }, "-created_date")
      ]);
      
      setFinancialData({ transactions, bills, goals });
    } catch (error) {
      console.error("Erro ao carregar dados financeiros:", error);
    }
  };

  const loadConsultations = async (userEmail) => {
    if (!userEmail) return;
    try {
      const data = await AIConsultation.filter({ created_by: userEmail }, "-created_date", 10);
      setConsultations(data);
    } catch (error) {
      console.error("Erro ao carregar consultas:", error);
    }
  };

  const generateFinancialContext = () => {
    if (!financialData) return "";

    const { transactions, bills, goals } = financialData;

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const pendingBills = bills.filter(b => b.status === 'pending').reduce((sum, b) => sum + b.amount, 0);
    const activeGoals = goals.filter(g => g.status === 'active').length;

    return `
    Contexto financeiro do usuário:
    - Receitas totais: R$ ${totalIncome.toFixed(2)}
    - Despesas totais: R$ ${totalExpense.toFixed(2)}
    - Saldo atual: R$ ${(totalIncome - totalExpense).toFixed(2)}
    - Contas pendentes: R$ ${pendingBills.toFixed(2)}
    - Metas ativas: ${activeGoals}
    - Total de transações: ${transactions.length}
    
    Principais categorias de gastos:
    ${Object.entries(
      transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
          return acc;
        }, {})
    )
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([cat, val]) => `- ${cat}: R$ ${val.toFixed(2)}`)
      .join('\n')}
    `;
  };

  const handleQuickQuestion = (question) => {
    setCurrentQuestion(question);
    handleSubmitQuestion(question);
  };

  const handleSubmitQuestion = async (question = currentQuestion) => {
    if (!hasAccess.ai_consulting) {
      return;
    }

    if (!question.trim()) return;

    setIsLoading(true);
    try {
      const context = generateFinancialContext();

      const { response } = await consultingChatAI({ context, question });

      const consultation = {
        question,
        response,
        category: determineCategory(question)
      };

      await AIConsultation.create(consultation);
      await loadConsultations(user.email);
      setCurrentQuestion('');
    } catch (error) {
      console.error("Erro na consultoria:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const determineCategory = (question) => {
    const keywords = {
      budget_planning: ['orçamento', 'planejar', 'planejamento', 'organizar'],
      investment_advice: ['investir', 'investimento', 'aplicar', 'render'],
      debt_management: ['dívida', 'empréstimo', 'financiamento', 'quitar'],
      savings_strategy: ['economizar', 'poupar', 'reserva', 'guardar'],
      expense_analysis: ['gasto', 'despesa', 'controlar', 'reduzir'],
      tax_planning: ['imposto', 'ir', 'declaração'],
    };

    const lowerQuestion = question.toLowerCase();
    
    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => lowerQuestion.includes(word))) {
        return category;
      }
    }
    
    return 'general';
  };

  if (user && !hasAccess.ai_consulting) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <PlanRestriction
          title="Consultoria IA Premium"
          description="A consultoria financeira com inteligência artificial está disponível apenas no plano Premium."
          onUpgrade={() => requestUpgrade(user)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="hover:bg-slate-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Consultoria Financeira IA</h1>
              <p className="text-slate-600 dark:text-slate-300 mt-2">Receba conselhos personalizados baseados nos seus dados financeiros</p>
            </div>
          </div>
        </div>

        {/* Monthly AI Summary */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              Resumo Mensal com IA
            </CardTitle>
            <Button
              onClick={generateMonthlySummary}
              disabled={generatingSummary}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              {generatingSummary ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {generatingSummary ? 'Gerando...' : savedSummary ? 'Atualizar' : 'Gerar Análise'}
            </Button>
          </CardHeader>
          <CardContent>
            {savedSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center shadow-sm">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Receita do Mês</p>
                    <p className="text-lg font-bold text-emerald-600">R$ {savedSummary.total_income?.toFixed(2)}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center shadow-sm">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Despesa do Mês</p>
                    <p className="text-lg font-bold text-red-600">R$ {savedSummary.total_expense?.toFixed(2)}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center shadow-sm">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Saldo</p>
                    <p className={`text-lg font-bold ${savedSummary.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>R$ {savedSummary.balance?.toFixed(2)}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center shadow-sm">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Taxa de Poupança</p>
                    <p className={`text-lg font-bold ${savedSummary.savings_rate >= 20 ? 'text-emerald-600' : 'text-yellow-600'}`}>{savedSummary.savings_rate?.toFixed(1)}%</p>
                  </div>
                </div>
                {savedSummary.ai_insights && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
                    <p className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-2">💡 Análise da IA</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{savedSummary.ai_insights}</p>
                  </div>
                )}
                {savedSummary.savings_tips && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">💰 Dicas de Economia Personalizadas</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{savedSummary.savings_tips}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">Clique em "Gerar Análise" para obter um resumo financeiro do mês atual com dicas personalizadas.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">Fazer uma pergunta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                placeholder="Digite sua pergunta sobre finanças..."
                value={currentQuestion}
                onChange={(e) => setCurrentQuestion(e.target.value)}
                className="min-h-[100px]"
              />
              <Button 
                onClick={() => handleSubmitQuestion()}
                disabled={isLoading || !currentQuestion.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Send className="w-5 h-5 mr-2" />
                )}
                {isLoading ? 'Analisando...' : 'Enviar Pergunta'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">Perguntas Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickQuestions.map((item, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => handleQuickQuestion(item.question)}
                  disabled={isLoading}
                  className="p-4 h-auto text-left hover:bg-purple-50 hover:border-purple-200"
                >
                  <div className="flex items-start gap-3 w-full">
                    <item.icon className="w-5 h-5 text-purple-600 mt-1" />
                    <span className="text-sm">{item.question}</span>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Consultas Recentes</h2>
        
        <AnimatePresence>
          {consultations.map((consultation, index) => (
            <motion.div
              key={consultation.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">P</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">{consultation.question}</p>
                        <Badge variant="secondary" className="mt-2 text-xs">
                          {consultation.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <div className="prose prose-sm max-w-none">
                          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{consultation.response}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {consultations.length === 0 && (
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-16 text-center">
              <Bot className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Nenhuma consulta ainda</h3>
              <p className="text-slate-500 dark:text-slate-400">Faça sua primeira pergunta para receber conselhos personalizados</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}