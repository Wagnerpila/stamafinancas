import { api } from './apiClient';

// Replaces base44's UploadFile({file}) -> {file_url} contract.
export async function UploadFile({ file }) {
  const formData = new FormData();
  formData.append('file', file);
  return api.postForm('/upload', formData);
}

// --- AI features (server-side; API key never touches the browser) -----------------------
// Each function below maps 1:1 to an InvokeLLM/ExtractDataFromUploadedFile call site from the
// previous base44 implementation, but now hits a purpose-built backend endpoint with the
// prompt/schema controlled server-side (see server/src/services/ai/prompts.js).

export async function receiptOCR(fileUrl, categories) {
  return api.post('/ai/receipt-ocr', {
    file_url: fileUrl,
    expense_categories: categories?.expense,
    income_categories: categories?.income,
  });
}

export async function parseTransactionText(text, categories) {
  return api.post('/ai/parse-text', {
    text,
    expense_categories: categories?.expense,
    income_categories: categories?.income,
  });
}

export async function statementImport(fileUrl, categories) {
  return api.post('/ai/statement-import', {
    file_url: fileUrl,
    expense_categories: categories?.expense,
    income_categories: categories?.income,
  });
}

export async function invoiceOCR({ file_url, card_name, user_categories, existing_installments }) {
  return api.post('/ai/invoice-ocr', { file_url, card_name, user_categories, existing_installments });
}

export async function monthlySummaryAI(data) {
  return api.post('/ai/monthly-summary', data);
}

export async function consultingChatAI({ context, question }) {
  return api.post('/ai/consulting-chat', { context, question });
}
