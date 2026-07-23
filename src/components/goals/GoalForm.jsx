import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from "lucide-react";

const categories = [
  { value: "emergency_fund", label: "Fundo de Emergência" },
  { value: "vacation", label: "Férias" },
  { value: "house", label: "Casa" },
  { value: "car", label: "Carro" },
  { value: "education", label: "Educação" },
  { value: "retirement", label: "Aposentadoria" },
  { value: "investment", label: "Investimento" },
  { value: "health", label: "Saúde" },
  { value: "entertainment", label: "Entretenimento" },
  { value: "other", label: "Outro" },
];

const priorities = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

export default function GoalForm({ goal, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(goal || {
    title: "",
    description: "",
    target_amount: "",
    current_amount: 0,
    target_date: "",
    category: "other",
    priority: "medium",
    monthly_contribution: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      target_amount: parseFloat(formData.target_amount),
      current_amount: parseFloat(formData.current_amount) || 0,
      monthly_contribution: formData.monthly_contribution ? parseFloat(formData.monthly_contribution) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Título da Meta</Label>
        <Input
          placeholder="Ex: Viagem para Europa, Fundo de emergência..."
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição (Opcional)</Label>
        <Textarea
          placeholder="Descreva sua meta..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor Objetivo (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="10000"
            value={formData.target_amount}
            onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Valor Atual (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0"
            value={formData.current_amount}
            onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Prioridade</Label>
          <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data Limite</Label>
          <Input
            type="date"
            value={formData.target_date}
            onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Contribuição Mensal (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="Opcional"
            value={formData.monthly_contribution}
            onChange={(e) => setFormData({ ...formData, monthly_contribution: e.target.value })}
          />
        </div>
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