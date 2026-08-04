import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { prisma } from '../lib/prisma.js';
import { requireAIProvider } from '../services/ai/index.js';
import { enforceTransactionLimit } from '../services/entityConfig.js';
import { reconcilePendingBill } from '../services/billReconciliation.js';
import { transactionExtractionSchema, receiptOcrPrompt } from '../services/ai/prompts.js';
import { phoneVariantsFromKey } from './phone.js';

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

async function findUserByKey(key) {
  const variants = new Set(phoneVariantsFromKey(key));
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

  const user = await findUserByKey(msg.key);
  if (!user) {
    console.log(
      '[whatsapp] Número não encontrado. remoteJid=%s remoteJidAlt=%s participantAlt=%s variantes=%o',
      msg.key?.remoteJid,
      msg.key?.remoteJidAlt,
      msg.key?.participantAlt,
      phoneVariantsFromKey(msg.key)
    );
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

  // Se a foto/PDF corresponde a uma conta a pagar/receber pendente (mesmo título e valor),
  // marca essa conta como paga e linka a transação a ela — em vez de deixá-la "solta". Sem
  // isso a conta continua aparecendo como vencida no app (o sino de notificações insiste nela)
  // e, se o usuário depois usar "Marcar como Paga" pra fazer a notificação parar, uma SEGUNDA
  // transação é lançada pro mesmo pagamento, duplicando a despesa/receita.
  let linkedBillId = null;
  try {
    linkedBillId = await reconcilePendingBill({
      userId: user.id,
      description: output.description,
      amount: output.amount,
      type,
      dateStr,
    });
  } catch (err) {
    console.error('[whatsapp] Erro ao reconciliar com conta pendente:', err);
  }

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
      ...(linkedBillId ? { linked_bill_id: linkedBillId } : {}),
    },
  });

  const billNotice = linkedBillId
    ? `\n\n📌 Encontrei uma conta pendente com esse título e valor e já marquei ela como paga.`
    : '';

  await reply(
    `✅ Lançamento registrado!\n\n` +
      `${type === 'income' ? '💰 Receita' : '💸 Despesa'}: *${transaction.description}*\n` +
      `Valor: *R$ ${formatBRL(transaction.amount)}*\n` +
      `Categoria: ${transaction.category}\n` +
      `Data: ${formatDateBR(transaction.date.toISOString())}` +
      billNotice +
      `\n\nSe algo estiver errado, você pode editar ou apagar direto no app.`
  );
}
