import React, { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { UploadFile, receiptOCR } from "@/api/integrations";
import { usePlanAccess, PlanRestriction, requestUpgrade } from "@/components/common/PlanRestriction";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Camera, Loader2, AlertCircle, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";

export default function PhotoTransaction() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);

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

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      // Verificar se o dispositivo suporta câmera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Câmera não é suportada neste dispositivo ou navegador.");
      }

      const constraints = {
        video: { 
          facingMode: "environment", // Câmera traseira no mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setCameraStarted(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      
      // Tentar fallback para câmera frontal
      if (err.name === "OverconstrainedError" || (err.message && err.message.includes("environment"))) {
        try {
          const fallbackConstraints = {
            video: { 
              facingMode: "user", // Câmera frontal
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false,
          };
          
          const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          setStream(fallbackStream);
          setCameraStarted(true);
          
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.play();
          }
        } catch (fallbackErr) {
          setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
        }
      } else {
        setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraStarted(false);
    }
  }, [stream]);

  React.useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const takePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPhoto(photoDataUrl);
    stopCamera();
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  const processPhoto = async () => {
    if (!photo) return;
    setIsProcessing(true);
    setError(null);
    
    try {
      // Converter dataURL para blob
      const response = await fetch(photo);
      const blob = await response.blob();
      const file = new File([blob], `comprovante-${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      const { file_url } = await UploadFile({ file });

      // Envia as categorias cadastradas pelo usuário pra IA sugerir uma categoria que realmente
      // existe (sem isso ela inventava valores em inglês tipo "food", que não batem com nenhuma
      // categoria real e aparecem como "(categoria removida)" na revisão).
      const cats = await base44.entities.TransactionCategory.list().catch(() => []);
      const active = (cats || []).filter(c => c.active !== false);
      const categories = {
        income: active.filter(c => c.type === 'income').map(c => c.name),
        expense: active.filter(c => c.type === 'expense').map(c => c.name),
      };

      const result = await receiptOCR(file_url, categories);

      if (result.status === "success" && result.output) {
        const list = result.output.type === 'income' ? categories.income : categories.expense;
        const matched = list.find(name => name.toLowerCase() === String(result.output.category || '').toLowerCase());
        navigate(createPageUrl("ManualTransaction"), {
          state: {
            transactionData: {
              ...result.output,
              category: matched || '',
              date: result.output.date || new Date().toISOString().split('T')[0]
            }
          }
        });
      } else {
        throw new Error(result.details || "Não foi possível extrair os dados da foto.");
      }
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hasAccess.photo_capture) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("NewTransactionOptions"))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Fotografar Comprovante</h1>
            <p className="text-slate-600 dark:text-slate-300">Aponte a câmera para o documento.</p>
          </div>
        </div>
        
        <PlanRestriction
          title="Funcionalidade Premium"
          description="A captura de fotos de comprovantes está disponível apenas no plano Premium."
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
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(createPageUrl("NewTransactionOptions"))}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Fotografar Comprovante</h1>
          <p className="text-slate-600 dark:text-slate-300">Aponte a câmera para o documento.</p>
        </div>
      </motion.div>
      
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800 backdrop-blur-sm">
        <CardContent className="p-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden relative mb-6">
            {photo ? (
              <img src={photo} alt="Comprovante" className="w-full h-full object-contain" />
            ) : (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                  style={{ display: cameraStarted ? 'block' : 'none' }}
                />
                {!cameraStarted && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm opacity-75">Clique para iniciar a câmera</p>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {!stream && !photo && cameraStarted && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
          </div>

          <div className="flex gap-4">
            {photo ? (
              <>
                <Button 
                  onClick={retakePhoto} 
                  variant="outline" 
                  className="flex-1 h-12 text-lg" 
                  disabled={isProcessing}
                >
                  <RefreshCw className="mr-2 h-5 w-5" /> 
                  Tentar Novamente
                </Button>
                <Button 
                  onClick={processPhoto} 
                  className="flex-1 h-12 text-lg bg-emerald-600 hover:bg-emerald-700" 
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-5 w-5" />
                  )}
                  {isProcessing ? 'Processando...' : 'Confirmar e Processar'}
                </Button>
              </>
            ) : (
              <>
                {!cameraStarted ? (
                  <Button 
                    onClick={startCamera} 
                    className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
                  >
                    <Camera className="mr-2 h-5 w-5" /> 
                    Iniciar Câmera
                  </Button>
                ) : (
                  <Button 
                    onClick={takePhoto} 
                    className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700" 
                    disabled={!stream}
                  >
                    <Camera className="mr-2 h-5 w-5" /> 
                    Capturar Foto
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}