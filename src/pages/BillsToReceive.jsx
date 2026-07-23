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
    setEditingBill(bill);
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

      console.log("Marcando conta como recebida:", bill.title);

      // Se for vale alimentação, atualizar o saldo
      if (bill.is_food_voucher) {
        const currentBalance = user.food_voucher_balance || 0;
        const newBalance = currentBalance + bill.amount;
        
        await base44.auth.updateMe({ food_voucher_balance: newBalance });
        console.log(`Saldo do vale atualizado: R$ ${currentBalance.toFixed(2)} → R$ ${newBalance.toFixed(2)}`);
      } else {
        // Se não for vale, criar transação normal
        // Usa a categoria da conta diretamente (nome customizado)
        const category = bill.category || 'other_income';

        const transactionData = {
          description: `Recebimento da conta: ${bill.title}`,
          amount: bill.amount,
          type: 'income',
          category: category,
          date: new Date().toISOString().split('T')[0],
          notes: `Referente a uma conta a receber com vencimento em ${new Date(bill.due_date).toLocaleDateString()}`,
          created_by: user.email
        };

        console.log("Criando transação:", transactionData);
        await base44.entities.Transaction.create(transactionData);
        console.log("Transação criada com sucesso");
      }

      // Atualizar o status da conta
      await base44.entities.Bill.update(bill.id, {
        status: "paid",
        paid_date: new Date().toISOString().split('T')[0]
      });

      console.log("Conta atualizada com sucesso");

      // Recarregar a lista de contas
      await loadBills(user.email);
      
      // Mostrar confirmação ao usuário
      const message = bill.is_food_voucher 
        ? `Vale alimentação de R$ ${bill.amount.toFixed(2)} adicionado ao seu saldo!`
        : `Conta "${bill.title}" marcada como recebida e registrada nas receitas!`;
      alert(message);

    } catch (error) {
      console.error("Erro detalhado ao marcar como recebida:", error);
      alert(`Erro ao marcar conta como recebida: ${error.message}`);
    }
  };

  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const d = new Date(b.due_date);
      return d.getMonth() === selectedDate.getMonth() &&
             d.getFullYear() === selectedDate.getFullYear();
    });
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