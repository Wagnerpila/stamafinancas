// Normaliza a descrição de uma compra pra comparar entre importações de faturas de meses
// diferentes (ver InvoiceOCRDialog.jsx e CreditCardInvoices.jsx). Além do básico (minúsculas,
// espaços), remove palavras de "tipo de compra" que a IA de OCR às vezes inclui e às vezes não
// pro MESMO lançamento — ex: fatura de julho lê "CASA BETA - COMPRA PARCELADA 01/04", fatura de
// setembro lê "CASA BETA - COMPRA 03/04" pro mesmo parcelamento, com a palavra "PARCELADA" ora
// presente ora ausente. Sem remover essas palavras, a comparação por texto falha nesse mês e o
// sistema recria como nova uma parcela que já existia — duplicando o compromisso futuro (Bill) e,
// se a diferença cair também no lançamento sendo importado, a própria transação.
const PURCHASE_TYPE_NOISE = /\b(parcelada|parcelado|a\s*vista|à\s*vista)\b/g;

export function normalizeDesc(s) {
  return String(s || "")
    .toLowerCase()
    .replace(PURCHASE_TYPE_NOISE, " ")
    .trim()
    .replace(/\s+/g, " ");
}
