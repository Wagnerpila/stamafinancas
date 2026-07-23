import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import CreditCardTransactionForm from "../components/creditcard/CreditCardTransactionForm";

const categoryLabels = {
  food: "Alimentação",
  transport: "Transporte",
  health: "Saúde",
  education: "Educação",
  entertainment: "Lazer",
  shopping: "Compras",
  bills: "Contas",
  other_expense: "Outros"
};

export default function CreditCardTransactions() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const cardId = searchParams.get("card");

  const [card, setCard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      if (cardId) {
        const [cardData, txData] = await Promise.all([
          base44.entities.CreditCard.filter({ id: cardId }),
          base44.entities.CreditCardTransaction.filter({ card_id: cardId, created_by: user.email }, "-purchase_date")
        ]);
        setCard(cardData[0]);
        setTransactions(txData);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [cardId]);

  const handleSubmit = async (txData) => {
    try {
      if (txData.installments > 1) {
        const transactions = [];
        for (let i = 1; i <= txData.installments; i++) {
          transactions.push({
            ...txData,
            amount: txData.amount / txData.installments,
            installment_number: i,
            description: `${txData.description} (${i}/${txData.installments})`
          });
        }
        await base44.entities.CreditCardTransaction.bulkCreate(transactions);
      } else {
        await base44.entities.CreditCardTransaction.create(txData);
      }
      await loadData();
      setShowForm(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Excluir esta transação?")) {
      try {
        await base44.entities.CreditCardTransaction.delete(id);
        await loadData();
      } catch (error) {
        console.error("Erro ao excluir:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Cartão não encontrado</p>
        <Button onClick={() => navigate(createPageUrl("CreditCards"))} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("CreditCards"))}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{card.name}</h1>
          <p className="text-slate-600 dark:text-slate-300">Lançamentos do cartão</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-5 h-5 mr-2" /> Novo Lançamento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Gasto Total</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">R$ {totalSpent.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Disponível</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">R$ {(card.limit - totalSpent).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Transações</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{transactions.length}</p>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <CreditCardTransactionForm
            cardId={cardId}
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
          />
        </motion.div>
      )}

      <Card className="border-0 shadow-lg">
        <CardHeader>
        <CardTitle className="dark:text-white">Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Nenhuma transação lançada</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                       <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">{tx.description}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                      {categoryLabels[tx.category]} • {new Date(tx.purchase_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-bold text-red-600">R$ {tx.amount.toFixed(2)}</p>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}