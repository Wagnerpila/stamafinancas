// All AI prompts/schemas used across the app, preserved verbatim from the previous
// base44-hosted InvokeLLM/ExtractDataFromUploadedFile call sites (see migration catalog).

// Monta a instrução de categoria compartilhada por todo fluxo que extrai transações via IA
// (extrato, recibo/foto, comando de voz/texto): sem isso, a IA inventa categorias em inglês
// (ex: "food", "transport") que não existem na lista do usuário — o app então não consegue
// casar com nenhuma categoria real e mostra "(categoria removida)" pro usuário.
function categoriesInstruction({ expenseCategories, incomeCategories } = {}) {
  const expenseBlock = expenseCategories?.length ? expenseCategories.map((c) => `- ${c}`).join('\n') : null;
  const incomeBlock = incomeCategories?.length ? incomeCategories.map((c) => `- ${c}`).join('\n') : null;
  if (!expenseBlock && !incomeBlock) {
    return 'Use uma categoria descritiva em português (ex: "Alimentação", "Transporte", "Salário") — nunca em inglês.';
  }
  return `Escolha o nome EXATO de uma das categorias abaixo (não traduza nem invente outra, nunca use termos em inglês como "food" ou "transport"). Se genuinamente não der para identificar, use a categoria de "outras despesas"/"outras receitas" da lista (ou deixe null se não houver uma assim):
${expenseBlock ? `Categorias de despesa:\n${expenseBlock}` : ''}${expenseBlock && incomeBlock ? '\n' : ''}${incomeBlock ? `Categorias de receita:\n${incomeBlock}` : ''}`;
}

export const transactionExtractionSchema = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    amount: { type: 'number' },
    type: { type: 'string', enum: ['income', 'expense'] },
    category: { type: 'string' },
    date: { type: 'string', description: 'YYYY-MM-DD' },
    payment_method: {
      type: 'string',
      enum: ['cash', 'pix', 'debit', 'credit_card', 'food_voucher'],
    },
    notes: { type: 'string' },
  },
  required: ['description', 'amount', 'type', 'date'],
};

export function receiptOcrPrompt({ expenseCategories, incomeCategories } = {}) {
  return `Analise esta imagem de comprovante/recibo de pagamento e extraia os dados da transação: descrição do estabelecimento ou item, valor, data e categoria.
Categoria: ${categoriesInstruction({ expenseCategories, incomeCategories })}`;
}

export function textTransactionPrompt(transcript, { expenseCategories, incomeCategories } = {}) {
  return `Extraia os detalhes de uma transação financeira a partir do seguinte texto: "${transcript}". Responda APENAS com um objeto JSON. O valor (amount) deve ser negativo para despesas. A data (date) deve estar no formato YYYY-MM-DD.
Se o texto mencionar "vale alimentação", "vale refeição", "VA", "VR" ou similar, defina is_food_voucher como true e escolha a categoria de alimentação da lista abaixo (se houver).
Categoria: ${categoriesInstruction({ expenseCategories, incomeCategories })}`;
}

export const statementImportSchema = {
  type: 'object',
  properties: {
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          amount: { type: 'number' },
          type: { type: 'string', enum: ['income', 'expense'] },
          date: { type: 'string' },
          category: { type: 'string' },
        },
      },
    },
  },
};

export function statementImportPrompt({ expenseCategories, incomeCategories } = {}) {
  return `Você é um especialista em leitura de extratos bancários brasileiros.
Analise este extrato bancário e extraia TODAS as transações encontradas.

REGRAS CRÍTICAS para determinar se é RECEITA (income) ou DESPESA (expense):

1. VALORES NEGATIVOS (com sinal "-" ou entre parênteses) = SEMPRE "expense"
2. VALORES POSITIVOS (sem sinal ou com "+") = "income" se for salário/transferência recebida/PIX recebido, senão avalie o contexto
3. COLUNA "DÉBITO" ou texto "DÉB", "D" ao lado = SEMPRE "expense"
4. COLUNA "CRÉDITO" ou texto "CRÉ", "C" ao lado = SEMPRE "income"
5. PALAVRAS que indicam DESPESA: pagamento, compra, saque, débito, tarifa, taxa, ted enviado, pix enviado, transferência enviada, fatura, boleto, doc enviado
6. PALAVRAS que indicam RECEITA: salário, depósito, crédito, pix recebido, ted recebido, transferência recebida, rendimento, estorno, reembolso, doc recebido
7. Se o valor aparecer em VERMELHO ou formatação de débito = "expense"
8. Em extratos de CARTÃO DE CRÉDITO: todas as compras são "expense", pagamentos da fatura são "income"
9. Em caso de dúvida genuína, use "expense"

Para cada transação extraia:
- description: descrição completa (sem símbolos de valor)
- amount: valor SEMPRE positivo (número sem sinal, sem R$, use ponto como decimal)
- type: "income" ou "expense" conforme as regras acima
- date: data no formato YYYY-MM-DD
- category: categoria sugerida a partir da descrição do lançamento (nome do estabelecimento, tipo de PIX, etc). Muitos PIX e transferências não têm um estabelecimento claro na descrição — nesse caso use a categoria de "outras despesas"/"outras receitas". ${categoriesInstruction({ expenseCategories, incomeCategories })}

Ignore linhas de saldo, totais, cabeçalhos e rodapés.
Retorne JSON válido com todas as transações encontradas.`;
}

