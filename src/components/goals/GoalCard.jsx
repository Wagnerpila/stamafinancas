import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Plus, Trophy, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const categoryLabels = {
  emergency_fund: "Reserva de Emergência",
  vacation: "Viagem/Férias",
  house: "Casa Própria",
  car: "Carro",
  education: "Educação",
  retirement: "Aposentadoria",
  investment: "Investimento",
  health: "Saúde",
  entertainment: "Entretenimento",
  other: "Outros"
};

const priorityColors = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-red-100 text-red-800"
};

export default function GoalCard({ goal, onEdit, onDelete, onAddContribution, index, balance }) {
  const [showAddContribution, setShowAddContribution] = useState(false);
  const [contributionAmount, setContributionAmount] = useState('');

  const progress = (goal.current_amount / goal.target_amount) * 100;
  const isCompleted = goal.status === 'completed';
  const daysLeft = differenceInDays(new Date(goal.target_date), new Date());

  const projectedAmount = (goal.current_amount || 0) + (balance || 0);

  const handleAddContribution = () => {
    if (contributionAmount && parseFloat(contributionAmount) > 0) {
      onAddContribution(goal, parseFloat(contributionAmount));
      setContributionAmount('');
      setShowAddContribution(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card className={`border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 ${
        isCompleted ? 'ring-2 ring-emerald-200' : ''
      }`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {isCompleted && <Trophy className="w-5 h-5 text-emerald-600" />}
                {goal.title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {categoryLabels[goal.category]}
                </Badge>
                <Badge className={`${priorityColors[goal.priority]} text-xs`}>
                  {goal.priority === 'high' ? 'Alta' : goal.priority === 'medium' ? 'Média' : 'Baixa'}
                </Badge>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(goal)}
                className="hover:bg-blue-100 hover:text-blue-600 h-8 w-8"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(goal.id)}
                className="hover:bg-red-100 hover:text-red-600 h-8 w-8"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {goal.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400">{goal.description}</p>
          )}
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Progresso Salvo</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {progress.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={progress} 
              className={`h-3 ${isCompleted ? 'bg-emerald-100' : ''}`}
            />
            <div className="flex justify-between items-center mt-2 text-sm">
              <span className="text-emerald-600 font-semibold">
                R$ {(goal.current_amount || 0).toFixed(2)}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                de R$ {(goal.target_amount || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {!isCompleted && (
            <div className="text-sm text-slate-600 dark:text-slate-300 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <span>Projeção com saldo atual: </span>
              <span className={`font-bold ${projectedAmount >= (goal.current_amount || 0) ? 'text-blue-600' : 'text-red-600'}`}>
                R$ {projectedAmount.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Calendar className="w-4 h-4" />
            <span>
              Meta: {format(new Date(goal.target_date), 'dd MMM yyyy', { locale: ptBR })}
            </span>
            {daysLeft > 0 && !isCompleted && (
              <span className="ml-auto">
                ({daysLeft} dias restantes)
              </span>
            )}
          </div>

          {goal.monthly_contribution && !isCompleted && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <strong>Sugestão:</strong> Economize R$ {goal.monthly_contribution.toFixed(2)} por mês
              </p>
            </div>
          )}

          {!isCompleted && (
            <div className="space-y-2">
              {!showAddContribution ? (
                <Button
                  onClick={() => setShowAddContribution(true)}
                  variant="outline"
                  className="w-full text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Contribuição
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="R$ 0,00"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                  />
                  <Button
                    onClick={handleAddContribution}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => {
                      setShowAddContribution(false);
                      setContributionAmount('');
                    }}
                    variant="outline"
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}

          {isCompleted && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center">
              <Trophy className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Meta Concluída!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}