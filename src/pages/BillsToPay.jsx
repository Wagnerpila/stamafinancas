import React, { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Receipt, Calendar, DollarSign, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import BillForm from "../components/bills/BillForm.jsx";
import BillsList from "../components/bills/BillsList";
import MonthFilter from "../components/common/MonthFilter";
import { getBillsForMonth, getPaidRecurringIdsForMonth, findMatchingTransaction, buildBillEditAction } from "../components/lib/billRecurrence";
import useRefreshOnForeground from "../hooks/useRefreshOnForeground";
import usePurchaseNotes from "../hooks/usePurchaseNotes";

export default function BillsToPay() {
  const [bills, setBills] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [yearMode, setYearMode] = useState(false);
  // IDs de contas com pagamento em andamento — evita que um duplo-toque/duplo-clique (comum no
  // mobile, onde o app não dá feedback imediato de "carregando") dispare handleMarkAsPaid duas
  // vezes antes da primeira chamada terminar e recarregar a lista, duplicando a transação.
  const payingRef = useRef(new Set());
  const purchaseNotes = usePurchaseNotes();

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        await Promise.all([loadBills(currentUser.email), loadTransactions(currentUser.email)]);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Reconsulta ao voltar de outra tela via bfcache/segundo plano (comum no mobile) — senão a
  // lista fica presa em "vencida" mesmo depois de a conta ter sido paga em outra navegação.
  useRefreshOnForeground(() => {
    if (user?.email) {
      loadBills(user.email);
      loadTransactions(user.email);
    }
  });

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

  // Usada só para checar, ao marcar uma conta como paga, se o usuário já não tinha lançado essa
  // despesa manualmente antes (ver handleMarkAsPaid) — evita duplicar o lançamento.
  const loadTransactions = async (userEmail) => {
    if (!userEmail) return;
    try {
      const data = await base44.entities.Transaction.filter({ type: "expense", created_by: userEmail });
      setTransactions(data);
    } catch (error) {
      console.error("Erro ao carregar transações:", error);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingBill) {
        // Uma recorrência é só a relação entre os lançamentos, não um valor compartilhado entre
        // eles: editar uma ocorrência ainda virtual (sem cópia própria neste mês) grava uma
        // cópia vinculada só para esta data, sem tocar no template — os meses futuros continuam
        // com os dados originais da recorrência. Ver buildBillEditAction.
        const action = buildBillEditAction(editingBill, { ...formData, type: "payable" });
        if (action.op === "create") {
          await base44.entities.Bill.create(action.data);
        } else {
          await base44.entities.Bill.update(action.id, action.data);
        }
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
    // Mantém a ocorrência tal como ela aparece na lista (com o vencimento e o valor daquele mês
    // específico) em vez de resolver para o template original — o formulário deve editar a data
    // que o usuário clicou, não a recorrência inteira.
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
    const originalId = bill._originalId || bill.id;

    // Trava contra chamada concorrente da mesma conta (duplo-toque/duplo-clique): a primeira
    // chamada só libera a trava depois que loadBills() recarrega a lista com o novo status.
    if (payingRef.current.has(originalId)) return;
    payingRef.current.add(originalId);

    try {
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];
      const isVirtual = bill._virtual;
      const originalBill = bills.find(b => b.id === originalId);
      const srcBill = originalBill || bill;

      // Proteção contra pagamento duplicado: se a conta (ou, no caso de recorrente,
      // a cópia paga deste mês) já estiver paga, não lança de novo. Isso evita a
      // duplicação que ocorre quando uma notificação desatualizada leva o usuário a
      // marcar como paga uma conta que já foi quitada.
      // (recurrence pode vir "none" em vez de vazio/undefined — !srcBill.recurrence sozinho não
      // cobre esse caso e deixava uma conta avulsa já paga passar direto pelas duas proteções)
      const hasRecurrence = srcBill.recurrence && srcBill.recurrence !== "none";
      if (srcBill.status === "paid" && !hasRecurrence) {
        alert(`A conta "${srcBill.title}" já está marcada como paga.`);
        await loadBills(user.email);
        return;
      }
      if (hasRecurrence) {
        const referenceDate = new Date((bill.due_date || srcBill.due_date).slice(0, 10) + "T00:00:00");
        const alreadyPaidIds = getPaidRecurringIdsForMonth(bills, referenceDate);
        if (alreadyPaidIds.has(originalId)) {
          alert(`A conta "${srcBill.title}" já foi paga neste mês.`);
          await loadBills(user.email);
          return;
        }
      }

      // Usa a categoria da conta diretamente (nome customizado como "Internet")
      // para que apareça corretamente no widget de gastos por categoria
      const category = srcBill.category || "bills";

      // Se o usuário já tinha lançado essa despesa manualmente (mesmo título e valor, perto do
      // vencimento) antes de vir marcar a conta como paga, criar uma transação nova duplicaria
      // o gasto — o dinheiro já foi registrado, só a conta é que não sabia disso. Oferece
      // vincular à transação existente em vez de lançar de novo.
      const existingTx = findMatchingTransaction(transactions, {
        title: srcBill.title,
        amount: srcBill.amount,
        type: "expense",
        referenceDate: bill.due_date || srcBill.due_date,
      });

      if (existingTx) {
        const existingDate = existingTx.date ? existingTx.date.slice(0, 10).split("-").reverse().join("/") : "";
        const useExisting = window.confirm(
          `Já existe um lançamento parecido: "${existingTx.description}" de R$ ${existingTx.amount.toFixed(2)} em ${existingDate}.\n\n` +
          `Vincular esse lançamento à conta em vez de criar um novo (evita duplicar a despesa)?`
        );
        if (useExisting) {
          await base44.entities.Transaction.update(existingTx.id, { linked_bill_id: originalId });
        } else {
          await base44.entities.Transaction.create({
            description: `Pagamento: ${srcBill.title}`,
            amount: srcBill.amount,
            type: "expense",
            category: category,
            date: today,
            notes: `Conta com vencimento em ${bill.due_date}`,
            linked_bill_id: originalId,
          });
        }
      } else {
        await base44.entities.Transaction.create({
          description: `Pagamento: ${srcBill.title}`,
          amount: srcBill.amount,
          type: "expense",
          category: category,
          date: today,
          notes: `Conta com vencimento em ${bill.due_date}`,
          linked_bill_id: originalId,
        });
      }

      if (hasRecurrence) {
        // Conta recorrente: cria cópia paga apenas para o mês específico, NÃO altera a original
        await base44.entities.Bill.create({
          title: srcBill.title,
          description: srcBill.description,
          amount: srcBill.amount,
          type: "payable",
          category: srcBill.category,
          due_date: bill.due_date,
          status: "paid",
          paid_date: today,
          recurrence: "none",
          notes: srcBill.notes,
          linked_bill_id: originalId,
        });
        // A bill original permanece intacta para os próximos meses
      } else {
        // Conta normal (não recorrente): marca diretamente como paga
        await base44.entities.Bill.update(originalId, { status: "paid", paid_date: today });
      }

      await Promise.all([loadBills(user.email), loadTransactions(user.email)]);
    } catch (error) {
      console.error("Erro ao marcar como paga:", error);
      alert(`Erro ao marcar conta como paga: ${error.message}`);
    } finally {
      payingRef.current.delete(originalId);
    }
  };

  // Filtra e expande contas recorrentes para o mês selecionado (ou para os 12 meses do ano, se
  // yearMode) — cada mês roda getBillsForMonth() independente pra reaproveitar toda a lógica de
  // recorrência/parcela já existente, sem duplicar contas já pagas nesse mês específico.
  const filteredBills = useMemo(() => {
    let result;
    if (yearMode) {
      const year = selectedDate.getFullYear();
      result = [];
      for (let m = 0; m < 12; m++) {
        result.push(...getBillsForMonth(bills, new Date(year, m, 1)));
      }
    } else {
      result = getBillsForMonth(bills, selectedDate);
    }
    result.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    return result;
  }, [bills, selectedDate, yearMode]);

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
            <MonthFilter
              selectedDate={selectedDate}
              onChange={setSelectedDate}
              yearMode={yearMode}
              onToggleYearMode={() => setYearMode(v => !v)}
            />
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
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
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
        getPurchaseNote={purchaseNotes.getNote}
      />
    </div>
  );
}