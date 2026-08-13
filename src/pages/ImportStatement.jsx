import React, { useState, useCallback } from 'react';
import { UploadFile, statementImport } from "@/api/integrations";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Upload, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";

export default function ImportStatement() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (selectedFile) => {
    if (selectedFile && (selectedFile.type.startsWith("image/") || selectedFile.type === "application/pdf" || selectedFile.type === "text/csv")) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError("Por favor, envie um arquivo PDF, PNG, JPEG ou CSV.");
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }, []);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const processFile = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const [{ file_url }, dbCategories] = await Promise.all([
        UploadFile({ file }),
        base44.entities.TransactionCategory.list().catch(() => []),
      ]);
      const active = (dbCategories || []).filter((c) => c.active !== false);
      const categories = {
        income: active.filter((c) => c.type === "income").map((c) => c.name),
        expense: active.filter((c) => c.type === "expense").map((c) => c.name),
      };

      // Prompt/schema vivem no backend (server/src/services/ai/prompts.js) — aqui só chama o
      // endpoint /api/ai/statement-import, que usa o provedor de IA configurado no servidor.
      // Envia as categorias cadastradas pelo usuário para a IA sugerir a categoria de cada
      // lançamento pela descrição, igual já é feito na importação de fatura de cartão.
      const result = await statementImport(file_url, categories);

      const rawTransactions = result?.status === "success" ? result.output?.transactions : null;
      if (rawTransactions?.length > 0) {
        // A IA foi instruída a usar o nome exato de uma categoria do usuário, mas casa aqui de
        // forma case-insensitive por segurança. Lançamentos que a IA não conseguiu categorizar
        // (comum em PIX sem descrição clara) caem na categoria "outras despesas/receitas" do
        // usuário em vez de ficarem em branco — evita ter que categorizar cada um na revisão.
        const transactions = rawTransactions.map((t) => {
          const type = t.type === "income" ? "income" : "expense";
          const list = type === "income" ? categories.income : categories.expense;
          const matched = list.find((name) => name.toLowerCase() === String(t.category || "").toLowerCase());
          const fallback = list.find((name) => name.toLowerCase().includes("outr"))
            || (type === "income" ? "Outras Receitas" : "Outras despesas");
          return { ...t, category: matched || fallback };
        });
        navigate(createPageUrl("ReviewImportedTransactions"), { state: { transactions } });
      } else {
        throw new Error("Não foi possível extrair nenhuma transação do arquivo. Verifique o formato ou tente outro arquivo.");
      }
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("NewTransactionOptions"))}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Importar Extrato Bancário</h1>
          <p className="text-slate-600 dark:text-slate-300">Envie um arquivo PDF ou CSV para extração em massa.</p>
        </div>
      </motion.div>

      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="dark:text-white">Faça o Upload do Arquivo</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

          <div
            onDrop={handleDrop}
            onDragOver={handleDrag}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive ? 'border-teal-400 bg-teal-50' : 'border-slate-200'
            }`}
          >
            <input
              type="file"
              id="fileUpload"
              className="hidden"
              accept=".pdf,.csv,.png,.jpg,.jpeg"
              onChange={(e) => handleFileChange(e.target.files[0])}
            />
            <label htmlFor="fileUpload" className="cursor-pointer">
              <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Arraste e solte ou clique para enviar</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">PDF, CSV, PNG ou JPG</p>
            </label>
          </div>

          {file && (
            <div className="mt-4 p-4 border rounded-lg flex items-center justify-between bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
              <span className="font-medium dark:text-slate-200">{file.name}</span>
              <Button onClick={() => setFile(null)} variant="ghost" size="sm">Remover</Button>
            </div>
          )}

          <Button
            onClick={processFile}
            disabled={!file || isProcessing}
            className="w-full mt-6 h-12 text-lg bg-teal-600 hover:bg-teal-700"
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando Extrato...</>
            ) : (
              "Extrair Transações"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}