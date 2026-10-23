import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Keyboard, Camera, Upload, Mic, FileUp, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from '@/api/base44Client';
import { ChevronRight } from "lucide-react";
import { AgentBubble } from "../components/agents/agents";
import { StatusBadge } from "../components/stama/kit";

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
    <div className="px-4 py-5 lg:px-8 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-4">
          <div>
            <p className="text-slate-600 dark:text-slate-300">Escolha como você quer registrar sua movimentação.</p>
          </div>
        </div>
      </motion.div>

      <div className="mb-5">
        <AgentBubble agent="bia">
          o jeito mais rápido é me mandar no WhatsApp — "gastei 62 na farmácia" e pronto. Mas dá pra lançar por aqui também:
        </AgentBubble>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
        {options.map((option) => {
          const isLocked = option.premium && !isPremiumUser();
          return (
            <Link
              key={option.title}
              to={isLocked ? "#" : option.url}
              onClick={(e) => handleOptionClick(option, e)}
              className={`group flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0 dark:border-slate-800 ${isLocked ? "opacity-60" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {isLocked ? <Lock className="h-5 w-5" /> : <option.icon className="h-5 w-5" strokeWidth={1.75} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-display text-[17px] font-semibold text-slate-900 dark:text-white">{option.title}</span>
                  {option.premium && <StatusBadge tone="orange">Premium</StatusBadge>}
                </span>
                <span className="block text-sm text-slate-500">{isLocked ? "Disponível no plano Premium" : option.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}