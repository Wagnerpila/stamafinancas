import React, { useState } from "react";
import { Transaction } from "@/entities/Transaction";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import TransactionForm from "../components/forms/TransactionForm";
import { motion } from "framer-motion";

export default function ManualTransaction() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const initialData = location.state?.transactionData || null;

  const handleSubmit = async (formData) => {
    setIsSubmitting(true);
    try {
      if (initialData?.id) {
        await Transaction.update(initialData.id, formData);
      } else {
        await Transaction.create(formData);
      }
      setSuccess(true);
      setTimeout(() => {
        navigate(createPageUrl("Dashboard"));
      }, 1500);
    } catch (error) {
      console.error("Erro ao salvar transação:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Transação Salva!</h2>
          <p className="text-slate-600">Redirecionando para o dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
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
            onClick={() => navigate(createPageUrl("NewTransactionOptions"))}
            className="hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{initialData ? 'Revisar Transação' : 'Entrada Manual'}</h1>
            <p className="text-slate-600 dark:text-slate-300">{initialData ? 'Confirme os dados extraídos' : 'Adicione uma nova receita ou despesa'}</p>
          </div>
        </div>
      </motion.div>

      <TransactionForm 
        onSubmit={handleSubmit} 
        isSubmitting={isSubmitting} 
        initialData={initialData}
      />
    </div>
  );
}