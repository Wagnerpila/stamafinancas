import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { CreditCard as CreditCardIcon, Plus, Edit2, Trash2, FileText, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import CreditCardForm from "../components/creditcard/CreditCardForm.jsx";
import InvoiceOCRDialog from "../components/creditcard/InvoiceOCRDialog.jsx";

// Paleta de gradientes para cartões — rotativamente atribuída por índice
const CARD_GRADIENTS = [
  { bg: "from-purple-700 to-purple-900", bar: "from-purple-400 to-purple-300", badge: "bg-purple-500" },
  { bg: "from-slate-700 to-slate-900",   bar: "from-blue-400 to-blue-300",    badge: "bg-blue-500"   },
  { bg: "from-emerald-700 to-emerald-900", bar: "from-emerald-400 to-emerald-300", badge: "bg-emerald-500" },
  { bg: "from-rose-700 to-rose-900",     bar: "from-rose-400 to-rose-300",    badge: "bg-rose-500"   },
  { bg: "from-amber-700 to-amber-900",   bar: "from-amber-400 to-amber-300",  badge: "bg-amber-500"  },
  { bg: "from-indigo-700 to-indigo-900", bar: "from-indigo-400 to-indigo-300", badge: "bg-indigo-500" },
  { bg: "from-teal-700 to-teal-900",     bar: "from-teal-400 to-teal-300",   badge: "bg-teal-500"   },
  { bg: "from-pink-700 to-pink-900",     bar: "from-pink-400 to-pink-300",   badge: "bg-pink-500"   },
];

function getGradient(index) {
  return CARD_GRADIENTS[index % CARD_GRADIENTS.length];
}

export default function CreditCards() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [cardsWithBalance, setCardsWithBalance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [ocrCard, setOcrCard] = useState(null);

  const calculateAvailableLimit = (card, allInvoices) => {
    // Apenas faturas abertas ou fechadas (não pagas) consomem limite
    let invoiceUsed = 0;
    allInvoices
      .filter(inv => inv.card_id === card.id && (inv.status === "open" || inv.status === "closed"))
      .forEach(inv => { invoiceUsed += inv.total_amount || 0; });

    const availableLimit = card.limit - invoiceUsed;
    return { ...card, availableLimit: availableLimit > 0 ? availableLimit : 0, usedLimit: invoiceUsed };
  };

  const loadCards = async () => {
    try {
      const user = await base44.auth.me();
      const [data, allInvoices] = await Promise.all([
        base44.entities.CreditCard.filter({ created_by: user.email }, "-created_date"),
        base44.entities.CreditCardInvoice.filter({ created_by: user.email }),
      ]);
      const cardsWithBalances = data.map(card => calculateAvailableLimit(card, allInvoices));
      setCards(data);
      setCardsWithBalance(cardsWithBalances);
    } catch (error) {
      console.error("Erro ao carregar cartões:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCards(); }, []);

  const handleSubmit = async (cardData) => {
    if (editingCard) {
      await base44.entities.CreditCard.update(editingCard.id, cardData);
    } else {
      await base44.entities.CreditCard.create(cardData);
    }
    await loadCards();
    setShowForm(false);
    setEditingCard(null);
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja excluir este cartão?")) {
      await base44.entities.CreditCard.delete(id);
      await loadCards();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Cartões de Crédito</h1>
          <p className="text-slate-600 dark:text-slate-300">Gerencie seus cartões e faturas</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingCard(null); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-5 h-5 mr-2" /> Novo Cartão
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingCard(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCard ? 'Editar Cartão' : 'Novo Cartão'}</DialogTitle>
          </DialogHeader>
          <CreditCardForm
            card={editingCard}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingCard(null); }}
          />
        </DialogContent>
      </Dialog>

      {ocrCard && (
        <InvoiceOCRDialog
          open={!!ocrCard}
          card={ocrCard}
          onClose={() => setOcrCard(null)}
          onImportSuccess={loadCards}
        />
      )}

      {cards.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <CreditCardIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Nenhum cartão cadastrado</h3>
            <p className="text-slate-600 mb-6">Adicione seu primeiro cartão de crédito</p>
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-5 h-5 mr-2" /> Adicionar Cartão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cardsWithBalance.map((card, index) => {
            const grad = getGradient(card.color_index ?? index);
            const usedPct = card.limit > 0 ? (card.usedLimit / card.limit) * 100 : 0;
            const freePct = 100 - usedPct;
            return (
              <motion.div key={card.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className={`border-0 shadow-xl bg-gradient-to-br ${grad.bg} text-white overflow-hidden`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg ${grad.badge} flex items-center justify-center shadow`}>
                          <CreditCardIcon className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg">{card.name}</span>
                      </div>
                      {!card.active && <span className="text-xs bg-red-500 px-2 py-1 rounded-full">Inativo</span>}
                    </CardTitle>
                    {card.last_digits && (
                      <p className="text-sm text-white/60 tracking-widest mt-1">**** **** **** {card.last_digits}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <p className="text-base font-bold">Limite: R$ {card.limit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-white/70">Usado este mês:</span>
                        <span className="text-red-300 font-semibold">R$ {card.usedLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-white/70">Disponível:</span>
                        <span className="text-green-300 font-bold">R$ {card.availableLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                        <div
                          className={`bg-gradient-to-r ${grad.bar} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(usedPct, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-white/50 mt-1">
                        <span>{usedPct.toFixed(0)}% usado</span>
                        <span>{freePct.toFixed(0)}% livre</span>
                      </div>
                      <p className="text-xs text-white/60 pt-2 border-t border-white/10">
                        Fecha dia {card.closing_day} • Vence dia {card.due_day}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white border-0"
                        onClick={() => navigate(createPageUrl("CreditCardInvoices") + `?card=${card.id}`)}
                      >
                        <FileText className="w-4 h-4 mr-1" /> Faturas
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white border-0"
                        onClick={() => setOcrCard(card)}
                        title="Ler fatura via OCR (PDF ou imagem)"
                      >
                        <ScanLine className="w-4 h-4 mr-1" /> OCR
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/70 hover:text-white hover:bg-white/10"
                        onClick={() => { setEditingCard(card); setShowForm(true); }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/70 hover:text-red-300 hover:bg-white/10"
                        onClick={() => handleDelete(card.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}