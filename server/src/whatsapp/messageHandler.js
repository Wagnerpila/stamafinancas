// Tratamento de mensagens recebidas, independente de transporte (Baileys direto em client.js ou
// Evolution API em evolution.js): cada transporte converte a mensagem crua no formato abaixo e
// chama handleIncomingMessage.
//
//   {
//     phoneVariants: string[]           // variantes do número do remetente (ver phone.js)
//     senderJid: string                 // JID cru do remetente (pode ser "...@lid")
//     debugId: string                   // identificação do remetente só pra log
//     text: string | null               // texto ou legenda
//     media: { kind: 'image'|'document'|'audio', mimetype } | null
//     downloadMedia: () => Promise<Buffer>
//     reply: (text) => Promise<void>
//   }

import { prisma } from '../lib/prisma.js';
import { requireAIProvider } from '../services/ai/index.js';
import { enforceTransactionLimit } from '../services/entityConfig.js';
import { reconcilePendingBill } from '../services/billReconciliation.js';
import { transactionExtractionSchema, receiptOcrPrompt } from '../services/ai/prompts.js';
import { isTranscriptionAvailable, transcribeAudio } from '../services/ai/transcribe.js';
import {
  HELP_TEXT,
  signed,
  applyCategoryRules,
  formatBRL,
  handleAssistantText,
  loadCategoryRules,
  rememberReceiptTransaction,
} from './assistant.js';
import { formatDateBR, todayStr } from './dates.js';
import { tryLinkFromMessage } from './linking.js';

async function findUser(phoneVariants, senderJid) {
  if (senderJid && String(senderJid).endsWith('@lid')) {
    const byLid = await prisma.user.findFirst({ where: { whatsapp_lid: senderJid } });
    if (byLid) return byLid;
  }

  const variants = new Set(phoneVariants);
  if (variants.size === 0) return null;

  const candidates = await prisma.user.findMany({
    where: { whatsapp_number: { not: null } },
  });
  return candidates.find((u) => variants.has(String(u.whatsapp_number).replace(/\D/g, ''))) || null;
}

const NOT_LINKED_TEXT =
  'Oi! 👋 Ainda não sei de quem é este WhatsApp.\n\n' +
  'Abra o app, vá em *Stama no WhatsApp*, informe seu número e me mande aqui o *código de 6 dígitos* que aparecer. Pronto, a gente começa! 🚀';

