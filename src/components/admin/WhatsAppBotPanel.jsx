import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/api/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";

const STATUS_LABEL = {
  disconnected: "Desconectado",
  connecting: "Conectando...",
  qr: "Aguardando leitura do QR Code",
  connected: "Conectado",
};

export default function WhatsAppBotPanel() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get("/whatsapp/status");
      setStatus(data);
    } catch {
      // Silencioso — próximo poll tenta de novo.
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const data = await api.post("/whatsapp/connect");
      setStatus(data);
    } catch (err) {
      alert(`Erro ao conectar: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm("Desconectar o WhatsApp? Você precisará escanear o QR Code de novo.")) return;
    setBusy(true);
    try {
      const data = await api.post("/whatsapp/logout");
      setStatus(data);
    } catch (err) {
      alert(`Erro ao desconectar: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const state = status?.status || "disconnected";

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800 backdrop-blur-sm mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-600" /> Bot do WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Conecte um número de WhatsApp para que os usuários possam mandar fotos de comprovantes e
          faturas por lá — o bot lê, interpreta com IA e lança a transação automaticamente na conta
          da pessoa (identificada pelo número cadastrado em Configurações {'>'} Alertas).
        </p>

        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              state === "connected" ? "bg-green-500" : state === "qr" ? "bg-amber-500" : "bg-slate-400"
            }`}
          />
          <span className="font-medium text-slate-900 dark:text-white">{STATUS_LABEL[state] || state}</span>
          {status?.phoneNumber && (
            <span className="text-sm text-slate-500 dark:text-slate-400">({status.phoneNumber})</span>
          )}
        </div>

        {state === "qr" && status?.qrDataUrl && (
          <div className="flex flex-col items-center gap-2 py-2">
            <img src={status.qrDataUrl} alt="QR Code do WhatsApp" className="w-56 h-56 border rounded-lg" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Abra o WhatsApp no celular do número que será o bot → Configurações → Aparelhos conectados → Conectar aparelho.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          {state === "disconnected" && (
            <Button onClick={handleConnect} disabled={busy} className="bg-green-600 hover:bg-green-700">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Conectar WhatsApp
            </Button>
          )}
          {(state === "connected" || state === "qr" || state === "connecting") && (
            <Button onClick={handleLogout} disabled={busy} variant="outline">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Desconectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
