// Memória curta da conversa de cada usuário com o bot, só em memória: as últimas mensagens (pra
// IA entender "na verdade foi 50"), o último registro criado (alvo de correções e "apaga esse") e
// uma ação aguardando confirmação/escolha. Some sozinha após um tempo sem conversa — e num
// restart do servidor, o que no pior caso só faz o bot perguntar de novo.

const TTL_MS = 30 * 60 * 1000;
const MAX_HISTORY = 8;

const conversations = new Map();

function get(userId) {
  const now = Date.now();
  let conv = conversations.get(userId);
  if (!conv || now - conv.touchedAt > TTL_MS) {
    conv = { history: [], lastAction: null, pending: null, touchedAt: now };
    conversations.set(userId, conv);
  }
  conv.touchedAt = now;
  return conv;
}

export function getConversation(userId) {
  return get(userId);
}

export function remember(userId, role, text) {
  const conv = get(userId);
  conv.history.push({ role, text: String(text || '').slice(0, 600) });
  if (conv.history.length > MAX_HISTORY) conv.history.splice(0, conv.history.length - MAX_HISTORY);
}

export function setLastAction(userId, action) {
  get(userId).lastAction = action;
}

export function setPending(userId, pending) {
  get(userId).pending = pending;
}

export function takePending(userId) {
  const conv = get(userId);
  const pending = conv.pending;
  conv.pending = null;
  return pending;
}
