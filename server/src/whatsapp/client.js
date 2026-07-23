import fs from 'node:fs/promises';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { pino } from 'pino';
import QRCode from 'qrcode';
import { WHATSAPP_SESSION_DIR } from './session.js';
import { handleIncomingMessage } from './messageHandler.js';

const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL || 'silent' });

const state_ = {
  sock: null,
  status: 'disconnected', // disconnected | connecting | qr | connected
  qrDataUrl: null,
  phoneNumber: null,
  starting: false,
};

export function getWhatsAppStatus() {
  return { status: state_.status, qrDataUrl: state_.qrDataUrl, phoneNumber: state_.phoneNumber };
}

export async function startWhatsApp() {
  if (state_.starting || state_.sock) return;
  state_.starting = true;
  state_.status = 'connecting';

  try {
    const { state, saveCreds } = await useMultiFileAuthState(WHATSAPP_SESSION_DIR);

    const sock = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: false,
    });
    state_.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        state_.status = 'qr';
        try {
          state_.qrDataUrl = await QRCode.toDataURL(qr);
        } catch (err) {
          logger.error({ err }, 'Falha ao gerar imagem do QR code do WhatsApp.');
        }
      }

      if (connection === 'open') {
        state_.status = 'connected';
        state_.qrDataUrl = null;
        state_.phoneNumber = sock.user?.id?.split(':')[0]?.split('@')[0] || null;
        console.log('[whatsapp] Conectado como', state_.phoneNumber);
      }

      if (connection === 'close') {
        state_.sock = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        state_.status = 'disconnected';
        state_.qrDataUrl = null;
        state_.phoneNumber = null;
        console.log('[whatsapp] Conexão encerrada.', loggedOut ? '(logout)' : '(reconectando...)');
        if (!loggedOut) {
          state_.starting = false;
          startWhatsApp();
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        try {
          await handleIncomingMessage(sock, msg);
        } catch (err) {
          logger.error({ err }, 'Erro ao processar mensagem do WhatsApp.');
        }
      }
    });
  } finally {
    state_.starting = false;
  }
}

export async function logoutWhatsApp() {
  if (state_.sock) {
    try {
      await state_.sock.logout();
    } catch {
      // ignore — we're tearing the session down either way
    }
  }
  state_.sock = null;
  state_.status = 'disconnected';
  state_.qrDataUrl = null;
  state_.phoneNumber = null;

  // Stale creds would make Baileys reconnect with an already-logged-out session and loop
  // forever without ever issuing a fresh QR, so wipe them to force a clean pairing next time.
  await fs.rm(WHATSAPP_SESSION_DIR, { recursive: true, force: true });
}
