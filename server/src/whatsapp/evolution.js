// Transporte via Evolution API (https://doc.evolution-api.com) — servidor gratuito e self-hosted
// que mantém a sessão do WhatsApp e avisa este backend por webhook. Ativado com
// WHATSAPP_PROVIDER=evolution; o pareamento continua sendo pelo QR Code no Painel Admin.
//
// Variáveis:
//   EVOLUTION_API_URL       ex: http://localhost:8080
//   EVOLUTION_API_KEY       a AUTHENTICATION_API_KEY configurada na Evolution
//   EVOLUTION_INSTANCE      nome da instância (criada automaticamente se não existir)
//   EVOLUTION_WEBHOOK_URL   URL deste backend vista pela Evolution, ex:
//                           http://host.docker.internal:3001/api/whatsapp/webhook
//   WHATSAPP_WEBHOOK_TOKEN  segredo anexado à URL do webhook (?token=...) e conferido ao receber

import crypto from 'node:crypto';
import { handleIncomingMessage } from './messageHandler.js';
import { jidToPhoneVariants, phoneVariants } from './phone.js';

function config() {
  return {
    url: String(process.env.EVOLUTION_API_URL || '').replace(/\/+$/, ''),
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || 'financas',
    webhookUrl: process.env.EVOLUTION_WEBHOOK_URL || '',
    token: process.env.WHATSAPP_WEBHOOK_TOKEN || '',
  };
}

async function api(method, path, body) {
  const { url, apiKey } = config();
  if (!url || !apiKey) {
    const err = new Error('Evolution API não configurada: defina EVOLUTION_API_URL e EVOLUTION_API_KEY em server/.env.');
    err.status = 503;
    throw err;
  }
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { 'content-type': 'application/json', apikey: apiKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const err = new Error(`Evolution API ${method} ${path} falhou (${response.status}): ${String(text).slice(0, 300)}`);
    err.status = response.status === 404 ? 404 : 502;
    err.data = data;
    throw err;
  }
  return data;
}

