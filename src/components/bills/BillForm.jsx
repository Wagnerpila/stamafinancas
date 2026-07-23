import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save, X } from "lucide-react";

// Categorias padrão de fallback (caso não haja customizadas)
const DEFAULT_CATEGORIES = [
  { value: "rent", label: "Aluguel" },
  { value: "utilities", label: "Utilidades" },
  { value: "insurance", label: "Seguro" },
  { value: "loan", label: "Empréstimo" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "services", label: "Serviços" },
  { value: "supplies", label: "Suprimentos" },
  { value: "subscription", label: "Assinatura" },
  { value: "tax", label: "Impostos" },
  { value: "investment", label: "Investimento" },
  { value: "salary", label: "Salário" },
  { value: "freelance", label: "Freelance" },
  { value: "other", label: "Outros" },
];

const recurrenceOptions = [
  { value: "none", label: "Sem recorrência" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
];

export default function BillForm({ bill, onSubmit, onCancel, billType = "payable" }) {
  const [formData, setFormData] = useState(bill || {
    title: "",
    description: "",
    amount: "",
    category: "other",
    due_date: "",
    recurrence: "none",
    notes: "",
  });
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const type = billType === "receivable" ? "income" : "expense";
        const all = await base44.entities.TransactionCategory.list();
        const filtered = all.filter(c => c.active !== false && c.type === type);
        if (filtered.length > 0) {
          setCategories(filtered.map(c => ({ value: c.name, label: `${c.icon || ""} ${c.name}`.trim() })));
        }
      } catch (e) {
        // Mantém padrão em caso de erro
      }
    };
    loadCategories();
  }, [billType]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, amount: parseFloat(formData.amount) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Título</Label>
        <Input
          placeholder="Ex: Conta de luz, Aluguel..."
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição (Opcional)</Label>
        <Input
          placeholder="Descrição detalhada"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0,00"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Vencimento</Label>
          <Input
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Recorrência</Label>
          <Select value={formData.recurrence} onValueChange={(v) => setFormData({ ...formData, recurrence: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {recurrenceOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Observações (Opcional)</Label>
        <Textarea
          placeholder="Observações adicionais..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" /> Cancelar
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" /> Salvar
        </Button>
      </div>
    </form>
  );
}