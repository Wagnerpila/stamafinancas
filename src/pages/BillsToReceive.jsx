import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, CreditCard, Calendar, DollarSign, Clock } from "lucide-react";
import { motion } from "framer-motion";
import BillForm from "../components/bills/BillForm.jsx";
import BillsList from "../components/bills/BillsList";
import MonthFilter from "../components/common/MonthFilter";
import { format, startOfMonth } from "date-fns";

// Retorna se uma bill (não recorrente) deve aparecer no mês selecionado
// Para contas recorrentes originais, a lógica está em filteredBills diretamente
function billAppearsInMonth(bill, selectedDate) {
  if (!bill.due_date) return false;
  const due = new Date(bill.due_date.slice(0, 10) + "T00:00:00");
  if (isNaN(due)) return false;

  const sel = startOfMonth(selectedDate);
  const origin = startOfMonth(due);

  // Contas recorrentes originais: verifica só o intervalo
  if (bill.recurrence && bill.recurrence !== "none") {
    if (sel < origin) return false;
    if (bill.recurrence === "monthly") return true;
    if (bill.recurrence === "quarterly") {
      const diffMonths = Math.round((sel - origin) / (1000 * 60 * 60 * 24 * 30.44));
      return diffMonths % 3 === 0;
    }
    if (bill.recurrence === "yearly") {
      return due.getMonth() === selectedDate.getMonth();
    }
    return false;
  }

  // Conta não recorrente paga: aparece no mês do due_date (que é o mês em que foi paga/venceu)
  if (bill.status === "paid") {
    return format(origin, "yyyy-MM") === format(sel, "yyyy-MM");
  }

  // Conta não recorrente pendente: aparece só no mês do vencimento
  return format(origin, "yyyy-MM") === format(sel, "yyyy-MM");
}

// Gera uma "instância virtual" da bill para o mês selecionado (com due_date ajustado)
function buildVirtualBill(bill, selectedDate) {
  if (!bill.recurrence || bill.recurrence === "none") return bill;
  if (bill.status === "paid") return bill;

  const due = new Date(bill.due_date.slice(0, 10) + "T00:00:00");
  const targetDue = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), due.getDate());
  return {
    ...bill,
    _virtual: true,
    _originalId: bill.id,
    due_date: format(targetDue, "yyyy-MM-dd"),
  };
}

