import React, { useState } from "react";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eraser, AlertTriangle } from "lucide-react";

const CONFIRM_WORD = "ZERAR";

// Ferramenta de fase de desenvolvimento (ver AdminDashboard.jsx): apaga TODOS os lançamentos
// financeiros de um usuário escolhido pelo admin — transações, contas a pagar/receber, cartões
// (com faturas e lançamentos), crediários, metas, orçamentos por categoria e consultorias de IA —
// pra recomeçar os testes do zero. A conta em si, as categorias personalizadas e as preferências
// de notificação NÃO são apagadas. Mesmo padrão de confirmação de "Excluir Conta"
// (DeleteAccount.jsx): só libera o botão depois de digitar a palavra de confirmação — o usuário
// alvo fica bem visível no diálogo, já que a lista pode ter mais de uma conta.
export default function WipeUserDataPanel({ users = [], currentUser }) {
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.id || "");
  const [confirmText, setConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);

  const selectedUser = users.find((u) => u.id === selectedUserId) || currentUser;
  const isSelf = selectedUser?.id === currentUser?.id;

  const handleWipe = async () => {
    if (confirmText !== CONFIRM_WORD || !selectedUser) return;
    setWiping(true);
    try {
      const res = await User.wipeUserData(selectedUser.id);
      setResult(`Pronto — ${res.deletedCount} registro(s) apagado(s) de ${selectedUser.email}.`);
      // Só precisa recarregar se foi a própria conta do admin logado (telas com dados em cache).
      if (isSelf) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error) {
      console.error("Erro ao zerar dados:", error);
      alert(`Erro ao zerar dados: ${error.message || error}`);
      setWiping(false);
    }
  };

  return (
    <Card className="border-2 border-red-200 dark:border-red-900/50 shadow-lg bg-white/80 dark:bg-slate-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5" /> Zona de Risco — Fase de Desenvolvimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Apaga todos os lançamentos (transações, contas, cartões e faturas, crediários, metas,
          orçamentos e consultorias de IA) do usuário escolhido, pra recomeçar os testes do zero.
          A conta, categorias e preferências de notificação dele continuam intactas.
        </p>

        <div className="space-y-1.5 max-w-sm">
          <Label htmlFor="wipe-user-select" className="text-slate-700 dark:text-slate-300">Usuário</Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger id="wipe-user-select">
              <SelectValue placeholder="Selecione um usuário" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.email}{u.id === currentUser?.id ? " (você)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setConfirmText(""); setResult(null); setWiping(false); } }}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="bg-red-600 hover:bg-red-700" disabled={!selectedUser}>
              <Eraser className="w-4 h-4 mr-2" /> Apagar lançamentos deste usuário
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Apagar todos os lançamentos de {selectedUser?.email}?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  Esta ação é irreversível e apaga permanentemente, só da conta de{" "}
                  <span className="font-bold">
                    {selectedUser?.full_name} ({selectedUser?.email}){isSelf ? " — sua conta" : ""}
                  </span>:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <li>Todas as transações (receitas e despesas)</li>
                  <li>Todas as contas a pagar/receber</li>
                  <li>Todos os cartões, faturas e lançamentos de cartão</li>
                  <li>Crediários, metas e orçamentos por categoria</li>
                  <li>Histórico de consultorias de IA</li>
                </ul>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  A conta, categorias personalizadas e preferências de notificação não são afetadas.
                </p>
                <div className="space-y-2 pt-2">
                  <Label htmlFor="confirm-wipe" className="text-slate-700 dark:text-slate-300">
                    Digite <span className="font-bold text-red-600">{CONFIRM_WORD}</span> para confirmar:
                  </Label>
                  <Input
                    id="confirm-wipe"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder={CONFIRM_WORD}
                    className="border-red-300 focus:border-red-500"
                    disabled={wiping || !!result}
                  />
                </div>
                {result && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{result}</p>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={wiping} onClick={() => setConfirmText("")}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleWipe(); }}
                disabled={confirmText !== CONFIRM_WORD || wiping || !!result}
                className="bg-red-600 hover:bg-red-700"
              >
                {wiping ? "Apagando..." : "Confirmar e Apagar Tudo"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
