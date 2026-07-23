import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const categoryLabels = {
  salary: "Salário",
  freelance: "Freelance", 
  investment: "Investimento",
  other_income: "Outras Receitas",
  food: "Alimentação",
  transport: "Transporte",
  health: "Saúde",
  education: "Educação",
  entertainment: "Entretenimento",
  shopping: "Compras",
  bills: "Contas",
  rent: "Aluguel",
  other_expense: "Outras Despesas"
};

const paymentLabels = {
  cash: "💵 Dinheiro",
  pix: "⚡ PIX",
  debit: "💳 Débito",
  credit_card: "💳 Crédito",
  food_voucher: "🎫 Vale Alimentação"
};

export default function RecentTransactions({ transactions = [] }) {
  const recentTransactions = transactions
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Transações Recentes
          </CardTitle>
          <Link to={createPageUrl("Transactions")}>
            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
              Ver todas
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">Nenhuma transação encontrada</p>
                <Link to={createPageUrl("NewTransaction")}>
                  <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                    Adicionar primeira transação
                  </Button>
                </Link>
              </div>
            ) : (
              recentTransactions.map((transaction, index) => (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      transaction.type === 'income' 
                        ? 'bg-emerald-100 text-emerald-600' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {transaction.type === 'income' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{transaction.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {categoryLabels[transaction.category]}
                        </Badge>
                        {transaction.payment_method && (
                          <Badge variant="outline" className="text-xs">
                            {paymentLabels[transaction.payment_method] || transaction.payment_method}
                          </Badge>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {format(new Date(transaction.date), 'dd MMM', { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      transaction.type === 'income' 
                        ? 'text-emerald-600' 
                        : 'text-red-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}R$ {Math.abs(transaction.amount).toFixed(2)}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}