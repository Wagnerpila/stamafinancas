import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { parseTransactionText } from "@/api/integrations";
import { usePlanAccess, PlanRestriction, requestUpgrade } from "../components/common/PlanRestriction";

import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Mic, MicOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
  recognition.continuous = false;
  recognition.lang = 'pt-BR';
  recognition.interimResults = true;
}

export default function VoiceTransaction() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
        navigate(createPageUrl("Dashboard")); // Redirect if user cannot be loaded
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, [navigate]);

  const { hasAccess } = usePlanAccess(user);

  useEffect(() => {
    if (!recognition) {
      setError("Reconhecimento de voz não é suportado neste navegador.");
      return;
    }

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimTranscript(interim);
      if (final) {
        setTranscript(prev => prev + ' ' + final);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      setError(`Erro no reconhecimento de voz: ${event.error}`);
      setIsListening(false);
    };

    return () => {
      recognition.stop();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognition.stop();
    } else {
      setTranscript('');
      setInterimTranscript('');
      recognition.start();
    }
    setIsListening(!isListening);
  };
  
  const processVoiceCommand = async () => {
    if (!transcript) return;
    setIsProcessing(true);
    setError(null);
    try {
      const { output: result } = await parseTransactionText(transcript);

      if (result) {
        // Check if transcript mentions food voucher
        const isFoodVoucher = /vale\s*(alimenta[cç][aã]o|refei[cç][aã]o)|va|vr/i.test(transcript);

        // Amount might be positive from LLM, but should be stored as positive for expense type
        const processedResult = {
          ...result,
          amount: Math.abs(result.amount || 0),
          type: result.amount < 0 ? 'expense' : 'income',
          date: result.date || new Date().toISOString().split('T')[0],
          is_food_voucher: result.is_food_voucher || isFoodVoucher,
          category: (result.is_food_voucher || isFoodVoucher) ? 'food' : result.category
        };

        navigate(createPageUrl("ManualTransaction"), { 
          state: { transactionData: processedResult } 
        });
      } else {
        throw new Error("Não consegui entender os detalhes da transação. Tente ser mais específico.");
      }
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!hasAccess.voice_command) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("NewTransactionOptions"))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Comando de Voz</h1>
            <p className="text-slate-600 dark:text-slate-300">Diga sua transação. Ex: "gastei 50 reais no supermercado hoje"</p>
          </div>
        </div>
        
        <PlanRestriction
          title="Funcionalidade Premium"
          description="O comando de voz para transações está disponível apenas no plano Premium."
          onUpgrade={() => requestUpgrade(user)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("NewTransactionOptions"))}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Comando de Voz</h1>
          <p className="text-slate-600 dark:text-slate-300">Diga sua transação. Ex: "gastei 50 reais no supermercado hoje"</p>
        </div>
      </motion.div>

      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800 backdrop-blur-sm">
        <CardContent className="p-6 text-center">
          {error && <Alert variant="destructive" className="mb-4 text-left"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

          <Button
            onClick={toggleListening}
            size="lg"
            className={`w-24 h-24 rounded-full transition-all duration-300 ${
              isListening ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isListening ? <MicOff className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
          </Button>
          <p className="mt-4 text-lg font-medium text-slate-700 dark:text-slate-200">{isListening ? 'Ouvindo...' : 'Toque para falar'}</p>

          <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-700 rounded-lg min-h-[80px] text-left">
            <p className="text-slate-800 dark:text-slate-200">{transcript} <span className="text-slate-500 dark:text-slate-400">{interimTranscript}</span></p>
            {!transcript && !interimTranscript && <p className="text-slate-400 dark:text-slate-500">Sua transcrição aparecerá aqui...</p>}
          </div>

          <Button
            onClick={processVoiceCommand}
            disabled={!transcript || isProcessing}
            className="w-full mt-6 h-12 text-lg bg-emerald-600 hover:bg-emerald-700"
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analisando...</>
            ) : (
              "Processar Comando"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}