import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, X, Check } from "lucide-react";

const COLOR_OPTIONS = [
  { index: 0, label: "Roxo",    bg: "from-purple-700 to-purple-900",   preview: "bg-gradient-to-br from-purple-600 to-purple-900" },
  { index: 1, label: "Azul",    bg: "from-slate-700 to-slate-900",     preview: "bg-gradient-to-br from-slate-600 to-slate-900" },
  { index: 2, label: "Verde",   bg: "from-emerald-700 to-emerald-900", preview: "bg-gradient-to-br from-emerald-600 to-emerald-900" },
  { index: 3, label: "Rosa",    bg: "from-rose-700 to-rose-900",       preview: "bg-gradient-to-br from-rose-600 to-rose-900" },
  { index: 4, label: "Âmbar",   bg: "from-amber-700 to-amber-900",     preview: "bg-gradient-to-br from-amber-600 to-amber-900" },
  { index: 5, label: "Índigo",  bg: "from-indigo-700 to-indigo-900",   preview: "bg-gradient-to-br from-indigo-600 to-indigo-900" },
  { index: 6, label: "Teal",    bg: "from-teal-700 to-teal-900",       preview: "bg-gradient-to-br from-teal-600 to-teal-900" },
  { index: 7, label: "Pink",    bg: "from-pink-700 to-pink-900",       preview: "bg-gradient-to-br from-pink-600 to-pink-900" },
];

export default function CreditCardForm({ card, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(card || {
    name: "",
    last_digits: "",
    limit: "",
    closing_day: "",
    due_day: "",
    active: true,
    color_index: 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      limit: parseFloat(formData.limit),
      closing_day: parseInt(formData.closing_day),
      due_day: parseInt(formData.due_day)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Nome do Cartão</Label>
        <Input
          placeholder="Ex: Nubank, Itaú..."
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Últimos 4 Dígitos (Opcional)</Label>
        <Input
          placeholder="1234"
          maxLength={4}
          value={formData.last_digits}
          onChange={(e) => setFormData({ ...formData, last_digits: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Limite do Cartão (R$)</Label>
        <Input
          type="number"
          placeholder="5000"
          step="0.01"
          value={formData.limit}
          onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Dia do Fechamento</Label>
          <Input
            type="number"
            min="1"
            max="31"
            placeholder="10"
            value={formData.closing_day}
            onChange={(e) => setFormData({ ...formData, closing_day: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Dia do Vencimento</Label>
          <Input
            type="number"
            min="1"
            max="31"
            placeholder="17"
            value={formData.due_day}
            onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Cor do Cartão</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.index}
              type="button"
              title={opt.label}
              onClick={() => setFormData({ ...formData, color_index: opt.index })}
              className={`w-10 h-10 rounded-xl ${opt.preview} flex items-center justify-center transition-all ring-2 ${
                formData.color_index === opt.index ? "ring-white scale-110 shadow-lg" : "ring-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {formData.color_index === opt.index && <Check className="w-4 h-4 text-white" />}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          checked={formData.active}
          onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
        />
        <Label>Cartão Ativo</Label>
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