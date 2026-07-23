import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Lock, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { getAdminContact } from "@/functions/getAdminContact";

export function PlanRestriction({ title, description, onUpgrade }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center min-h-[400px] p-8"
    >
      <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-orange-50 max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900 flex items-center justify-center gap-2">
            <Crown className="w-5 h-5 text-yellow-600" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-slate-600">{description}</p>
          
          <div className="bg-white/50 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 mb-2">Recursos Premium incluem:</h4>
            <ul className="text-sm text-slate-700 space-y-1">
              <li>• Transações ilimitadas</li>
              <li>• Fotografar comprovantes</li>
              <li>• Comando de voz</li>
              <li>• Upload de arquivos</li>
              <li>• Consultoria IA completa</li>
              <li>• Relatórios avançados</li>
            </ul>
          </div>

          <Button 
            onClick={onUpgrade}
            className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Solicitar Upgrade
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function usePlanAccess(user) {
  const isPremium = user?.subscription_plan_name === 'premium';
  
  const hasAccess = {
    photo_capture: isPremium,
    voice_command: isPremium,
    file_upload: isPremium,
    ai_consulting: isPremium,
    advanced_reports: isPremium,
    bills_management: true, // Ambos os planos
    goals_tracking: true,   // Ambos os planos
    unlimited_transactions: isPremium
  };
  
  const transactionLimit = isPremium ? -1 : 10;
  
  return { hasAccess, transactionLimit, isPremium };
}

export async function requestUpgrade(user) {
  try {
    const { data } = await getAdminContact();
    const message = `Olá! Gostaria de solicitar o upgrade para o plano Premium.

*Meus dados:*
Nome: ${user.full_name}
Email: ${user.email}

Por favor, libere minha assinatura Premium. Obrigado!`;
    
    const whatsappUrl = `https://wa.me/${data.phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  } catch (error) {
    console.error('Erro ao obter contato:', error);
  }
}