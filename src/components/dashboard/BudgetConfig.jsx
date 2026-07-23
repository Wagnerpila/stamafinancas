import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { DollarSign, Save } from "lucide-react";
import { motion } from "framer-motion";

export default function BudgetConfig({ user, onUpdate }) {
  const [budget, setBudget] = useState(user?.monthly_budget || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!budget || budget <= 0) return;
    
    setIsSaving(true);
    try {
      await base44.auth.updateMe({ monthly_budget: parseFloat(budget) });
      if (onUpdate) onUpdate();
      alert('Valor disponível salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-blue-50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <DollarSign className="w-5 h-5" />
            Valor Disponível para Gastar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            Defina quanto você tem disponível para gastar do seu saldo total. Este valor será exibido no card "Disponível".
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Ex: 5000"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !budget}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSaving ? 'Salvando...' : <><Save className="w-4 h-4 mr-2" /> Salvar</>}
            </Button>
          </div>
          {user?.monthly_budget > 0 && (
            <p className="text-sm text-purple-700 mt-2">
              Valor disponível atual: <strong>R$ {user.monthly_budget.toFixed(2)}</strong>
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}