import React, { useState, useCallback } from 'react';
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
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em leitura de extratos bancários brasileiros.
Analise este extrato bancário e extraia TODAS as transações encontradas.

REGRAS CRÍTICAS para determinar se é RECEITA (income) ou DESPESA (expense):

1. VALORES NEGATIVOS (com sinal "-" ou entre parênteses) = SEMPRE "expense"
2. VALORES POSITIVOS (sem sinal ou com "+") = "income" se for salário/transferência recebida/PIX recebido, senão avalie o contexto
3. COLUNA "DÉBITO" ou texto "DÉB", "D" ao lado = SEMPRE "expense"
4. COLUNA "CRÉDITO" ou texto "CRÉ", "C" ao lado = SEMPRE "income"
5. PALAVRAS que indicam DESPESA: pagamento, compra, saque, débito, tarifa, taxa, ted enviado, pix enviado, transferência enviada, fatura, boleto, doc enviado
6. PALAVRAS que indicam RECEITA: salário, depósito, crédito, pix recebido, ted recebido, transferência recebida, rendimento, estorno, reembolso, doc recebido
7. Se o valor aparecer em VERMELHO ou formatação de débito = "expense"
8. Em extratos de CARTÃO DE CRÉDITO: todas as compras são "expense", pagamentos da fatura são "income"
9. Em caso de dúvida genuína, use "expense"

Para cada transação extraia:
- description: descrição completa (sem símbolos de valor)
- amount: valor SEMPRE positivo (número sem sinal, sem R$, use ponto como decimal)
- type: "income" ou "expense" conforme as regras acima
- date: data no formato YYYY-MM-DD
- category: categoria sugerida. Para expense: food, transport, health, education, entertainment, shopping, bills, other_expense. Para income: salary, freelance, investment, other_income

Ignore linhas de saldo, totais, cabeçalhos e rodapés.
Retorne JSON válido com todas as transações encontradas.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            transactions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  amount: { type: "number" },
                  type: { type: "string" },
                  date: { type: "string" },
                  category: { type: "string" }
                }
              }
            }
          }
        }
      });

      const transactions = result?.transactions;
      if (transactions?.length > 0) {
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