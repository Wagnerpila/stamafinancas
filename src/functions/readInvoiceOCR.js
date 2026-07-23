import { api } from '@/api/apiClient';

// Callers use the base44 Deno-function invocation convention:
// `const res = await readInvoiceOCR({...}); const data = res.data?.data;`
export async function readInvoiceOCR(params) {
  const data = await api.post('/ai/invoice-ocr', params);
  return { data };
}
