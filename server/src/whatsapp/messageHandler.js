import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { prisma } from '../lib/prisma.js';
import { requireAIProvider } from '../services/ai/index.js';
import { enforceTransactionLimit } from '../services/entityConfig.js';
import { transactionExtractionSchema, receiptOcrPrompt } from '../services/ai/prompts.js';
import { jidToPhoneVariants } from './phone.js';

const HELP_TEXT =
  'Olá! Manda uma *foto* ou *PDF* de um comprovante, recibo ou fatura que eu leio e lanço a transação pra você. 📸\n\n' +
  'Pra isso funcionar, seu número de WhatsApp precisa estar cadastrado em *Configurações > Alertas por WhatsApp* no app.';

function formatBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBR(isoDate) {
  const d = new Date(String(isoDate).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('pt-BR');
}

async function findUserByJid(remoteJid) {
  const variants = new Set(jidToPhoneVariants(remoteJid));
  if (variants.size === 0) return null;

  const candidates = await prisma.user.findMany({
    where: { whatsapp_number: { not: null } },
  });
  return candidates.find((u) => variants.has(String(u.whatsapp_number).replace(/\D/g, ''))) || null;
}

function extractMedia(msg) {
  const content = msg.message || {};
  if (content.imageMessage) {
    return { message: content, type: 'imageMessage', mimetype: content.imageMessage.mimetype || 'image/jpeg' };
  }
  if (content.documentMessage) {
    const mimetype = content.documentMessage.mimetype || 'application/octet-stream';
    if (mimetype === 'application/pdf' || mimetype.startsWith('image/')) {
      return { message: content, type: 'documentMessage', mimetype };
    }
  }
  return null;
}

function extractText(msg) {
  const content = msg.message || {};
  return content.conversation || content.extendedTextMessage?.text || null;
}

export async function handleIncomingMessage(sock, msg) {
  const remoteJid = msg.key?.remoteJid;
  if (!remoteJid || msg.key?.fromMe) return;
  if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) return;

  const reply = (text) => sock.sendMessage(remoteJid, { text });

  const media = extractMedia(msg);
  if (!media) {
    if (extractText(msg)) await reply(HELP_TEXT);
    return;
  }

  const user = await findUserByJid(remoteJid);
  if (!user) {
    await reply(
      'Não encontrei nenhuma conta cadastrada com este número de WhatsApp. ' +
        'Acesse *Configurações > Alertas por WhatsApp* no app e cadastre este número primeiro.'
    );
    return;
  }

  try {
    await enforceTransactionLimit(user);
  } catch (err) {
    await reply(`⚠️ ${err.message}`);
    return;
  }

  let provider;
  try {
    provider = requireAIProvider();
  } catch (err) {
    await reply(`⚠️ ${err.message}`);
    return;
  }

  await reply('📥 Recebi seu arquivo, analisando...');

  let buffer;
  try {
    buffer = await downloadMediaMessage(msg, 'buffer', {});
  } catch (err) {
    await reply('❌ Não consegui baixar o arquivo enviado. Tenta mandar de novo?');
    return;
  }

  let output;
  try {
    output = await provider.generateStructured({
      prompt: receiptOcrPrompt(),
      schema: transactionExtractionSchema,
      files: [{ base64: buffer.toString('base64'), mimeType: media.mimetype }],
    });
  } catch (err) {
    await reply(`❌ Não consegui interpretar o arquivo: ${err.message}`);
    return;
  }

  const type = output.type === 'income' ? 'income' : 'expense';
  const category = output.category || (type === 'income' ? 'Outras Receitas' : 'Outras Despesas');
  const dateStr = /^\d{4}-\d{2}-\d{2}/.test(output.date || '') ? output.date : new Date().toISOString();

  const transaction = await prisma.transaction.create({
    data: {
      description: output.description || 'Lançamento via WhatsApp',
      amount: Math.abs(Number(output.amount) || 0),
      type,
      category,
      date: new Date(dateStr),
      payment_method: output.payment_method || 'cash',
      notes: output.notes || 'Lançado automaticamente via bot do WhatsApp.',
      user_id: user.id,
      created_by: user.email,
    },
  });

  await reply(
    `✅ Lançamento registrado!\n\n` +
      `${type === 'income' ? '💰 Receita' : '💸 Despesa'}: *${transaction.description}*\n` +
      `Valor: *R$ ${formatBRL(transaction.amount)}*\n` +
      `Categoria: ${transaction.category}\n` +
      `Data: ${formatDateBR(transaction.date.toISOString())}\n\n` +
      `Se algo estiver errado, você pode editar ou apagar direto no app.`
  );
}