async function handleReceipt(user, incoming, provider) {
  const { media, reply } = incoming;
  if (media.kind === 'document' && media.mimetype !== 'application/pdf' && !media.mimetype.startsWith('image/')) {
    await reply('Por enquanto eu leio comprovantes em *foto* ou *PDF*. 📄');
    return;
  }

  try {
    await enforceTransactionLimit(user);
  } catch (err) {
    await reply(`⚠️ ${err.message}`);
    return;
  }

  await reply('📥 Recebi seu arquivo, analisando...');

  let buffer;
  try {
    buffer = await incoming.downloadMedia();
  } catch {
    await reply('❌ Não consegui baixar o arquivo enviado. Tenta mandar de novo?');
    return;
  }

  const categories = await prisma.transactionCategory.findMany({ where: { user_id: user.id, active: true } });
  const expenseCategories = categories.filter((c) => c.type === 'expense').map((c) => c.name);
  const incomeCategories = categories.filter((c) => c.type === 'income').map((c) => c.name);

  let output;
  try {
    output = await provider.generateStructured({
      prompt:
        receiptOcrPrompt({ expenseCategories, incomeCategories }) +
        `\nA data de hoje é ${todayStr()}.` +
        (incoming.text ? `\nO usuário escreveu junto com o arquivo: "${incoming.text}" — use como dica (ex: categoria, forma de pagamento).` : ''),
      schema: transactionExtractionSchema,
      files: [{ base64: buffer.toString('base64'), mimeType: media.mimetype }],
    });
  } catch (err) {
    await reply(`❌ Não consegui interpretar o arquivo: ${err.message}`);
    return;
  }

  const type = output.type === 'income' ? 'income' : 'expense';
  const description = output.description || 'Lançamento via WhatsApp';
  const rules = await loadCategoryRules(user.id);
  const category = applyCategoryRules(
    rules,
    description,
    type,
    output.category || (type === 'income' ? 'Outras Receitas' : 'Outras Despesas')
  );
  const dateStr = /^\d{4}-\d{2}-\d{2}/.test(output.date || '') ? output.date.slice(0, 10) : todayStr();

  // Se a foto/PDF corresponde a uma conta a pagar/receber pendente (mesmo título e valor),
  // marca essa conta como paga e linka a transação a ela — em vez de deixá-la "solta". Sem
  // isso a conta continua aparecendo como vencida no app (o sino de notificações insiste nela)
  // e, se o usuário depois usar "Marcar como Paga" pra fazer a notificação parar, uma SEGUNDA
  // transação é lançada pro mesmo pagamento, duplicando a despesa/receita.
  let linkedBillId = null;
  try {
    linkedBillId = await reconcilePendingBill({
      userId: user.id,
      description,
      amount: output.amount,
      type,
      dateStr,
    });
  } catch (err) {
    console.error('[whatsapp] Erro ao reconciliar com conta pendente:', err);
  }

  const transaction = await prisma.transaction.create({
    data: {
      description,
      amount: Math.abs(Number(output.amount) || 0),
      type,
      category,
      date: new Date(dateStr),
      payment_method: output.payment_method || 'cash',
      is_food_voucher: output.payment_method === 'food_voucher',
      notes: output.notes || 'Lançado automaticamente via bot do WhatsApp.',
      user_id: user.id,
      created_by: user.email,
      ...(linkedBillId ? { linked_bill_id: linkedBillId } : {}),
    },
  });
  rememberReceiptTransaction(user, transaction);

  const billNotice = linkedBillId
    ? `\n\n📌 Encontrei uma conta pendente com esse título e valor e já marquei ela como paga.`
    : '';

  await reply(
    signed(
      'bia',
      `✅ Lançamento registrado!\n\n` +
        `${type === 'income' ? '💰 Receita' : '💸 Despesa'}: *${transaction.description}*\n` +
        `Valor: *R$ ${formatBRL(transaction.amount)}*\n` +
        `Categoria: ${transaction.category}\n` +
        `Data: ${formatDateBR(dateStr)}` +
        billNotice +
        `\n\nAlgo errado? É só me dizer (ex: "na verdade foi 50" ou "isso é Mercado").`
    )
  );
}

export async function handleIncomingMessage(incoming) {
  const { reply } = incoming;
  const hasContent = incoming.text || incoming.media;
  if (!hasContent) return;

  const linked = await tryLinkFromMessage(incoming);
  if (linked) {
    await reply(
      signed('stama', `✅ Pronto, ${linked.full_name.split(' ')[0]}! Seu WhatsApp está vinculado à sua conta.\n\n` + HELP_TEXT)
    );
    return;
  }

  const user = await findUser(incoming.phoneVariants, incoming.senderJid);
  if (!user) {
    console.log('[whatsapp] Número não encontrado. remetente=%s variantes=%o', incoming.debugId, incoming.phoneVariants);
    await reply(signed('stama', NOT_LINKED_TEXT));
    return;
  }

  let provider;
  try {
    provider = requireAIProvider();
  } catch (err) {
    if (incoming.text && !incoming.media) await reply(signed('stama', HELP_TEXT));
    else await reply(`⚠️ ${err.message}`);
    return;
  }

  if (incoming.media && incoming.media.kind !== 'audio') {
    await handleReceipt(user, incoming, provider);
    return;
  }

  let text = incoming.text;
  if (incoming.media?.kind === 'audio') {
    if (!isTranscriptionAvailable()) {
      await reply('Ainda não consigo ouvir áudios por aqui — manda por texto, por favor. 🙏');
      return;
    }
    try {
      const buffer = await incoming.downloadMedia();
      text = await transcribeAudio(buffer, incoming.media.mimetype);
    } catch (err) {
      console.error('[whatsapp] Falha ao transcrever áudio:', err);
      await reply('❌ Não consegui entender o áudio. Pode mandar de novo ou escrever?');
      return;
    }
    if (!text) {
      await reply('Não consegui ouvir nada nesse áudio. 🤔 Pode repetir?');
      return;
    }
  }

  try {
    const answer = await handleAssistantText(user, text, provider);
    await reply(incoming.media?.kind === 'audio' ? `🎙️ _"${text}"_\n\n${answer}` : answer);
  } catch (err) {
    console.error('[whatsapp] Erro no assistente:', err);
    await reply(
      err.status === 403
        ? `⚠️ ${err.message}`
        : '❌ Tive um problema pra processar sua mensagem agora. Tenta de novo em instantes?'
    );
  }
}
