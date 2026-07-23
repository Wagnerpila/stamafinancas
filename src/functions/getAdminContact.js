import { api } from '@/api/apiClient';

// Callers use the base44 Deno-function invocation convention: `const { data } = await getAdminContact()`.
export async function getAdminContact() {
  const data = await api.get('/admin-contact');
  return { data };
}
