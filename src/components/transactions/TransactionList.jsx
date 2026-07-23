import React, { useState } from 'react';
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, TrendingUp, TrendingDown, CheckSquare, Square, Trash } from "lucide-react";

const categoryStyles = {
  salary: "bg-emerald-100 text-emerald-800",
  freelance: "bg-emerald-100 text-emerald-800",
  investment: "bg-sky-100 text-sky-800",
  other_income: "bg-slate-100 text-slate-800",
  food: "bg-orange-100 text-orange-800",
  transport: "bg-blue-100 text-blue-800",
  health: "bg-red-100 text-red-800",
  education: "bg-indigo-100 text-indigo-800",
  entertainment: "bg-pink-100 text-pink-800",
  shopping: "bg-purple-100 text-purple-800",
  bills: "bg-yellow-100 text-yellow-800",
  rent: "bg-amber-100 text-amber-800",
  other_expense: "bg-slate-100 text-slate-800",
};

export default function TransactionList({ transactions, onEdit, onDelete, onDeleteMany }) {
  const [selected, setSelected] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelected(prev => prev.length === transactions.length ? [] : transactions.map(t => t.id));
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Excluir ${selected.length} transação(ões)? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    await onDeleteMany(selected);
    setSelected([]);
    setDeleting(false);
  };

  const isSelectMode = selected.length > 0;

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p>Nenhuma transação encontrada</p>
      </div>
    );
  }

  const TransactionCard = ({ transaction }) => (
    <Card
      className={`mb-3 backdrop-blur-sm border-0 shadow-md transition-all cursor-pointer ${
        selected.includes(transaction.id)
          ? 'bg-red-50 dark:bg-red-900/20 ring-2 ring-red-400'
          : 'bg-white/80 dark:bg-slate-800/80'
      }`}
      onClick={() => toggleSelect(transaction.id)}
    >
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="shrink-0 text-slate-400">
            {selected.includes(transaction.id)
              ? <CheckSquare className="w-5 h-5 text-red-500" />
              : <Square className="w-5 h-5" />}
          </div>
          <div className={`p-2 rounded-full shrink-0 ${transaction.type === 'income' ? 'bg-emerald-100' : 'bg-red-100'}`}>
            {transaction.type === 'income' ? (
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 dark:text-white truncate">{transaction.description}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {format(parseISO(transaction.date), "dd/MM/yyyy", { locale: ptBR })}
            </p>
            <Badge className={`mt-1 ${categoryStyles[transaction.category] || categoryStyles.other_expense}`}>
              {transaction.category}
            </Badge>
          </div>
        </div>
        <div className="text-right flex items-center gap-2 shrink-0">
          <p className={`font-bold ${transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
            {transaction.type === 'income' ? '+' : '-'} R$ {Math.abs(transaction.amount).toFixed(2)}
          </p>
          <div onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onEdit(transaction); }} className="cursor-pointer">
                  <Edit className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onDelete(transaction.id); }} className="text-red-600 cursor-pointer">
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      {/* Barra de seleção */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleAll}
          className="gap-2 text-slate-600"
        >
          {selected.length === transactions.length && transactions.length > 0
            ? <CheckSquare className="w-4 h-4" />
            : <Square className="w-4 h-4" />}
          {selected.length === 0
            ? 'Selecionar todas'
            : selected.length === transactions.length
              ? 'Desmarcar todas'
              : `${selected.length} selecionada(s)`}
        </Button>

        {isSelectMode && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSelected}
            disabled={deleting}
            className="gap-2"
          >
            {deleting
              ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              : <Trash className="w-4 h-4" />}
            {deleting ? 'Excluindo...' : `Excluir ${selected.length}`}
          </Button>
        )}
      </div>

      {/* Mobile View */}
      <div className="md:hidden">
        {transactions.map((transaction) => (
          <motion.div
            key={transaction.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TransactionCard transaction={transaction} />
          </motion.div>
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <Card className="overflow-hidden border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="p-4 text-left w-8">
                  <button onClick={toggleAll}>
                    {selected.length === transactions.length && transactions.length > 0
                      ? <CheckSquare className="w-4 h-4 text-red-500" />
                      : <Square className="w-4 h-4 text-slate-400" />}
                  </button>
                </th>
                <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-300">Descrição</th>
                <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-300">Valor</th>
                <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-300">Categoria</th>
                <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-300">Data</th>
                <th className="p-4 text-right font-semibold text-slate-600 dark:text-slate-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className={`border-b border-slate-100 dark:border-slate-700 last:border-0 cursor-pointer transition-colors ${
                    selected.includes(transaction.id)
                      ? 'bg-red-50 dark:bg-red-900/20'
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/30'
                  }`}
                  onClick={() => toggleSelect(transaction.id)}
                >
                  <td className="p-4">
                    {selected.includes(transaction.id)
                      ? <CheckSquare className="w-4 h-4 text-red-500" />
                      : <Square className="w-4 h-4 text-slate-400" />}
                  </td>
                  <td className="p-4 font-medium text-slate-800 dark:text-slate-200">{transaction.description}</td>
                  <td className={`p-4 font-semibold ${transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {transaction.type === 'income' ? '+' : '-'} R$ {Math.abs(transaction.amount).toFixed(2)}
                  </td>
                  <td className="p-4">
                    <Badge className={categoryStyles[transaction.category] || categoryStyles.other_expense}>
                      {transaction.category}
                    </Badge>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">
                    {format(parseISO(transaction.date), "dd/MM/yyyy", { locale: ptBR })}
                  </td>
                  <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onEdit(transaction); }} className="cursor-pointer">
                          <Edit className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onDelete(transaction.id); }} className="text-red-600 cursor-pointer">
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {deleting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
            <p className="text-slate-700 dark:text-slate-200 font-medium">Excluindo transações...</p>
          </div>
        </div>
      )}
    </div>
  );
}