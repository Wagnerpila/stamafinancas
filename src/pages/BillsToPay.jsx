import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Receipt, Calendar, DollarSign, AlertTriangle } from "lucide-react";
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

  // Contas recorrentes originais ainda pendentes: verifica só o intervalo.
  // Se a própria original já estiver com status "paid" (dado inconsistente, ex: linha
  // antiga marcada como paga antes desta lógica existir), trata como conta avulsa —
  // caso contrário ela "vazaria" como paga em todos os meses futuros para sempre.
  if (bill.recurrence && bill.recurrence !== "none" && bill.status !== "paid") {
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

  // Conta não recorrente (ou recorrente-mas-já-paga-diretamente): aparece só no mês do due_date
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

export default function BillsToPay() {
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
        console.error("Erro ao carregar dados:", error);
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
      const data = await base44.entities.Bill.filter({ type: "payable", created_by: userEmail }, "-due_date");
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
        await base44.entities.Bill.update(editingBill.id, { ...formData, type: "payable" });
      } else {
        await base44.entities.Bill.create({ ...formData, type: "payable" });
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
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];
      const isVirtual = bill._virtual;
      const originalId = bill._originalId || bill.id;
      const originalBill = bills.find(b => b.id === originalId);

      // Usa a categoria da conta diretamente (nome customizado como "Internet")
      // para que apareça corretamente no widget de gastos por categoria
      const srcBill = originalBill || bill;
      const category = srcBill.category || "bills";

      await base44.entities.Transaction.create({
        description: `Pagamento: ${srcBill.title}`,
        amount: srcBill.amount,
        type: "expense",
        category: category,
        date: today,
        notes: `Conta com vencimento em ${bill.due_date}`,
        linked_bill_id: originalId,
      });

      const isRecurring = (originalBill || bill)?.recurrence && (originalBill || bill).recurrence !== "none";

      if (isRecurring) {
        // Conta recorrente: cria cópia paga apenas para o mês específico, NÃO altera a original
        await base44.entities.Bill.create({
          title: (originalBill || bill).title,
          description: (originalBill || bill).description,
          amount: (originalBill || bill).amount,
          type: "payable",
          category: (originalBill || bill).category,
          due_date: bill.due_date,
          status: "paid",
          paid_date: today,
          recurrence: "none",
          notes: (originalBill || bill).notes,
          linked_bill_id: originalId,
        });
        // A bill original permanece intacta para os próximos meses
      } else {
        // Conta normal (não recorrente): marca diretamente como paga
        await base44.entities.Bill.update(originalId, { status: "paid", paid_date: today });
      }

      await loadBills(user.email);
    } catch (error) {
      console.error("Erro ao marcar como paga:", error);
      alert(`Erro ao marcar conta como paga: ${error.message}`);
    }
  };

  // Filtra e expande contas recorrentes para o mês selecionado
  const filteredBills = useMemo(() => {
    const selectedMonthKey = format(startOfMonth(selectedDate), "yyyy-MM");

    // Coleta IDs das contas recorrentes originais que já têm cópia paga neste mês específico
    // A cópia paga tem: status="paid", recurrence="none", linked_bill_id=<id da original>
    // e due_date no mês selecionado
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
      // Contas recorrentes originais: nunca filtradas pelo status "paid" — elas sempre existem
      // mas substituídas pela cópia paga no mês onde foram pagas
      const isRecurringOriginal = bill.recurrence && bill.recurrence !== "none";

      if (isRecurringOriginal) {
        // Se já existe cópia paga para este mês, não exibe a original (a cópia aparece no lugar)
        if (recurringIdsPaidThisMonth.has(bill.id)) return;
        // Verifica se o mês selecionado é >= mês de início da conta
        if (!billAppearsInMonth(bill, selectedDate)) return;
        result.push(buildVirtualBill(bill, selectedDate));
      } else {
        // Conta não recorrente (ou cópia paga gerada): usa lógica normal
        if (!billAppearsInMonth(bill, selectedDate)) return;
        result.push(bill);
      }
    });

    // Ordena por vencimento
    result.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    return result;
  }, [bills, selectedDate]);

  const stats = useMemo(() => {
    const pending = filteredBills.filter(b => b.status === "pending");
    const overdue = filteredBills.filter(
      b => b.status === "overdue" || (b.status === "pending" && new Date(b.due_date) < new Date())
    );
    const totalPending = pending.reduce((sum, b) => sum + b.amount, 0);
    return {
      total: filteredBills.length,
      pending: pending.length,
      overdue: overdue.length,
      totalPending,
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
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Contas a Pagar</h1>
            <p className="text-slate-600 dark:text-slate-300 mt-1">Gerencie suas contas pendentes e vencimentos</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <MonthFilter selectedDate={selectedDate} onChange={setSelectedDate} />
            <Button
              onClick={() => { setShowForm(true); setEditingBill(null); }}
              className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nova Conta
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <Receipt className="w-8 h-8 text-slate-600 dark:text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total de Contas</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Em Atraso</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Valor Pendente</p>
                  <p className="text-2xl font-bold text-red-600">
                    R$ {stats.totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingBill(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBill ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</DialogTitle>
          </DialogHeader>
          <BillForm
            bill={editingBill}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingBill(null); }}
            billType="payable"
          />
        </DialogContent>
      </Dialog>

      <BillsList
        bills={filteredBills}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onMarkAsPaid={handleMarkAsPaid}
        type="payable"
      />
    </div>
  );
}