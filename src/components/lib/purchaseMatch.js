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

// Remove o sufixo de parcela que os dois fluxos de lançamento parcelado colam na descrição, pra
// sobrar só o nome da compra em si:
//   - Lançamento manual (CreditCardTransactions.jsx): "Tênis Corrida (2/4)"
//   - Compromisso futuro gerado pela importação de fatura (InvoiceOCRDialog.jsx), que usa o title
//     do Bill: "Tênis Corrida — Parcela 2/4"
// Usado por getInstallmentGroupKey pra reconhecer que duas parcelas são a mesma compra mesmo com
// esses sufixos diferentes.
function stripInstallmentSuffix(description) {
  return String(description || "")
    .replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/, "")
    .replace(/\s*—\s*Parcela\s*\d+\s*\/\s*\d+\s*$/i, "");
}

// Chave usada pra agrupar todas as parcelas de uma mesma compra (CreditCardTransaction já
// lançadas em faturas passadas/atual, e Bills-placeholder de parcelas futuras ainda não faturadas)
// independente de qual sufixo de parcela cada uma carrega na descrição/título. Ver
// CreditCardInvoices.jsx (propagar comentário) e InvoiceOCRDialog.jsx (herdar comentário do
// placeholder ao materializar a parcela futura).
export function getInstallmentGroupKey(description) {
  return normalizeDesc(stripInstallmentSuffix(description));
}
