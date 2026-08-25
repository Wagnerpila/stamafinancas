import { createEntityClient } from './entityClient';
import { api, getToken, setToken } from './apiClient';

export const Transaction = createEntityClient('Transaction');
export const TransactionCategory = createEntityClient('TransactionCategory');
export const CreditCard = createEntityClient('CreditCard');
export const CreditCardInvoice = createEntityClient('CreditCardInvoice');
export const CreditCardTransaction = createEntityClient('CreditCardTransaction');
export const Bill = createEntityClient('Bill');
export const Crediario = createEntityClient('Crediario');
export const Goal = createEntityClient('Goal');
export const CategoryBudget = createEntityClient('CategoryBudget');
export const SpendingSummary = createEntityClient('SpendingSummary');
export const AIConsultation = createEntityClient('AIConsultation');
export const NotificationSettings = createEntityClient('NotificationSettings');
export const SharedFinancialData = createEntityClient('SharedFinancialData');
export const ConnectionRequest = createEntityClient('ConnectionRequest');
export const ChatMessage = createEntityClient('ChatMessage');

// SubscriptionPlan is an admin-managed catalog (not user-owned), so it lives at its own
// base path server-side; exposed here with the same list/filter/create/update/delete shape.
export const SubscriptionPlan = {
  list: () => api.get('/subscription-plans'),
  filter: async (query = {}) => {
    const all = await api.get('/subscription-plans');
    return all.filter((row) => Object.entries(query).every(([key, value]) => row[key] === value));
  },
  create: (data) => api.post('/subscription-plans', data),
  update: (id, data) => api.patch(`/subscription-plans/${id}`, data),
  delete: (id) => api.delete(`/subscription-plans/${id}`),
};

// Mirrors the base44 `base44.auth` / built-in `User` entity surface used throughout the app.
export const User = {
  me: () => api.get('/auth/me'),
  updateMyUserData: (data) => api.patch('/auth/me', data),
  updateMe: (data) => api.patch('/auth/me', data),
  isAuthenticated: () => Boolean(getToken()),
  login: async (email, password) => {
    const { token, user } = await api.post('/auth/login', { email, password });
    setToken(token);
    return user;
  },
  register: async ({ email, password, full_name }) => {
    const { token, user } = await api.post('/auth/register', { email, password, full_name });
    setToken(token);
    return user;
  },
  logout: () => {
    setToken(null);
  },
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  deleteMyAccount: async () => {
    await api.delete('/auth/me');
    setToken(null);
  },
  // Admin-only
  list: () => api.get('/users'),
  update: (id, data) => api.patch(`/users/${id}`, data),
  // Apaga todos os lançamentos financeiros do próprio admin autenticado (fase de desenvolvimento
  // — "recomeçar do zero"). Mantém a conta, categorias e preferências de notificação.
  wipeMyData: () => api.post('/users/me/wipe-data'),
};