function webhookTarget() {
  const { webhookUrl, token } = config();
  if (!webhookUrl) return null;
  if (!token) return webhookUrl;
  return `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];

async function ensureInstance() {
  const { instance } = config();
  try {
    await api('GET', `/instance/connectionState/${instance}`);
    return false;
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  const target = webhookTarget();
  await api('POST', '/instance/create', {
    instanceName: instance,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    ...(target ? { webhook: { url: target, byEvents: false, base64: true, events: WEBHOOK_EVENTS } } : {}),
  });
  return true;
}

async function ensureWebhook() {
  const target = webhookTarget();
  if (!target) return;
  const { instance } = config();
  await api('POST', `/webhook/set/${instance}`, {
    webhook: { enabled: true, url: target, webhookByEvents: false, webhookBase64: true, events: WEBHOOK_EVENTS },
  });
}

let lastQr = null;

export async function getEvolutionStatus() {
  const { instance } = config();
  try {
    const data = await api('GET', `/instance/connectionState/${instance}`);
    const state = data?.instance?.state || data?.state;
    if (state === 'open') {
      lastQr = null;
      let phoneNumber = null;
      try {
        const list = await api('GET', `/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`);
        const info = Array.isArray(list) ? list.find((i) => (i?.name || i?.instanceName || i?.instance?.instanceName) === instance) || list[0] : list;
        // O campo do dono muda entre versões da Evolution (ownerJid na v2, instance.owner na v1).
        const owner = info?.ownerJid || info?.owner || info?.instance?.owner || info?.instance?.ownerJid || info?.number;
        phoneNumber = owner ? String(owner).split('@')[0].split(':')[0].replace(/\D/g, '') || null : null;
      } catch (err) {
        console.error('[whatsapp/evolution] Não consegui ler o número da instância:', err.message);
      }
      return { status: 'connected', qrDataUrl: null, phoneNumber: phoneNumber || process.env.WHATSAPP_BOT_NUMBER || null, provider: 'evolution' };
    }
    if (state === 'connecting' && lastQr) return { status: 'qr', qrDataUrl: lastQr, phoneNumber: null, provider: 'evolution' };
    return { status: state === 'connecting' ? 'connecting' : 'disconnected', qrDataUrl: null, phoneNumber: null, provider: 'evolution' };
  } catch (err) {
    if (err.status === 404) return { status: 'disconnected', qrDataUrl: null, phoneNumber: null, provider: 'evolution' };
    return { status: 'disconnected', qrDataUrl: null, phoneNumber: null, provider: 'evolution', error: err.message };
  }
}

// Na subida do servidor: garante que a instância existe e que o webhook aponta pra cá — sem isso,
// uma instância já conectada direto pelo painel da Evolution nunca mandaria as mensagens pro app
// (o botão "Conectar" do Painel Admin, que também registra o webhook, só aparece desconectado).
export async function bootEvolution() {
  const { url, apiKey, instance, webhookUrl } = config();
  if (!url || !apiKey) {
    console.warn('[whatsapp/evolution] EVOLUTION_API_URL/EVOLUTION_API_KEY não definidas — bot desligado.');
    return;
  }
  if (!webhookUrl) console.warn('[whatsapp/evolution] EVOLUTION_WEBHOOK_URL não definida — o app não vai receber as mensagens.');
  await ensureInstance();
  await ensureWebhook();
  const status = await getEvolutionStatus();
  console.log('[whatsapp/evolution] Instância "%s": %s%s', instance, status.status, status.phoneNumber ? ` (${status.phoneNumber})` : '');
}

export async function startEvolution() {
  const { instance } = config();
  await ensureInstance();
  await ensureWebhook();
  const data = await api('GET', `/instance/connect/${instance}`);
  const base64 = data?.base64 || data?.qrcode?.base64 || null;
  if (base64) lastQr = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  const status = await getEvolutionStatus();
  return status.status === 'connected' ? status : { ...status, status: lastQr ? 'qr' : status.status, qrDataUrl: lastQr };
}

export async function logoutEvolution() {
  const { instance } = config();
  lastQr = null;
  try {
    await api('DELETE', `/instance/logout/${instance}`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  return getEvolutionStatus();
}

export async function sendEvolutionText(number, text) {
  const { instance } = config();
  const digits = phoneVariants(number).find((v) => v.startsWith('55')) || String(number).replace(/\D/g, '');
  await api('POST', `/message/sendText/${instance}`, { number: digits, text });
}

async function sendToJid(jid, text) {
  const { instance } = config();
  await api('POST', `/message/sendText/${instance}`, { number: jid.endsWith('@s.whatsapp.net') ? jid.split('@')[0] : jid, text });
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function verifyWebhook(req) {
  const { token } = config();
  if (!token) return true;
  return safeEqual(req.query.token || req.get('x-webhook-token') || '', token);
}

// Converte o evento "messages.upsert" da Evolution no formato neutro de messageHandler.js.
function toIncoming(data) {
  const key = data?.key || {};
  const remoteJid = key.remoteJid;
  if (!remoteJid || key.fromMe) return null;
  if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) return null;

  const content = data.message || {};
  let media = null;
  if (content.imageMessage) media = { kind: 'image', mimetype: content.imageMessage.mimetype || 'image/jpeg' };
  else if (content.audioMessage) media = { kind: 'audio', mimetype: content.audioMessage.mimetype || 'audio/ogg' };
  else if (content.documentMessage || content.documentWithCaptionMessage) {
    const doc = content.documentMessage || content.documentWithCaptionMessage?.message?.documentMessage || {};
    media = { kind: 'document', mimetype: doc.mimetype || 'application/octet-stream' };
  }

  const variants = new Set();
  for (const jid of [remoteJid, key.remoteJidAlt, key.senderPn, data.sender]) {
    if (!jid || String(jid).endsWith('@lid') || String(jid).endsWith('@g.us')) continue;
    for (const v of jidToPhoneVariants(jid)) variants.add(v);
  }

  const replyJid = key.remoteJidAlt && !String(key.remoteJidAlt).endsWith('@lid') ? key.remoteJidAlt : remoteJid;

  return {
    phoneVariants: [...variants],
    senderJid: remoteJid,
    debugId: `${remoteJid} alt=${key.remoteJidAlt || key.senderPn || '-'}`,
    text:
      content.conversation ||
      content.extendedTextMessage?.text ||
      content.imageMessage?.caption ||
      content.documentMessage?.caption ||
      content.documentWithCaptionMessage?.message?.documentMessage?.caption ||
      null,
    media,
    downloadMedia: async () => {
      if (content.base64) return Buffer.from(content.base64, 'base64');
      const { instance } = config();
      const res = await api('POST', `/chat/getBase64FromMediaMessage/${instance}`, {
        message: { key: { id: key.id } },
        convertToMp4: false,
      });
      if (!res?.base64) throw new Error('Mídia indisponível na Evolution API.');
      return Buffer.from(res.base64, 'base64');
    },
    reply: (text) => sendToJid(replyJid, text),
  };
}

export async function handleEvolutionWebhook(body) {
  const event = String(body?.event || '').toLowerCase().replace(/_/g, '.');
  if (event === 'connection.update') {
    if (body?.data?.state === 'open') lastQr = null;
    return;
  }
  if (event === 'qrcode.updated') {
    const base64 = body?.data?.qrcode?.base64;
    if (base64) lastQr = base64;
    return;
  }
  if (event !== 'messages.upsert') return;

  const messages = Array.isArray(body.data) ? body.data : [body.data];
  for (const data of messages) {
    const incoming = toIncoming(data);
    if (!incoming) continue;
    try {
      await handleIncomingMessage(incoming);
    } catch (err) {
      console.error('[whatsapp/evolution] Erro ao processar mensagem:', err);
    }
  }
}
