import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, X } from "lucide-react";

export default function CrediarioForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    store: "",
    description: "",
    total_amount: "",
    installments: "",
    installment_amount: "",
    first_due_date: "",
    notes: "",
  });

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    // Auto-calculate installment_amount when total and installments are filled
    if ((field === "total_amount" || field === "installments") && updated.total_amount && updated.installments) {
      updated.installment_amount = (parseFloat(updated.total_amount) / parseInt(updated.installments)).toFixed(2);
    }
    setFormData(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      total_amount: parseFloat(formData.total_amount),
      installments: parseInt(formData.installments),
      installment_amount: parseFloat(formData.installment_amount),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Nome da Loja</Label>
        <Input
          placeholder="Ex: Casas Bahia, Riachuelo..."
          value={formData.store}
          onChange={(e) => handleChange("store", e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição (Opcional)</Label>
        <Input
          placeholder="Ex: Geladeira, Sofá..."
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor Total (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0,00"
            value={formData.total_amount}
            onChange={(e) => handleChange("total_amount", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Nº de Parcelas</Label>
          <Input
            type="number"
            min="1"
            placeholder="12"
            value={formData.installments}
            onChange={(e) => handleChange("installments", e.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor da Parcela (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="Calculado automaticamente"
            value={formData.installment_amount}
            onChange={(e) => handleChange("installment_amount", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Vencimento da 1ª Parcela</Label>
          <Input
            type="date"
            value={formData.first_due_date}
            onChange={(e) => handleChange("first_due_date", e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Observações (Opcional)</Label>
        <Textarea
          placeholder="Observações adicionais..."
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" /> Cancelar
        </Button>
        <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
          <Save className="w-4 h-4 mr-2" /> Salvar
        </Button>
      </div>
    </form>
  );
}