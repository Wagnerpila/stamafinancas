import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { readInvoiceOCR } from "@/functions/readInvoiceOCR";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import { normalizeDesc } from "../lib/purchaseMatch";

// Normaliza a data de um lançamento extraído pela IA pra "YYYY-MM-DD". Faturas brasileiras
// imprimem a data como DD/MM (sem ano); a IA às vezes repassa isso literalmente em vez de
// completar o ano, e mandar isso direto pro banco quebra o insert (Prisma exige ISO-8601 válido).
function normalizeInvoiceDate(dateStr, referenceMonth) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // DD/MM ou DD/MM/AAAA (ou AA de 2 dígitos) — padrão brasileiro, dia primeiro
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, "0");
    const month = brMatch[2].padStart(2, "0");
    if (Number(day) > 31 || Number(month) > 12) return null;
    let year = brMatch[3];
    if (!year) {
      year = referenceMonth?.slice(0, 4) || String(new Date().getFullYear());
    } else if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(s);
  return isNaN(parsed) ? null : parsed.toISOString().split("T")[0];
}

// Parseia formatos: "2/12", "04/10", "PAR 03/06", "3 de 10", "PARC 2/5" → { current, total }
function parseInstallment(info) {
  if (!info) return null;
  const s = String(info);
  // Faturas com layout ruim às vezes quebram um número no meio (ex: "09/1 0" em vez de "09/10")
  // — junta dígito+espaço+dígito antes de tentar casar, sem afetar o padrão "3 de 10" (que tem
  // letras entre os números, não fica colado por essa regra).
  const compact = s.replace(/(\d)\s+(\d)/g, "$1$2");
  const match = compact.match(/(\d+)\s*[\/]\s*(\d+)/) || s.match(/(\d+)\s+de\s+(\d+)/i);
  if (!match) return null;
  const current = parseInt(match[1]);
  const total = parseInt(match[2]);
  if (isNaN(current) || isNaN(total) || total <= 1 || current > total) return null;
  return { current, total };
}

// Verifica se um lançamento extraído pela IA já foi importado antes (ex: a fatura deste mês
// mostra, pra contexto, uma parcela que já foi lançada na fatura anterior). Compras parceladas
// são identificadas pela mesma descrição + mesmo número de parcela/total; compras avulsas, por
// descrição + valor + data — evita duplicar o lançamento ao importar faturas em sequência.
function findExistingMatch(item, parsed, existingTxs, referenceMonth) {
  const desc = normalizeDesc(item.description);
  return existingTxs.find(tx => {
    if (normalizeDesc(tx.description) !== desc) return false;
    if (parsed) {
      return tx.installments === parsed.total && tx.installment_number === parsed.current;
    }
    if (tx.installments > 1) return false; // compra avulsa não deve casar com uma parcelada
    const sameAmount = Math.abs((tx.amount || 0) - (item.amount || 0)) < 0.01;
    const itemDate = normalizeInvoiceDate(item.date, referenceMonth);
    const sameDate = itemDate && tx.purchase_date && tx.purchase_date.slice(0, 10) === itemDate;
    return sameAmount && sameDate;
  });
}

