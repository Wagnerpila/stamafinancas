// Fachada do WhatsApp: escolhe o transporte pela variável WHATSAPP_PROVIDER.
//   baileys   (padrão) — conexão direta via WhatsApp Web dentro deste processo (client.js)
//   evolution          — Evolution API self-hosted, mensagens chegam por webhook (evolution.js)

import { getWhatsAppStatus, logoutWhatsApp, sendWhatsAppText, startWhatsApp } from './client.js';
import { bootEvolution, getEvolutionStatus, logoutEvolution, sendEvolutionText, startEvolution } from './evolution.js';

export function whatsappProvider() {
  return (process.env.WHATSAPP_PROVIDER || 'baileys').trim().toLowerCase() === 'evolution' ? 'evolution' : 'baileys';
}

export async function getStatus() {
  if (whatsappProvider() === 'evolution') return getEvolutionStatus();
  return { ...getWhatsAppStatus(), provider: 'baileys' };
}

export async function connect() {
  if (whatsappProvider() === 'evolution') return startEvolution();
  await startWhatsApp();
  return getStatus();
}

export async function logout() {
  if (whatsappProvider() === 'evolution') return logoutEvolution();
  await logoutWhatsApp();
  return getStatus();
}

export async function sendText(number, text) {
  if (whatsappProvider() === 'evolution') return sendEvolutionText(number, text);
  return sendWhatsAppText(number, text);
}

// Na inicialização do servidor: o Baileys reconecta sozinho se já houver sessão salva; na
// Evolution a sessão vive no servidor dela, então só garante instância + webhook apontando pra cá.
export async function bootWhatsApp() {
  if (whatsappProvider() === 'evolution') return bootEvolution();
  await startWhatsApp();
}
