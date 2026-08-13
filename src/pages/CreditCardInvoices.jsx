import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, FileText, CheckCircle, Clock, AlertCircle, ShoppingCart, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { getCategoryLabel } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const statusLabels = {
  open: { label: "Aberta", color: "bg-blue-100 text-blue-800", icon: Clock },
  closed: { label: "Fechada", color: "bg-amber-100 text-amber-800", icon: AlertCircle },
  paid: { label: "Paga", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  overdue: { label: "Vencida", color: "bg-red-100 text-red-800", icon: AlertCircle }
};

export default function CreditCardInvoices() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const cardId = searchParams.get("card");

  const [card, setCard] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      if (cardId) {
        const [cardData, invoiceData, txData] = await Promise.all([
          base44.entities.CreditCard.filter({ id: cardId }),
          base44.entities.CreditCardInvoice.filter({ card_id: cardId, created_by: user.email }, "-reference_month"),
          base44.entities.CreditCardTransaction.filter({ card_id: cardId, created_by: user.email })
        ]);
        setCard(cardData[0]);
        setInvoices(invoiceData);
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

  const generateInvoice = async () => {
    if (!card) return;
    setGeneratingInvoice(true);
    try {
      const today = new Date();
      const referenceMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      
      const closingDate = new Date(today.getFullYear(), today.getMonth(), card.closing_day);
      const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, card.due_day);

      const unbilledTx = transactions.filter(tx => !tx.invoice_id);
      const totalAmount = unbilledTx.reduce((sum, tx) => sum + tx.amount, 0);

      const invoice = await base44.entities.CreditCardInvoice.create({
        card_id: cardId,
        reference_month: referenceMonth,
        closing_date: closingDate.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
        total_amount: totalAmount,
        status: "closed"
      });

      for (const tx of unbilledTx) {
        await base44.entities.CreditCardTransaction.update(tx.id, { invoice_id: invoice.id });
      }

      await loadData();
    } catch (error) {
      console.error("Erro ao gerar fatura:", error);
      alert("Erro ao gerar fatura");
    } finally {
      setGeneratingInvoice(false);
    }
  };

  // Usa a categoria como está (pode ser nome em português vindo do OCR)
  const safeCategory = (cat) => cat || "other_expense";

  // Parseia "2/12", "PAR 03/06", "3 de 10" → { current, total }
  const parseInstallment = (info) => {
    if (!info) return null;
    const s = String(info);
    const match = s.match(/(\d+)\s*\/\s*(\d+)/) || s.match(/(\d+)\s+de\s+(\d+)/i);
    if (!match) return null;
    const current = parseInt(match[1]);
    const total = parseInt(match[2]);
    if (isNaN(current) || isNaN(total) || total <= 1 || current > total) return null;
    return { current, total };
  };

  const deleteInvoice = async (invoice) => {
    if (!confirm(`Excluir fatura ${invoice.reference_month} e todas as suas transações e compromissos futuros? Esta ação não pode ser desfeita.`)) return;
    setDeletingInvoice(true);
    try {
      const user = await base44.auth.me();

      // 1. CreditCardTransactions vinculadas à fatura (já carregadas em memória)
      const invoiceTxs = transactions.filter(tx => tx.invoice_id === invoice.id);

      // 2. Transactions e Bills do usuário — buscar em paralelo (sem limite)
      const [linkedTxs, allUserBills] = await Promise.all([
        base44.entities.Transaction.filter({ created_by: user.email }, "-created_date", 500),
        base44.entities.Bill.filter({ created_by: user.email }, "-created_date", 500)
      ]);

      // Filtrar client-side: Transactions com invoice_id desta fatura
      const txsToDelete = linkedTxs.filter(tx => tx.invoice_id === invoice.id);

      // Filtrar client-side: Bills com linked_bill_id desta fatura (parcelas futuras)
      const futureBills = allUserBills.filter(b => b.linked_bill_id === invoice.id);

      // Deletar tudo em paralelo, depois deletar a fatura
      await Promise.all([
        ...invoiceTxs.map(tx => base44.entities.CreditCardTransaction.delete(tx.id)),
        ...txsToDelete.map(tx => base44.entities.Transaction.delete(tx.id)),
        ...futureBills.map(b => base44.entities.Bill.delete(b.id))
      ]);

      await base44.entities.CreditCardInvoice.delete(invoice.id);
      await loadData();
    } catch (error) {
      console.error("Erro ao excluir fatura:", error);
      alert(`Erro ao excluir fatura: ${error.message || error}`);
    } finally {
      setDeletingInvoice(false);
    }
  };

  const payInvoice = async (invoice) => {
    if (confirm(`Confirmar pagamento de R$ ${invoice.total_amount.toFixed(2)}?`)) {
      try {
        const invoiceTxs = transactions.filter(tx => tx.invoice_id === invoice.id);
        const today = new Date().toISOString().split("T")[0];

        if (invoiceTxs.length > 0) {
          // Cria transações com invoice_id para rastrear e excluir depois
          const transactionsToCreate = invoiceTxs.map(tx => ({
            description: tx.description,
            amount: tx.amount,
            type: "expense",
            category: safeCategory(tx.category),
            date: today,
            payment_method: "credit_card",
            source: "credit_card",
            credit_card_id: cardId,
            invoice_id: invoice.id,
            notes: tx.notes || `Fatura ${card.name} ${invoice.reference_month}`
          }));
          await base44.entities.Transaction.bulkCreate(transactionsToCreate);

          // Criar compromissos futuros para parcelas restantes
          const billsToCreate = [];
          for (const tx of invoiceTxs) {
            // Usa campos diretos da entidade (salvos pelo OCR)
            let current = tx.installment_number > 0 ? tx.installment_number : null;
            let total = tx.installments > 1 ? tx.installments : null;

            // Fallback: parsear das notes
            if (!current || !total) {
              const parsed = parseInstallment(tx.notes);
              if (parsed) { current = parsed.current; total = parsed.total; }
            }

            if (!current || !total || total <= 1) continue;
            const remaining = total - current;
            if (remaining <= 0) continue;

            // Ancora no vencimento da PRÓPRIA fatura sendo paga, não em "hoje" — senão pagar uma
            // fatura atrasada desalinhava o cronograma das parcelas futuras restantes.
            const dueAnchor = new Date(invoice.due_date.slice(0, 10) + "T00:00:00");
            for (let offset = 1; offset <= remaining; offset++) {
              const futureDate = new Date(dueAnchor.getFullYear(), dueAnchor.getMonth() + offset, card.due_day || 10);
              billsToCreate.push({
                title: `${tx.description} — Parcela ${current + offset}/${total}`,
                description: `Parcela ${current + offset} de ${total} · Cartão ${card.name}`,
                amount: tx.amount,
                type: "payable",
                category: "credit_card",
                due_date: futureDate.toISOString().split("T")[0],
                status: "pending",
                recurrence: "none",
                linked_bill_id: invoice.id,  // rastreia a fatura de origem
                card_id: cardId  // associa ao cartão correto
              });
            }
          }
          if (billsToCreate.length > 0) {
            await base44.entities.Bill.bulkCreate(billsToCreate);
          }
        } else {
          await base44.entities.Transaction.create({
            description: `Pagamento Fatura ${card.name} - ${invoice.reference_month}`,
            amount: invoice.total_amount,
            type: "expense",
            category: "bills",
            date: today,
            payment_method: "credit_card",
            source: "credit_card",
            credit_card_id: cardId,
            notes: `Fatura do cartão ${card.name}`
          });
        }

        await base44.entities.CreditCardInvoice.update(invoice.id, {
          status: "paid",
          paid_amount: invoice.total_amount,
          paid_date: today
        });

        await loadData();
      } catch (error) {
        console.error("Erro ao pagar fatura:", error);
        alert("Erro ao processar pagamento");
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
        <Button onClick={() => navigate(createPageUrl("CreditCards"))} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const unbilledAmount = transactions.filter(tx => !tx.invoice_id).reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto relative">
      {deletingInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
            <p className="text-slate-700 dark:text-slate-200 font-medium">Excluindo fatura e transações...</p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("CreditCards"))}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Faturas - {card.name}</h1>
          <p className="text-slate-600 dark:text-slate-300">Gerencie as faturas do cartão</p>
        </div>

      </div>

      {unbilledAmount > 0 && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-0 shadow-lg bg-blue-50 dark:bg-blue-900/20 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Compras não Faturadas</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">R$ {unbilledAmount.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Compras lançadas neste cartão que ainda não entraram em nenhuma fatura
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <FileText className="w-10 h-10 text-blue-600" />
                  <Button
                    size="sm"
                    onClick={generateInvoice}
                    disabled={generatingInvoice}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {generatingInvoice ? "Gerando..." : "Gerar Fatura"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="space-y-4">
        {invoices.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Nenhuma fatura gerada</h3>
              <p className="text-slate-600 dark:text-slate-400">As faturas aparecerão aqui quando geradas</p>
            </CardContent>
          </Card>
        ) : (
          invoices.map((invoice) => {
            const StatusIcon = statusLabels[invoice.status].icon;
            return (
              <motion.div key={invoice.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Fatura {invoice.reference_month}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={statusLabels[invoice.status].color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusLabels[invoice.status].label}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => deleteInvoice(invoice)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Valor Total</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">R$ {invoice.total_amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Fechamento</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{new Date(invoice.closing_date).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Vencimento</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{new Date(invoice.due_date).toLocaleDateString("pt-BR")}</p>
                      </div>
                      {invoice.paid_date && (
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Pago em</p>
                          <p className="text-sm text-emerald-600 dark:text-emerald-400">{new Date(invoice.paid_date).toLocaleDateString("pt-BR")}</p>
                        </div>
                      )}
                    </div>
                    {/* Transactions list */}
                    <div className="mt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full flex items-center justify-between text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/30"
                        onClick={() => setExpandedInvoice(expandedInvoice === invoice.id ? null : invoice.id)}
                      >
                        <span className="flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4" />
                          Ver transações ({transactions.filter(tx => tx.invoice_id === invoice.id).length})
                        </span>
                        {expandedInvoice === invoice.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>

                      {expandedInvoice === invoice.id && (
                        <div className="mt-3 space-y-2">
                          {transactions.filter(tx => tx.invoice_id === invoice.id).length === 0 ? (
                            <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">Nenhuma transação nesta fatura</p>
                          ) : (
                            transactions.filter(tx => tx.invoice_id === invoice.id).map(tx => (
                              <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700">
                                <div>
                                  <p className="text-sm font-medium text-slate-900 dark:text-white">{tx.description}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                   {/* purchase_date vem da API como ISO completo ("...T00:00:00.000Z"), não como
                                       "YYYY-MM-DD" puro — concatenar "T00:00:00" nele de novo formava uma string
                                       inválida e mostrava "Invalid Date". Usa só a parte da data (10 primeiros
                                       caracteres) antes de reconstruir a data local. */}
                                   {getCategoryLabel(tx.category)} · {tx.purchase_date ? new Date(tx.purchase_date.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                                   {tx.installments > 1 && ` · Parcela ${tx.installment_number}/${tx.installments}`}
                                  </p>
                                </div>
                                <p className="text-sm font-bold text-red-600 dark:text-red-400">R$ {tx.amount.toFixed(2)}</p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {invoice.status !== "paid" && (
                      <Button onClick={() => payInvoice(invoice)} className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Pagar Fatura
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}