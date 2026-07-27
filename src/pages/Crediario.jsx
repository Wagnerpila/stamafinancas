import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { Plus, Store, Trash2, CheckCircle, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import CrediarioForm from "../components/crediario/CrediarioForm.jsx";

export default function Crediario() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        const data = await base44.entities.Crediario.filter({ created_by: u.email }, "-created_date");
        setItems(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const reload = async () => {
    const data = await base44.entities.Crediario.filter({ created_by: user.email }, "-created_date");
    setItems(data);
  };

  const handleSubmit = async (formData) => {
    await base44.entities.Crediario.create(formData);
    // Auto-generate bills for all installments
    const billsToCreate = [];
    for (let i = 0; i < formData.installments; i++) {
      const dueDate = new Date(formData.first_due_date);
      dueDate.setMonth(dueDate.getMonth() + i);
      billsToCreate.push({
        title: `${formData.store} - Parcela ${i + 1}/${formData.installments}`,
        description: formData.description || '',
        amount: formData.installment_amount,
        type: "payable",
        category: "other",
        due_date: dueDate.toISOString().split('T')[0],
        recurrence: "none"
      });
    }
    if (billsToCreate.length > 0) {
      await base44.entities.Bill.bulkCreate(billsToCreate);
    }
    setShowForm(false);
    await reload();
  };

  const handleDelete = async (id) => {
    if (confirm("Excluir crediário?")) {
      await base44.entities.Crediario.delete(id);
      await reload();
    }
  };

  const handlePayInstallment = async (item) => {
    const newPaid = (item.paid_installments || 0) + 1;
    const newStatus = newPaid >= item.installments ? "paid" : "active";
    await base44.entities.Crediario.update(item.id, {
      paid_installments: newPaid,
      status: newStatus
    });
    await base44.entities.Transaction.create({
      description: `${item.store} - Parcela ${newPaid}/${item.installments}`,
      amount: item.installment_amount,
      type: "expense",
      category: "shopping",
      date: new Date().toISOString().split('T')[0]
    });
    await reload();
  };

  const stats = useMemo(() => {
    const active = items.filter(i => i.status === "active");
    const totalDebt = active.reduce((s, i) => s + (i.installments - (i.paid_installments || 0)) * i.installment_amount, 0);
    const monthlyCommitment = active.reduce((s, i) => s + i.installment_amount, 0);
    return { active: active.length, totalDebt, monthlyCommitment };
  }, [items]);

  const statusBadge = (status) => {
    const map = { active: ["bg-blue-100 text-blue-700", "Ativo"], paid: ["bg-green-100 text-green-700", "Quitado"], overdue: ["bg-red-100 text-red-700", "Atrasado"] };
    return map[status] || map.active;
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Crediário</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">Compras parceladas em loja</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-5 h-5 mr-2" /> Novo Crediário
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
          <CardContent className="p-5 flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Crediários Ativos</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
          <CardContent className="p-5 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Dívida Total Restante</p>
              <p className="text-2xl font-bold text-red-600">{`R$ ${stats.totalDebt.toFixed(2)}`}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
          <CardContent className="p-5 flex items-center gap-3">
            <Store className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Comprometimento Mensal</p>
              <p className="text-2xl font-bold text-orange-600">{`R$ ${stats.monthlyCommitment.toFixed(2)}`}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) setShowForm(false); }}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Crediário</DialogTitle>
          </DialogHeader>
          <CrediarioForm
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {items.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-16 text-center">
            <Store className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Nenhum crediário cadastrado</h3>
            <p className="text-slate-500">Registre compras parceladas em lojas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const remaining = item.installments - (item.paid_installments || 0);
            const remainingAmount = remaining * item.installment_amount;
            const progress = ((item.paid_installments || 0) / item.installments) * 100;
            const [badgeClass, badgeLabel] = statusBadge(item.status);
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-900 dark:text-white">{item.store}</h3>
                          <Badge className={badgeClass}>{badgeLabel}</Badge>
                        </div>
                        {item.description && <p className="text-sm text-slate-500 mb-2">{item.description}</p>}
                        <div className="flex flex-wrap gap-4 text-sm mb-3">
                          <span className="text-slate-600 dark:text-slate-400">Total: <strong>R$ {item.total_amount.toFixed(2)}</strong></span>
                          <span className="text-slate-600 dark:text-slate-400">Parcela: <strong>R$ {item.installment_amount.toFixed(2)}</strong></span>
                          <span className="text-slate-600 dark:text-slate-400">Restante: <strong className="text-red-600">R$ {remainingAmount.toFixed(2)}</strong></span>
                          <span className="text-slate-600 dark:text-slate-400">{item.paid_installments || 0}/{item.installments} parcelas</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {item.status === "active" && (
                          <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50" onClick={() => handlePayInstallment(item)}>
                            <CheckCircle className="w-4 h-4 mr-1" /> Pagar Parcela
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}