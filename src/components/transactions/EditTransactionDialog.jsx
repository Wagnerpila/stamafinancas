import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from "lucide-react";
import { Transaction } from "@/entities/Transaction";
import { base44 } from "@/api/base44Client";

export default function EditTransactionDialog({ transaction, open, onClose, onSaved }) {
  const [formData, setFormData] = useState(transaction ? {
    description: transaction.description || "",
    amount: transaction.amount || "",
    type: transaction.type || "expense",
    category: transaction.category || "",
    date: transaction.date ? transaction.date.split("T")[0] : "",
    payment_method: transaction.payment_method || "cash",
    notes: transaction.notes || "",
  } : {});
  const [saving, setSaving] = useState(false);
  const [allCategories, setAllCategories] = useState([]);

  useEffect(() => {
    if (!open) return;
    base44.auth.me().then(u => {
      base44.entities.TransactionCategory.filter({ created_by: u.email }).then(cats => {
        setAllCategories(cats.filter(c => c.active !== false));
      }).catch(() => {});
    }).catch(() => {});
  }, [open]);

  // Reset form when transaction changes
  React.useEffect(() => {
    if (transaction) {
      setFormData({
        description: transaction.description || "",
        amount: transaction.amount || "",
        type: transaction.type || "expense",
        category: transaction.category || "",
        date: transaction.date ? transaction.date.split("T")[0] : "",
        payment_method: transaction.payment_method || "cash",
        notes: transaction.notes || "",
      });
    }
  }, [transaction]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Transaction.update(transaction.id, {
        ...formData,
        amount: Math.abs(parseFloat(formData.amount)),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const currentCategories = allCategories.filter(c => c.type === formData.type);

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v, category: "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-600">
                  {currentCategories.map(c => (
                    <SelectItem key={c.id} value={c.name} className="dark:text-white dark:focus:bg-slate-700">
                      {c.icon ? `${c.icon} ` : ''}{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pagamento</Label>
              <Select value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                  <SelectItem value="food_voucher">Vale Alimentação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações (Opcional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" /> Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
              {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}