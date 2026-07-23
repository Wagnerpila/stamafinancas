import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Keyboard, Camera, Upload, Mic, ArrowLeft, FileUp, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';

const options = [
  {
    title: "Entrada Manual",
    description: "Digite os dados da transação manualmente",
    icon: Keyboard,
    url: createPageUrl("ManualTransaction"),
    color: "text-blue-600",
    bg: "bg-blue-50",
    premium: false
  },
  {
    title: "Fotografar Comprovante",
    description: "Tire uma foto para extrair dados automaticamente",
    icon: Camera,
    url: createPageUrl("PhotoTransaction"),
    color: "text-purple-600",
    bg: "bg-purple-50",
    premium: true
  },
  {
    title: "Upload de Arquivo",
    description: "Envie PDF ou imagem para processamento",
    icon: Upload,
    url: createPageUrl("FileUploadTransaction"),
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    premium: true
  },
  {
    title: "Comando de Voz",
    description: "Fale naturalmente e deixe a IA processar",
    icon: Mic,
    url: createPageUrl("VoiceTransaction"),
    color: "text-orange-600",
    bg: "bg-orange-50",
    premium: true
  },
  {
    title: "Importar Extrato Bancário",
    description: "Envie um arquivo (PDF, CSV) para importação em massa",
    icon: FileUp,
    url: createPageUrl("ImportStatement"),
    color: "text-teal-600",
    bg: "bg-teal-50",
    premium: true
  }
];

export default function NewTransactionOptions() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userPlan, setUserPlan] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const isPremiumUser = () => {
    if (!user) return false;
    return user.subscription_plan_name === 'premium';
  };

  const handleOptionClick = (option, e) => {
    if (option.premium && !isPremiumUser()) {
      e.preventDefault();
      alert('Esta funcionalidade está disponível apenas para usuários premium. Entre em contato com o administrador para fazer upgrade.');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
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
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Adicionar Nova Transação</h1>
            <p className="text-slate-600 dark:text-slate-300">Escolha como você quer registrar sua movimentação.</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {options.map((option, index) => {
          const isLocked = option.premium && !isPremiumUser();
          
          return (
            <motion.div
              key={option.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link 
                to={isLocked ? "#" : option.url}
                onClick={(e) => handleOptionClick(option, e)}
              >
                <Card className={`h-full border-0 shadow-lg bg-white/80 backdrop-blur-sm transition-all duration-300 ${
                  isLocked 
                    ? 'opacity-60 cursor-not-allowed' 
                    : 'hover:shadow-xl hover:-translate-y-1'
                }`}>
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className={`p-4 rounded-xl ${option.bg} relative`}>
                      <option.icon className={`w-6 h-6 ${option.color}`} />
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                          <Lock className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className={`text-lg font-bold ${option.color}`}>
                          {option.title}
                        </CardTitle>
                        {option.premium && (
                          <Badge variant="secondary" className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs">
                            Premium
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600">{option.description}</p>
                    {isLocked && (
                      <p className="text-sm text-orange-600 mt-2 font-medium">
                        🔒 Contate o administrador para upgrade
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}