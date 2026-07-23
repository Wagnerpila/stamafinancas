import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { ShoppingCart, Save } from "lucide-react";
import { motion } from "framer-motion";

export default function FoodVoucherConfig({ user, onUpdate }) {
  const [balance, setBalance] = useState(user?.food_voucher_balance || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!balance || balance < 0) return;
    
    setIsSaving(true);
    try {
      await base44.auth.updateMe({ food_voucher_balance: parseFloat(balance) });
      if (onUpdate) onUpdate();
      alert('Saldo do vale alimentação salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar saldo:', error);
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
      <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-amber-50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <ShoppingCart className="w-5 h-5" />
            Saldo Vale Alimentação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            Informe o saldo atual do seu cartão de vale alimentação para acompanhamento.
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Ex: 800"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleSave} 
              disabled={isSaving || balance === ''}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSaving ? 'Salvando...' : <><Save className="w-4 h-4 mr-2" /> Salvar</>}
            </Button>
          </div>
          {user?.food_voucher_balance > 0 && (
            <p className="text-sm text-orange-700 mt-2">
              Saldo atual: <strong>R$ {user.food_voucher_balance.toFixed(2)}</strong>
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}