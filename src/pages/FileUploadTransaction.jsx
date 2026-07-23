import React, { useState, useCallback, useEffect } from 'react';
import { UploadFile, receiptOCR } from "@/api/integrations";
import { User } from "@/entities/User"; // New import
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import { usePlanAccess, PlanRestriction, requestUpgrade } from "../components/common/PlanRestriction"; // New imports

export default function FileUploadTransaction() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [user, setUser] = useState(null); // New state
  const [loading, setLoading] = useState(true); // New state

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
        // If user cannot be loaded, redirect to dashboard or an error page
        navigate(createPageUrl("Dashboard"));
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, [navigate]);

  const { hasAccess } = usePlanAccess(user); // New hook call

  const handleFileChange = (selectedFile) => {
    if (selectedFile && (selectedFile.type.startsWith("image/") || selectedFile.type === "application/pdf")) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError("Por favor, envie um arquivo PDF, PNG ou JPEG.");
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
      const { file_url } = await UploadFile({ file });
      const result = await receiptOCR(file_url);

      if (result.status === "success" && result.output) {
        navigate(createPageUrl("ManualTransaction"), { 
          state: { transactionData: { ...result.output, date: result.output.date || new Date().toISOString().split('T')[0] } } 
        });
      } else {
        throw new Error(result.details || "Não foi possível extrair os dados do arquivo.");
      }
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  // New loading and plan restriction checks
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hasAccess.file_upload) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("NewTransactionOptions"))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Upload de Arquivo</h1>
            <p className="text-slate-600 dark:text-slate-300">Envie um comprovante para extração automática.</p>
          </div>
        </div>
        
        <PlanRestriction
          title="Funcionalidade Premium"
          description="O upload de arquivos para extrair transações está disponível apenas no plano Premium."
          onUpgrade={() => requestUpgrade(user)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("NewTransactionOptions"))}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Upload de Arquivo</h1>
          <p className="text-slate-600 dark:text-slate-300">Envie um comprovante para extração automática.</p>
        </div>
      </motion.div>

      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800 backdrop-blur-sm">
        <CardContent className="p-6">
          {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

          <div
            onDrop={handleDrop}
            onDragOver={handleDrag}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
            }`}
          >
            <input
              type="file"
              id="fileUpload"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => handleFileChange(e.target.files[0])}
            />
            <label htmlFor="fileUpload" className="cursor-pointer">
              <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Arraste e solte ou clique para enviar</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">PDF, PNG ou JPG</p>
            </label>
          </div>

          {file && !isProcessing && (
            <div className="mt-4 p-4 border rounded-lg flex items-center justify-between bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-slate-600" />
                <span className="font-medium">{file.name}</span>
              </div>
              <Button onClick={() => setFile(null)} variant="ghost" size="sm">Remover</Button>
            </div>
          )}

          <Button
            onClick={processFile}
            disabled={!file || isProcessing}
            className="w-full mt-6 h-12 text-lg bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</>
            ) : (
              "Extrair Dados"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}