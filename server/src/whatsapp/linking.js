// Vínculo do WhatsApp do usuário com a conta: o app gera um código de 6 dígitos (válido por 30
// min) e mostra o número do bot; o usuário manda o código pro bot, e o bot grava quem mandou —
// o número real e, quando o WhatsApp esconde o número ("...@lid"), o identificador anônimo, que
// passa a ser usado pra reconhecer a pessoa nas próximas mensagens.

import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';

const CODE_TTL_MS = 30 * 60 * 1000;
const CODE_IN_MESSAGE = /(?:^|\D)(\d{6})(?:\D|$)/;

export async function generateLinkCode(user, number) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const digits = String(number || user.whatsapp_number || '').replace(/\D/g, '');
  return prisma.user.update({
    where: { id: user.id },
    data: {
      whatsapp_link_code: code,
      whatsapp_link_expires: new Date(Date.now() + CODE_TTL_MS),
      ...(digits && digits !== String(user.whatsapp_number || '').replace(/\D/g, '')
        ? { whatsapp_number: digits, whatsapp_verified_at: null, whatsapp_lid: null }
        : {}),
    },
  });
}

// Se a mensagem traz um código de vínculo válido, vincula o remetente e devolve o usuário.
export async function tryLinkFromMessage(incoming) {
  const text = String(incoming.text || '');
  if (!text || text.length > 60) return null;
  const match = text.match(CODE_IN_MESSAGE);
  if (!match) return null;

  const user = await prisma.user.findFirst({
    where: { whatsapp_link_code: match[1], whatsapp_link_expires: { gt: new Date() } },
  });
  if (!user) return null;

  const lid = incoming.senderJid && String(incoming.senderJid).endsWith('@lid') ? incoming.senderJid : null;
  const phone = incoming.phoneVariants.find((v) => v.startsWith('55') && v.length >= 12) || incoming.phoneVariants[0] || null;

  // O mesmo WhatsApp não pode ficar ligado a duas contas.
  if (lid) {
    await prisma.user.updateMany({ where: { whatsapp_lid: lid, id: { not: user.id } }, data: { whatsapp_lid: null, whatsapp_verified_at: null } });
  }

  return prisma.user.update({
    where: { id: user.id },
    data: {
      whatsapp_number: phone || user.whatsapp_number,
      whatsapp_lid: lid || user.whatsapp_lid,
      whatsapp_verified_at: new Date(),
      whatsapp_link_code: null,
      whatsapp_link_expires: null,
    },
  });
}
