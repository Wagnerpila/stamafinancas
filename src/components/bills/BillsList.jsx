import React from 'react';
import { motion } from "framer-motion";
import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, CheckCircle, Clock, MessageSquare } from "lucide-react";

const statusConfig = {
  paid: { label: "Paga", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  overdue: { label: "Atrasada", color: "bg-red-100 text-red-800", icon: Clock },
};

export default function BillsList({ bills, onEdit, onDelete, onMarkAsPaid, type, getPurchaseNote }) {
  // Placeholder de parcela futura de cartão (category="credit_card") — o comentário de
  // identificação (ex: "Sofá") mora em PurchaseNote (card_id + título), não no campo notes; cai
  // pro notes normal (auto-gerado, ex: "Conta com vencimento em...") pras demais contas.
  const resolveNotes = (bill) =>
    (bill.category === "credit_card" && bill.card_id && getPurchaseNote?.(bill.card_id, bill.title)) || bill.notes;

  if (bills.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p>Nenhuma conta encontrada</p>
      </div>
    );
  }

  const BillCard = ({ bill }) => {
    const isOverdue = isPast(parseISO(bill.due_date)) && bill.status === 'pending';
    const currentStatus = isOverdue ? 'overdue' : bill.status;
    const config = statusConfig[currentStatus];

    return (
       <Card className="mb-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold text-slate-800 dark:text-white">{bill.title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Vence em: {format(parseISO(bill.due_date), "dd/MM/yyyy", { locale: ptBR })}
              </p>
              {resolveNotes(bill) && (
                <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 italic mt-1">
                  <MessageSquare className="w-3 h-3 shrink-0" /> {resolveNotes(bill)}
                </p>
              )}
            </div>
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="-mt-2 -mr-2">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {bill.status === 'pending' && (
                  <DropdownMenuItem onClick={() => onMarkAsPaid(bill)} className="cursor-pointer">
                    <CheckCircle className="mr-2 h-4 w-4" /> {type === 'payable' ? 'Marcar como Paga' : 'Marcar como Recebida'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onEdit(bill)} className="cursor-pointer">
                  <Edit className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(bill.id)} className="text-red-600 cursor-pointer">
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex justify-between items-end mt-2">
            <p className={`font-bold text-lg ${type === 'payable' ? 'text-red-600' : 'text-emerald-600'}`}>
              R$ {bill.amount.toFixed(2)}
            </p>
            <Badge className={config.color}>
              <config.icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  };

  return (
    <div className="space-y-4">
      {/* Mobile View */}
      <div className="md:hidden">
        {bills.map((bill) => (
          <motion.div
            key={bill._virtual ? `${bill.id}-${bill.due_date}` : bill.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <BillCard bill={bill} />
          </motion.div>
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <Card className="overflow-hidden border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-300">Título</th>
                <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-300">Valor</th>
                <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-300">Vencimento</th>
                <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-300">Status</th>
                <th className="p-4 text-right font-semibold text-slate-600 dark:text-slate-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => {
                const isOverdue = isPast(parseISO(bill.due_date)) && bill.status === 'pending';
                const currentStatus = isOverdue ? 'overdue' : bill.status;
                const config = statusConfig[currentStatus];

                return (
                  <tr key={bill._virtual ? `${bill.id}-${bill.due_date}` : bill.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                    <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                      {bill.title}
                      {resolveNotes(bill) && (
                        <p className="flex items-center gap-1 text-xs font-normal text-slate-400 dark:text-slate-500 italic mt-0.5">
                          <MessageSquare className="w-3 h-3 shrink-0" /> {resolveNotes(bill)}
                        </p>
                      )}
                    </td>
                    <td className={`p-4 font-semibold ${type === 'payable' ? 'text-red-600' : 'text-emerald-600'}`}>
                      R$ {bill.amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                     {format(parseISO(bill.due_date), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="p-4">
                      <Badge className={config.color}>
                        <config.icon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {bill.status === 'pending' && (
                            <DropdownMenuItem onClick={() => onMarkAsPaid(bill)} className="cursor-pointer">
                              <CheckCircle className="mr-2 h-4 w-4" /> {type === 'payable' ? 'Marcar como Paga' : 'Marcar como Recebida'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onEdit(bill)} className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDelete(bill.id)} className="text-red-600 cursor-pointer">
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}