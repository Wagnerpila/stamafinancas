import React, { useState, useEffect } from 'react';
import NotificationManager from "../components/notifications/NotificationManager";
import { motion } from "framer-motion";
import { User } from "@/entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

function WhatsAppSettings() {
  const [user, setUser] = useState(null);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        setWhatsappNumber(currentUser.whatsapp_number || '');
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
      }
    };
    loadUser();
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await User.updateMyUserData({ whatsapp_number: whatsappNumber });
      alert("Número do WhatsApp salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar número:", error);
      alert("Não foi possível salvar o número.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800 backdrop-blur-sm mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-green-600" />
          Alertas por WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Insira seu número de WhatsApp com código do país (ex: 5511999998888) para receber alertas. 
          <span className="font-bold">A funcionalidade de envio automático requer configuração adicional pelo administrador do sistema.</span>
        </p>
        <div className="space-y-2">
          <Label htmlFor="whatsapp">Seu número de WhatsApp</Label>
          <Input
            id="whatsapp"
            type="tel"
            placeholder="5511999998888"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
          />
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar Número'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function NotificationSettings() {
  const navigate = useNavigate();
  
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Configurações de Alertas</h1>
            <p className="text-slate-600 dark:text-slate-300">Configure quando e como receber notificações sobre suas finanças</p>
          </div>
        </div>
      </motion.div>

      <NotificationManager />
      <WhatsAppSettings />
    </div>
  );
}