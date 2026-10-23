import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Edit2, Trash2, FileText, ScanLine, Loader2 } from "lucide-react";
import { usePageHeader, PageBody, Panel, StatCard, StatGrid, StatusBadge, ThinBar, PillButton, RoundButton, brl } from "../components/stama/kit";
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

  // O limite usado precisa considerar não só a fatura atual, mas também as parcelas futuras já
  // comprometidas (uma compra parcelada em 10x reserva o valor das 10 parcelas do limite desde a
  // compra, não só a parcela do mês corrente — é assim que cartão de crédito real funciona).
  // Essas parcelas futuras existem em duas formas diferentes dependendo de como a compra entrou
  // no sistema, e a soma final precisa cobrir as duas sem contar nada duas vezes:
  //   1. invoiceUsed  — faturas já geradas e ainda não pagas (open/closed): cobre tanto a
  //      importação de fatura (InvoiceOCRDialog) quanto o botão "Gerar Fatura".
  //   2. unbilledUsed — CreditCardTransaction sem invoice_id: parcelas lançadas manualmente em
  //      "Nova Compra" que ainda não entraram em nenhuma fatura (bulkCreate cria todas as N
  //      parcelas de uma vez, sem invoice_id — sem isso elas nunca contavam no limite).
  //   3. futureUsed   — Bill pendente de categoria "credit_card": parcelas futuras da importação
  //      de fatura que ainda nem existem como CreditCardTransaction (só nascem quando a fatura
  //      daquele mês futuro for importada de verdade — ver InvoiceOCRDialog.jsx).
  // Ao pagar/gerar uma fatura, ela sai do balde 1 e as transações saem do balde 2 (ganham
  // invoice_id) — o limite disponível sobe só o valor daquela fatura, as parcelas futuras
  // restantes continuam reservadas até vencerem, uma a uma.
  const calculateAvailableLimit = (card, allInvoices, allBills, allCardTxs) => {
    let invoiceUsed = 0;
    allInvoices
      .filter(inv => inv.card_id === card.id && (inv.status === "open" || inv.status === "closed"))
      .forEach(inv => { invoiceUsed += inv.total_amount || 0; });

    let unbilledUsed = 0;
    allCardTxs
      .filter(tx => tx.card_id === card.id && !tx.invoice_id)
      .forEach(tx => { unbilledUsed += tx.amount || 0; });

    let futureUsed = 0;
    allBills
      .filter(b => b.card_id === card.id && b.category === "credit_card" && b.status === "pending")
      .forEach(b => { futureUsed += b.amount || 0; });

    const totalUsed = invoiceUsed + unbilledUsed + futureUsed;
    const availableLimit = card.limit - totalUsed;
    return { ...card, availableLimit: availableLimit > 0 ? availableLimit : 0, usedLimit: totalUsed };
  };

  const loadCards = async () => {
    try {
      const user = await base44.auth.me();
      const [data, allInvoices, allCardTxs, allBills] = await Promise.all([
        base44.entities.CreditCard.filter({ created_by: user.email }, "-created_date"),
        base44.entities.CreditCardInvoice.filter({ created_by: user.email }),
        base44.entities.CreditCardTransaction.filter({ created_by: user.email }),
        base44.entities.Bill.filter({ created_by: user.email, type: "payable", category: "credit_card" }),
      ]);
      const cardsWithBalances = data.map(card => calculateAvailableLimit(card, allInvoices, allBills, allCardTxs));
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
    try {
      if (editingCard) {
        await base44.entities.CreditCard.update(editingCard.id, cardData);
      } else {
        await base44.entities.CreditCard.create(cardData);
      }
      await loadCards();
      setShowForm(false);
      setEditingCard(null);
    } catch (error) {
      // Sem isso, um erro do backend (ex: payload inválido) deixava o modal parado sem
      // nenhum aviso — parecia que o botão Salvar simplesmente não fazia nada.
      console.error("Erro ao salvar cartão:", error);
      alert("Não foi possível salvar o cartão. Tente novamente.");
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja excluir este cartão?")) {
      await base44.entities.CreditCard.delete(id);
      await loadCards();
    }
  };

  const totalLimit = cardsWithBalance.reduce((s, c) => s + (c.limit || 0), 0);
  const totalUsed = cardsWithBalance.reduce((s, c) => s + (c.usedLimit || 0), 0);
  const openNew = useCallback(() => { setShowForm(true); setEditingCard(null); }, []);
  usePageHeader({ title: "Cartões", subtitle: `${cards.length} cart${cards.length === 1 ? "ão" : "ões"}`, onAdd: openNew, addLabel: "Novo cartão" });

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <PageBody>
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingCard(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCard ? "Editar cartão" : "Novo cartão"}</DialogTitle>
          </DialogHeader>
          <CreditCardForm card={editingCard} onSubmit={handleSubmit} onCancel={() => { setShowForm(false); setEditingCard(null); }} />
        </DialogContent>
      </Dialog>

      {ocrCard && <InvoiceOCRDialog open={!!ocrCard} card={ocrCard} onClose={() => setOcrCard(null)} onImportSuccess={loadCards} />}

      {cards.length === 0 ? (
        <Panel>
          <button
            type="button"
            onClick={openNew}
            className="flex w-full flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 px-6 py-14 text-center transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-500 dark:border-slate-600">
              <Plus className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-semibold text-slate-900 dark:text-white">adicionar seu primeiro cartão</span>
            <span className="max-w-xs text-slate-500">limite, fechamento e fatura acompanhados pela Bia</span>
          </button>
          <p className="mt-5 text-center text-slate-500">
            Tem a fatura em PDF? Depois de cadastrar, use <strong className="text-slate-700 dark:text-slate-200">Ler fatura</strong> e a Bia lança tudo.
          </p>
        </Panel>
      ) : (
        <>
          <StatCard label="Limite disponível" value={Math.max(0, totalLimit - totalUsed)} tone="positive" size="lg" hint={`de R$ ${brl(totalLimit)} no total`} />
          <StatGrid>
            <StatCard label="Comprometido" value={totalUsed} hint="faturas + parcelas" />
            <StatCard label="Uso do limite" value={`${totalLimit ? Math.round((totalUsed / totalLimit) * 100) : 0}%`} money={false} tone={totalLimit && totalUsed / totalLimit > 0.8 ? "warning" : "neutral"} />
          </StatGrid>

          <p className="section-label !text-slate-500 pt-2">Seus cartões</p>
          <div className="grid gap-3 md:grid-cols-2">
            {cardsWithBalance.map((card, index) => {
              const grad = getGradient(card.color_index ?? index);
              const usedPct = card.limit > 0 ? (card.usedLimit / card.limit) * 100 : 0;
              const raw = cards.find((c) => c.id === card.id) || card;
              return (
                <Panel key={card.id} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className={`flex h-12 w-[4.5rem] shrink-0 items-end justify-end rounded-xl bg-gradient-to-br ${grad.bg} p-1.5 shadow-sm`}>
                      <span className="font-mono text-[10px] text-white/80">{card.last_digits ? `•${card.last_digits}` : ""}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg font-semibold text-slate-900 dark:text-white">{card.name}</p>
                      <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
                        fecha dia {card.closing_day} · vence dia {card.due_day}
                      </p>
                    </div>
                    {!card.active && <StatusBadge tone="gray">Inativo</StatusBadge>}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-2xl font-bold text-slate-900 dark:text-white">R$ {brl(card.usedLimit)}</span>
                      <span className="text-sm text-slate-500">de R$ {brl(card.limit)}</span>
                    </div>
                    <ThinBar pct={usedPct} tone="auto" />
                    <p className="text-sm text-slate-500">
                      disponível <strong className="text-brand-700 dark:text-brand-300">R$ {brl(card.availableLimit)}</strong> · {usedPct.toFixed(0)}% usado
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PillButton tone="dark" className="flex-1" onClick={() => navigate(createPageUrl("CreditCardInvoices") + `?card=${card.id}`)}>
                      <FileText className="h-4 w-4" /> Faturas
                    </PillButton>
                    <PillButton tone="outline" className="flex-1" onClick={() => setOcrCard(card)}>
                      <ScanLine className="h-4 w-4" /> Ler fatura
                    </PillButton>
                    {/* Edita o cartão "cru" (sem availableLimit/usedLimit calculados, que o backend rejeita no update). */}
                    <RoundButton label="Editar" onClick={() => { setEditingCard(raw); setShowForm(true); }} className="h-10 w-10">
                      <Edit2 className="h-4 w-4" />
                    </RoundButton>
                    <RoundButton label="Excluir" onClick={() => handleDelete(card.id)} className="h-10 w-10 hover:!text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </RoundButton>
                  </div>
                </Panel>
              );
            })}
          </div>
        </>
      )}
    </PageBody>
  );
}
