import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function BudgetAlert({ currentSpending, monthlyBudget, show }) {
  if (!show || !monthlyBudget || monthlyBudget <= 0) return null;

  const percentage = (currentSpending / monthlyBudget) * 100;
  const remaining = monthlyBudget - currentSpending;

  // Show alert when spending is above 80% of budget
  if (percentage < 80) return null;

  const isOverBudget = percentage >= 100;
  const isNearLimit = percentage >= 80 && percentage < 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <Alert variant={isOverBudget ? "destructive" : "default"} className={`${isOverBudget ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'} shadow-lg`}>
          <AlertTriangle className={`h-5 w-5 ${isOverBudget ? 'text-red-600' : 'text-amber-600'}`} />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <p className={`font-semibold ${isOverBudget ? 'text-red-900' : 'text-amber-900'}`}>
                {isOverBudget ? '🚨 Orçamento Excedido!' : '⚠️ Atenção: Próximo do Limite!'}
              </p>
              <p className={`text-sm mt-1 ${isOverBudget ? 'text-red-700' : 'text-amber-700'}`}>
                Você gastou <strong>R$ {currentSpending.toFixed(2)}</strong> de <strong>R$ {monthlyBudget.toFixed(2)}</strong> ({percentage.toFixed(0)}%)
                {!isOverBudget && ` - Restam R$ ${remaining.toFixed(2)}`}
              </p>
            </div>
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="outline" size="sm" className="ml-4">
                <TrendingUp className="w-4 h-4 mr-2" />
                Ver Detalhes
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
}