export default function InvoiceOCRDialog({ open, onClose, card, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [importing, setImporting] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);
  // Snapshot das transações já existentes deste cartão no momento da análise — usado pra marcar
  // itens duplicados na lista (ver findExistingMatch). Os compromissos futuros (Bill) são
  // rebuscados na hora de importar, não aqui — ver freshCardBills em handleImport.
  const [existingTxs, setExistingTxs] = useState([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (open) {
      base44.auth.me().then(user => {
        base44.entities.TransactionCategory.filter({ created_by: user.email, type: "expense" })
          .then(cats => {
            // Deduplicar por nome (caso existam duplicatas no banco)
            const seen = new Set();
            const unique = (cats || []).filter(c => {
              if (seen.has(c.name)) return false;
              seen.add(c.name);
              return c.active !== false;
            });
            setCustomCategories(unique);
          })
          .catch(() => {});
      }).catch(() => {});
    }
  }, [open]);

  // Usa categorias do banco; se vazio, cai no fallback hardcoded
  const allExpenseCategories = customCategories.length > 0
    ? customCategories.map(c => ({ value: c.name, label: c.name }))
    : EXPENSE_CATEGORIES;

  const getCategoryLabel = (value) =>
    allExpenseCategories.find(c => c.value === value)?.label || value || "—";

  const reset = () => {
    setFile(null); setResult(null); setError(null); setItems([]);
  };

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null); setError(null); setItems([]);
    analyze(f);
  };

  const analyze = async (f) => {
    setLoading(true); setError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });

      // Busca parcelas já lançadas neste cartão para ajudar o OCR a identificar continuações, e
      // também pra marcar na lista os itens que já foram importados antes (evita duplicar ao
      // importar faturas em sequência, mês a mês)
      const existing = await base44.entities.CreditCardTransaction.filter({ card_id: card.id });
      setExistingTxs(existing || []);
      const existing_installments = (existing || [])
        .filter(t => t.installments > 1)
        .map(t => ({ description: t.description, installment_number: t.installment_number, installments: t.installments }));

      const user_categories = customCategories.map(c => c.name);

      const res = await readInvoiceOCR({ file_url, card_name: card.name, user_categories, existing_installments });
      const data = res.data?.data;
      if (!data || !data.transactions?.length) {
        setError("Não foi possível extrair lançamentos deste arquivo.");
      } else {
        setResult(data);
        // Categoria padrão quando OCR não identificar: busca "Compras" na lista do usuário
        const defaultCat = customCategories.find(c => c.name.toLowerCase().includes("compra"))?.name || "Compras";

        setItems(data.transactions.map(t => {
          // Tenta encontrar a categoria sugerida pelo OCR na lista do usuário (busca flexível)
          const suggestedCat = t.category
            ? (customCategories.find(c => c.name.toLowerCase() === t.category.toLowerCase())?.name || "")
            : "";
          const parsed = parseInstallment(t.installment_info);
          const isDuplicate = !!findExistingMatch(t, parsed, existing || [], data.reference_month);
          return {
            ...t,
            selected: !isDuplicate, // parcela/compra já lançada antes: começa desmarcada
            isDuplicate,
            notes: t.installment_info ? `Parcela: ${t.installment_info}` : "",
            category: suggestedCat || defaultCat // fallback para "Compras" se OCR não identificou
          };
        }));
      }
    } catch (e) {
      setError("Erro ao processar arquivo: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (i) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, selected: !it.selected } : it));
  const updateItem = (i, field, value) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  const selectedItems = items.filter(it => it.selected);

  // Parcelas já lançadas em mês anterior (isDuplicate) nem entram na lista de revisão — ficam "em
  // segundo plano" só pra ajudar a reconhecer a continuação da compra (ver findExistingMatch),
  // sem opção de seleção nenhuma. Assim não tem como o usuário reimportar uma por engano (nem
  // pelo "Todos", nem clicando nela), que era a causa da duplicação de compromissos futuros.
  const visibleItems = items
    .map((it, idx) => ({ ...it, __idx: idx }))
    .filter(it => !it.isDuplicate);
  const skippedItems = items
    .map((it, idx) => ({ ...it, __idx: idx }))
    .filter(it => it.isDuplicate);

  const handleImport = async () => {
    if (!result || selectedItems.length === 0) return;

    // Rede de segurança: parcelas duplicadas nem aparecem na lista pra seleção (ver visibleItems/
    // skippedItems abaixo), então isso não deveria disparar mais — mas se algum dado antigo ou uma
    // mudança futura reintroduzir um jeito de selecionar uma mesmo assim, ainda avisa antes de
    // duplicar a compra inteira (transação, fatura e compromissos futuros das parcelas seguintes).
    const duplicatesSelected = selectedItems.filter(it => it.isDuplicate);
    if (duplicatesSelected.length > 0) {
      const names = duplicatesSelected.map(it => `• ${it.description}${it.installment_info ? ` (${it.installment_info})` : ""}`).join("\n");
      const proceed = window.confirm(
        `${duplicatesSelected.length} ite${duplicatesSelected.length > 1 ? "ns" : "m"} selecionado${duplicatesSelected.length > 1 ? "s" : ""} já ${duplicatesSelected.length > 1 ? "foram lançados" : "foi lançado"} antes:\n\n${names}\n\n` +
        `Importar de novo vai duplicar essa(s) parcela(s) (na transação, na fatura e nos compromissos futuros). Continuar mesmo assim?`
      );
      if (!proceed) return;
    }

    setImporting(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      // Rebusca os compromissos futuros (Bill) agora, na hora de gravar — não usa o snapshot de
      // existingCardBills carregado quando o arquivo foi analisado (algum tempo atrás, enquanto o
      // usuário revisava a lista). Uma fatura importada nesse meio-tempo (noutra aba, ou pagando
      // outra fatura deste cartão) já teria criado/removido placeholders que o snapshot antigo não
      // via — e as checagens "1b"/"alreadyBilled" abaixo, comparando só o TÍTULO, acabavam sem
      // reconhecer um compromisso que já existia e criando um segundo, com vencimento diferente
      // pro mesmo "Parcela N/Total".
      const freshCardBills = await base44.entities.Bill.filter({ card_id: card.id, category: "credit_card" });

      // 1. Criar CreditCardTransactions
      const created = [];
      for (const it of selectedItems) {
        const parsed = parseInstallment(it.installment_info);
        // Garante que notes contém a info de parcela para fallback no payInvoice
        const notesWithInstallment = it.installment_info
          ? (it.notes ? `${it.notes} | Parcela: ${it.installment_info}` : `Parcela: ${it.installment_info}`)
          : (it.notes || undefined);
        const tx = await base44.entities.CreditCardTransaction.create({
          card_id: card.id,
          description: it.description,
          amount: it.amount,
          category: it.category,
          purchase_date: normalizeInvoiceDate(it.date, result.reference_month) || today,
          installments: parsed?.total || 1,
          installment_number: parsed?.current || 1,
          notes: notesWithInstallment
        });
        created.push({ tx, parsed, it });
      }

      // 1b. Remove o "compromisso futuro" (Bill) que uma fatura anterior criou pra essa mesma
      // parcela — ela virou a transação real acima, então o placeholder ficaria contando o
      // mesmo valor duas vezes no limite disponível do cartão (ver CreditCards.jsx).
      const placeholdersToDelete = created
        .filter(({ parsed }) => parsed)
        .map(({ it, parsed }) => freshCardBills.find(b =>
          b.status === "pending" &&
          normalizeDesc(b.title).startsWith(normalizeDesc(it.description)) &&
          b.title.endsWith(`Parcela ${parsed.current}/${parsed.total}`)
        ))
        .filter(Boolean);
      if (placeholdersToDelete.length > 0) {
        await Promise.all(placeholdersToDelete.map(b => base44.entities.Bill.delete(b.id)));
      }

      // 2. Criar fatura automaticamente
      // Ancora as datas no mês de referência da PRÓPRIA fatura (reference_month), não em "hoje"
      // — importar uma fatura atrasada ou de meses passados fazia todo o cronograma de vencimento
      // e das parcelas futuras (abaixo) se basear na data de hoje, e não no ciclo real da fatura.
      const referenceMonth = result.reference_month ||
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      const refMatch = referenceMonth.match(/^(\d{4})-(\d{2})/);
      const refYear = refMatch ? Number(refMatch[1]) : new Date().getFullYear();
      const refMonthIndex = refMatch ? Number(refMatch[2]) - 1 : new Date().getMonth();

      const closingDate = new Date(refYear, refMonthIndex, card.closing_day || 1);
      const dueDate = new Date(refYear, refMonthIndex + 1, card.due_day || 10);

      const totalAmount = selectedItems.reduce((s, it) => s + it.amount, 0);

      const invoice = await base44.entities.CreditCardInvoice.create({
        card_id: card.id,
        reference_month: referenceMonth,
        closing_date: closingDate.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
        total_amount: totalAmount,
        status: "closed"
      });

      for (const { tx } of created) {
        await base44.entities.CreditCardTransaction.update(tx.id, { invoice_id: invoice.id });
      }

      // 3. Criar compromissos futuros para parcelas restantes — pulando parcelas que uma fatura
      // importada anteriormente já tenha gerado como Bill, ou que já existam como transação real
      // (ex: a própria fatura deste mês já trazia aquela parcela futura como um lançamento à
      // parte). Sem isso, importar faturas em sequência mês a mês duplicava o mesmo compromisso.
      const billsToCreate = [];
      for (const { it, parsed } of created) {
        if (!parsed) continue;
        const { current, total } = parsed;
        const remaining = total - current; // parcelas que ainda vão vencer
        if (remaining <= 0) continue;
        const desc = normalizeDesc(it.description);

        for (let offset = 1; offset <= remaining; offset++) {
          const installmentNumber = current + offset;

          const alreadyRecorded = created.some(({ it: other, parsed: otherParsed }) =>
            otherParsed && normalizeDesc(other.description) === desc && otherParsed.current === installmentNumber && otherParsed.total === total
          );
          const alreadyBilled = freshCardBills.some(b =>
            normalizeDesc(b.title).startsWith(desc) && b.title.endsWith(`Parcela ${installmentNumber}/${total}`)
          );
          if (alreadyRecorded || alreadyBilled) continue;

          // Cada parcela futura vence um mês após a anterior, a partir do vencimento desta
          // fatura (dueDate já ancorado no reference_month acima) — não a partir de hoje.
          const futureDate = new Date(dueDate.getFullYear(), dueDate.getMonth() + offset, card.due_day || 10);
          const dueDateStr = futureDate.toISOString().split("T")[0];
          billsToCreate.push({
            title: `${it.description} — Parcela ${installmentNumber}/${total}`,
            description: `Parcela ${installmentNumber} de ${total} · Cartão ${card.name}`,
            amount: it.amount,
            type: "payable",
            category: "credit_card",
            due_date: dueDateStr,
            status: "pending",
            recurrence: "none",
            card_id: card.id,
            linked_bill_id: invoice.id
          });
        }
      }

      if (billsToCreate.length > 0) {
        await base44.entities.Bill.bulkCreate(billsToCreate);
      }

      onImportSuccess?.();
      onClose();
      reset();
    } catch (e) {
      setError("Erro ao importar: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const formatBRL = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[88dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Importar Fatura — {card?.name}
          </DialogTitle>
        </DialogHeader>

        {/* Upload area */}
        <div
          className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-5 text-center cursor-pointer hover:border-blue-400 transition-colors"
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current.click()}
        >
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
            onChange={e => handleFile(e.target.files[0])} />
          {loading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Analisando fatura...</p>
            </div>
          ) : file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-xs">{file.name}</p>
              <button onClick={(e) => { e.stopPropagation(); reset(); }} className="text-slate-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              <Upload className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-slate-600 dark:text-slate-300 font-medium text-sm">Arraste ou clique para enviar a fatura</p>
              <p className="text-xs text-slate-400">PDF, PNG, JPG — a análise começa automaticamente</p>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        {result && items.length > 0 && (
          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg space-y-2">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                  Fatura {result.reference_month} · R$ {formatBRL(result.total_amount)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedItems.length} de {visibleItems.length} novos selecionados · R$ {formatBRL(selectedItems.reduce((s, it) => s + it.amount, 0))}
                  {skippedItems.length > 0 && ` · ${skippedItems.length} já lançado${skippedItems.length > 1 ? "s" : ""} antes (ignorado${skippedItems.length > 1 ? "s" : ""})`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setItems(prev => prev.map(it => ({ ...it, selected: !it.isDuplicate })))}>Todos</Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setItems(prev => prev.map(it => ({ ...it, selected: false })))}>Nenhum</Button>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {visibleItems.map((it) => {
                const i = it.__idx;
                const parsed = parseInstallment(it.installment_info);
                const remaining = parsed ? parsed.total - parsed.current : 0;
                return (
                  <div
                    key={i}
                    className={`rounded-lg border transition-colors ${
                      it.selected
                        ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-50"
                    }`}
                  >
                    <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => toggleSelect(i)}>
                      <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${it.selected ? "text-blue-600" : "text-slate-300"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 break-words leading-snug">{it.description}</p>
                          <span className="text-sm font-bold text-red-500 flex-shrink-0 whitespace-nowrap">R$ {formatBRL(it.amount)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {it.installment_info && (
                            <Badge variant="outline" className="text-xs">{it.installment_info}</Badge>
                          )}
                          {remaining > 0 && (
                            <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              +{remaining} futuras
                            </Badge>
                          )}
                          {it.category
                            ? <Badge variant="secondary" className="text-xs">{it.category}</Badge>
                            : <Badge variant="outline" className="text-xs text-orange-500 border-orange-400">Escolha a categoria</Badge>
                          }
                        </div>
                      </div>
                    </div>

                    {it.selected && (
                      <div className="px-3 pb-3 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                        <select
                          value={it.category}
                          onChange={e => updateItem(i, "category", e.target.value)}
                          className={`w-full text-xs rounded-md border px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 ${
                            !it.category ? "border-orange-400 text-orange-500" : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          <option value="">— Selecione a categoria —</option>
                          {allExpenseCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <Input
                          className="w-full text-xs h-8"
                          placeholder="Comentário (opcional)"
                          value={it.notes}
                          onChange={e => updateItem(i, "notes", e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {skippedItems.length > 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5">
                <button
                  type="button"
                  onClick={() => setShowSkipped(v => !v)}
                  className="w-full flex items-center justify-between font-medium hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <span>
                    {skippedItems.length} parcela{skippedItems.length > 1 ? "s" : ""} de mês(es) anterior(es) já lançada{skippedItems.length > 1 ? "s" : ""} — não entra{skippedItems.length > 1 ? "m" : ""} nesta importação
                  </span>
                  {showSkipped ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
                {/* Só pra conferência — de propósito não tem checkbox nem clique aqui: essas
                    parcelas já viraram lançamento real antes, então não há por que reimportar. */}
                {showSkipped && (
                  <ul className="mt-2 space-y-1 pl-1">
                    {skippedItems.map(it => (
                      <li key={it.__idx} className="flex items-center justify-between gap-2">
                        <span className="truncate">{it.description}{it.installment_info ? ` (${it.installment_info})` : ""}</span>
                        <span className="flex-shrink-0">R$ {formatBRL(it.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t dark:border-slate-700">
              <Button variant="outline" onClick={reset} className="flex-1">Cancelar</Button>
              <Button
                onClick={handleImport}
                disabled={importing || selectedItems.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {importing
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
                  : `Importar e Gerar Fatura (${selectedItems.length})`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}