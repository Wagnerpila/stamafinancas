import React, { useState } from "react";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
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
import { Trash2, AlertTriangle } from "lucide-react";

export default function DeleteAccount() {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETAR") return;

    setIsDeleting(true);
    try {
      await User.deleteMyAccount();
      window.location.href = "/login";
    } catch (error) {
      console.error("Erro ao deletar conta:", error);
      alert("Erro ao processar a exclusão da conta.");
    } finally {
      setIsDeleting(false);
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          className="w-full bg-red-600 hover:bg-red-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Excluir Conta
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Excluir Conta Permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p className="text-slate-700 font-medium">
              Esta ação é irreversível e resultará em:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
              <li>Exclusão permanente de todos os seus dados financeiros</li>
              <li>Remoção de todas as transações, metas e relatórios</li>
              <li>Cancelamento da assinatura (se houver)</li>
              <li>Perda de acesso à sua conta</li>
            </ul>
            <div className="space-y-2 pt-4">
              <Label htmlFor="confirm" className="text-slate-700">
                Digite <span className="font-bold text-red-600">DELETAR</span> para confirmar:
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="DELETAR"
                className="border-red-300 focus:border-red-500"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmText("")}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAccount}
            disabled={confirmText !== "DELETAR" || isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}