export default function BillsToReceive() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        await loadBills(currentUser.email);
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const loadBills = async (userEmail) => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const data = await base44.entities.Bill.filter({ type: "receivable", created_by: userEmail }, "-due_date");
      setBills(data);
    } catch (error) {
      console.error("Erro ao carregar contas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingBill) {
        await base44.entities.Bill.update(editingBill.id, { ...formData, type: "receivable" });
      } else {
        await base44.entities.Bill.create({ ...formData, type: "receivable", created_by: user?.email });
      }
      setShowForm(false);
      setEditingBill(null);
      await loadBills(user.email);
    } catch (error) {
      console.error("Erro ao salvar conta:", error);
    }
  };

  const handleEdit = (bill) => {
    const originalId = bill._originalId || bill.id;
    const original = bills.find(b => b.id === originalId);
    setEditingBill(original || bill);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.Bill.delete(id);
      await loadBills(user.email);
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
    }
  };

  const handleMarkAsPaid = async (bill) => {
    try {
      if (!user) {
        console.error("Usuário não encontrado");
        alert("Erro: usuário não encontrado");
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const originalId = bill._originalId || bill.id;
      const originalBill = bills.find(b => b.id === originalId);
      const srcBill = originalBill || bill;

      // Se for vale alimentação, atualizar o saldo (não gera transação)
      if (srcBill.is_food_voucher) {
        const currentBalance = user.food_voucher_balance || 0;
        const newBalance = currentBalance + srcBill.amount;
        await base44.auth.updateMe({ food_voucher_balance: newBalance });
        setUser({ ...user, food_voucher_balance: newBalance });
      } else {
        // Usa a categoria da conta diretamente (nome customizado)
        const category = srcBill.category || 'other_income';
        await base44.entities.Transaction.create({
          description: `Recebimento da conta: ${srcBill.title}`,
          amount: srcBill.amount,
          type: 'income',
          category: category,
          date: today,
          notes: `Referente a uma conta a receber com vencimento em ${bill.due_date}`,
          linked_bill_id: originalId,
        });
      }

      const isRecurring = srcBill.recurrence && srcBill.recurrence !== "none";

      if (isRecurring) {
        // Conta recorrente: cria cópia paga apenas para o mês específico, NÃO altera a original
        await base44.entities.Bill.create({
          title: srcBill.title,
          description: srcBill.description,
          amount: srcBill.amount,
          type: "receivable",
          category: srcBill.category,
          due_date: bill.due_date,
          status: "paid",
          paid_date: today,
          recurrence: "none",
          notes: srcBill.notes,
          is_food_voucher: srcBill.is_food_voucher,
          linked_bill_id: originalId,
        });
        // A bill original permanece intacta para os próximos meses
      } else {
        await base44.entities.Bill.update(originalId, { status: "paid", paid_date: today });
      }

      await loadBills(user.email);

      const message = srcBill.is_food_voucher
        ? `Vale alimentação de R$ ${srcBill.amount.toFixed(2)} adicionado ao seu saldo!`
        : `Conta "${srcBill.title}" marcada como recebida e registrada nas receitas!`;
      alert(message);

    } catch (error) {
      console.error("Erro detalhado ao marcar como recebida:", error);
      alert(`Erro ao marcar conta como recebida: ${error.message}`);
    }
  };

  // Filtra e expande contas recorrentes para o mês selecionado
  const filteredBills = useMemo(() => {
    const selectedMonthKey = format(startOfMonth(selectedDate), "yyyy-MM");

    // Coleta IDs das contas recorrentes originais que já têm cópia paga neste mês específico
    const recurringIdsPaidThisMonth = new Set();
    bills.forEach(bill => {
      if (
        bill.status === "paid" &&
        (!bill.recurrence || bill.recurrence === "none") &&
        bill.linked_bill_id
      ) {
        const dueMth = bill.due_date
          ? format(startOfMonth(new Date(bill.due_date.slice(0, 10) + "T00:00:00")), "yyyy-MM")
          : null;
        if (dueMth === selectedMonthKey) {
          recurringIdsPaidThisMonth.add(bill.linked_bill_id);
        }
      }
    });

    const result = [];
    bills.forEach(bill => {
      const isRecurringOriginal = bill.recurrence && bill.recurrence !== "none";

      if (isRecurringOriginal) {
        if (recurringIdsPaidThisMonth.has(bill.id)) return;
        if (!billAppearsInMonth(bill, selectedDate)) return;
        result.push(buildVirtualBill(bill, selectedDate));
      } else {
        if (!billAppearsInMonth(bill, selectedDate)) return;
        result.push(bill);
      }
    });

    result.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    return result;
  }, [bills, selectedDate]);

  const stats = useMemo(() => {
    const pending = filteredBills.filter(b => b.status === 'pending');
    const overdue = filteredBills.filter(b => {
      if (b.status === 'paid') return false;
      return new Date(b.due_date) < new Date();
    });
    const totalPending = pending.reduce((sum, b) => sum + b.amount, 0);

    return {
      total: filteredBills.length,
      pending: pending.length,
      overdue: overdue.length,
      totalPending
    };
  }, [filteredBills]);

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
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Contas a Receber</h1>
            <p className="text-slate-600 dark:text-slate-300">Acompanhe seus recebimentos e pendências</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <MonthFilter selectedDate={selectedDate} onChange={setSelectedDate} />
            <Button 
              onClick={() => { setShowForm(true); setEditingBill(null); }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nova Conta
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <CreditCard className="w-8 h-8 text-slate-600 dark:text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total de Contas</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Em Atraso</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-emerald-600" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Valor a Receber</p>
                  <p className="text-2xl font-bold text-emerald-600">R$ {stats.totalPending.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingBill(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBill ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}</DialogTitle>
          </DialogHeader>
          <BillForm
            bill={editingBill ? { ...editingBill, type: 'receivable' } : { type: 'receivable' }}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingBill(null); }}
            billType="receivable"
          />
        </DialogContent>
      </Dialog>

      <BillsList
        bills={filteredBills}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onMarkAsPaid={handleMarkAsPaid}
        type="receivable"
      />
    </div>
  );
}