export function invoiceOcrSchema() {
  return {
    type: 'object',
    properties: {
      reference_month: { type: 'string' },
      total_amount: { type: 'number' },
      transactions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            description: { type: 'string' },
            amount: { type: 'number' },
            installment_info: { type: 'string' },
            category: { type: 'string' },
          },
        },
      },
    },
  };
}

export function invoiceOcrPrompt({ cardName, userCategories, existingInstallments }) {
  const categoriesBlock = userCategories?.length
    ? `As categorias disponíveis para classificar são (use exatamente esses nomes):\n${userCategories.map((c) => `- ${c}`).join('\n')}`
    : 'Use uma categoria descritiva em português.';

  const existingBlock = existingInstallments?.length
    ? `\nPARCELAS JÁ LANÇADAS ANTERIORMENTE (evite duplicar, mas identifique a próxima parcela da série):\n${existingInstallments
        .map((e) => `- "${e.description}" parcela ${e.installment_number}/${e.installments}`)
        .join('\n')}`
    : '';

  return `Você é um especialista em leitura de faturas de cartão de crédito brasileiras.
Analise a imagem ou PDF da fatura do cartão "${cardName || 'cartão de crédito'}" e extraia TODOS os lançamentos encontrados.

IMPORTANTE sobre parcelas:
- Lançamentos parcelados aparecem com indicação como "2/12", "PAR 03/06", "3 de 10" etc.
- ATENÇÃO: em muitas faturas essa indicação de parcela vem GRUDADA no nome do estabelecimento,
  sem espaço (ex: "CLAUDINEIA APARECIDA02/02" é o estabelecimento "CLAUDINEIA APARECIDA" + parcela
  "02/02"; "AMAZONMKTPLC*AFCCOME09/10" é "AMAZONMKTPLC*AFCCOME" + parcela "09/10"). Sempre que o
  final da descrição terminar em dois números separados por barra (com ou sem espaço entre eles,
  ex: "02/02", "09/1 0", "09/ 10"), separe isso como installment_info e remova do description.
- Extraia cada parcela como um lançamento individual com seu valor parcial (não o total da compra)
- O campo installment_info deve conter a informação de parcela já limpa, sem espaços internos
  (ex: "9/10", nunca "9/1 0")
- NÃO some parcelas — extraia cada linha da fatura como está
- Nem todo lançamento é parcelado — se não houver nenhuma indicação de parcela na linha,
  installment_info deve ser null (não invente uma parcela)
- Se uma compra parcelada JÁ foi lançada em mês anterior (veja lista abaixo), identifique que é a continuação da mesma série — use exatamente a mesma descrição e informe o número correto da parcela
${existingBlock}

Para cada lançamento, extraia:
- description: descrição completa da compra/lançamento (sem a info de parcela)
- amount: valor numérico positivo desta linha (sem R$, sem vírgulas — use ponto como decimal)
- installment_info: informação de parcela se houver (ex: "2/12", "03/06"), ou null
- date: data do lançamento SEMPRE no formato YYYY-MM-DD. Faturas brasileiras imprimem a data como
  DD/MM (dia primeiro) — se o ano não estiver impresso na linha, use o ano do mês de referência da
  fatura (reference_month abaixo). Nunca retorne só "DD/MM" sem ano.
- category: categoria sugerida em português. ${categoriesBlock}

Retorne também:
- reference_month: mês de referência da fatura no formato YYYY-MM (ex: "2026-05")
- total_amount: valor total da fatura conforme impresso

Ignore linhas de pagamento, créditos, IOF, encargos, e retorne apenas as compras.
Retorne um JSON válido com todos os lançamentos encontrados.`;
}

export const monthlySummarySchema = {
  type: 'object',
  properties: {
    insights: { type: 'string', description: 'Resumo da situação financeira em 2-3 frases' },
    tips: { type: 'string', description: '3 dicas práticas de economia, uma por linha' },
  },
  required: ['insights', 'tips'],
};

export function monthlySummaryPrompt({ income, expense, balance, savingsRate, categorySpending }) {
  const categoryLines = Object.entries(categorySpending || {})
    .map(([cat, amount]) => `${cat}: R$ ${Number(amount).toFixed(2)}`)
    .join(', ');

  return `Você é um consultor financeiro. Analise os dados do mês do usuário e forneça insights e dicas de economia.
Receita do mês: R$ ${Number(income).toFixed(2)}.
Despesas do mês: R$ ${Number(expense).toFixed(2)}.
Saldo: R$ ${Number(balance).toFixed(2)}.
Taxa de poupança: ${Number(savingsRate).toFixed(1)}%.
Gastos por categoria: ${categoryLines || 'nenhum gasto categorizado'}.

Forneça:
1) Um resumo da situação financeira (2-3 frases)
2) 3 dicas práticas de economia personalizadas para este perfil de gastos

Seja objetivo e prático. Responda em português.`;
}

export function consultingChatPrompt({ contextBlock, question }) {
  return `Você é um consultor financeiro especialista. Analise os dados financeiros do usuário e responda à pergunta de forma prática e personalizada.

${contextBlock}

Pergunta do usuário: ${question}

Forneça conselhos específicos, práticos e baseados nos dados apresentados. Use um tom amigável e profissional.`;
}
