// Avisos proativos do Stama pelo WhatsApp, respeitando as preferências de
// NotificationSettings (página Configurações > Notificações):
//   - todo dia, a partir de WHATSAPP_DIGEST_HOUR (padrão 8h, horário de Brasília): contas que
//     vencem nos próximos `bills_due_days` dias, as atrasadas (se `overdue_reminders`) e as
//     tarefas do dia;
//   - toda segunda-feira, se `weekly_summary`: resumo dos gastos da semana anterior.
// whatsapp_last_digest/whatsapp_last_weekly guardam a data do último envio, então um restart do
// servidor não repete o aviso no mesmo dia.

import { prisma } from '../lib/prisma.js';
import { billsForMonth, overdueBillsBefore, periodSummary } from './finance.js';
import { addDays, currentHour, formatShortBR, todayStr, weekdayOf } from './dates.js';
import { formatBRL } from './assistant.js';
import { getStatus, sendText } from './index.js';
import { describeTask, openTasks, taskDay } from './tasks.js';

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

async function billsMessage(user, settings, today) {
  const horizon = addDays(today, settings.bills_due_days ?? 3);
  const months = new Set([today.slice(0, 7), horizon.slice(0, 7)]);
  const bills = [];
  for (const m of months) bills.push(...(await billsForMonth(user.id, m + '-01')));
  if (settings.overdue_reminders) bills.push(...(await overdueBillsBefore(user.id, today)));

  const pending = bills.filter((b) => !b.paid);
  const dueSoon = pending.filter((b) => b.due >= today && b.due <= horizon);
  const overdue = settings.overdue_reminders ? pending.filter((b) => b.due < today) : [];
  const tasksToday = (await openTasks(user.id)).filter((t) => taskDay(t) && taskDay(t) <= today);
  if (!dueSoon.length && !overdue.length && !tasksToday.length) return null;

  const line = (b) =>
    `${b.type === 'receivable' ? '🟢' : '🔴'} ${b.due === today ? '*hoje*' : formatShortBR(b.due)} · ${b.title} — R$ ${formatBRL(b.amount)}`;

  return (
    `☀️ Bom dia, ${user.full_name.split(' ')[0]}! Aqui é o Stama, com o resumo do dia.\n` +
    (overdue.length ? `\n⚠️ *Atrasadas*\n${overdue.map(line).join('\n')}\n` : '') +
    (dueSoon.length ? `\n🗓️ *Vencendo nos próximos dias*\n${dueSoon.map(line).join('\n')}\n` : '') +
    (tasksToday.length ? `\n📋 *Tarefas de hoje*\n${tasksToday.map(describeTask).join('\n')}\n` : '') +
    '\nQuando pagar ou concluir algo, me avisa ("paguei o aluguel", "feito") que eu dou baixa. 😉'
  );
}

async function weeklyMessage(user, today) {
  const start = addDays(today, -7);
  const end = addDays(today, -1);
  const s = await periodSummary(user.id, start, end);
  if (!s.expense && !s.income) return null;
  const top = s.byCategory.slice(0, 3).map((c) => `• ${c.name}: R$ ${formatBRL(c.total)}`).join('\n');
  return (
    `_Bia · finanças_\n📊 *Sua semana (${formatShortBR(start)} a ${formatShortBR(end)})*\n\n` +
    `🟢 Entradas: R$ ${formatBRL(s.income)}\n🔴 Saídas: R$ ${formatBRL(s.expense)}` +
    (top ? `\n\n*Onde mais gastou:*\n${top}` : '') +
    '\n\nQuer o detalhe? Pergunte "gastos por categoria da semana passada".'
  );
}

async function runDigest() {
  const today = todayStr();
  if (currentHour() < Number(process.env.WHATSAPP_DIGEST_HOUR || 8)) return;
  if ((await getStatus()).status !== 'connected') return;

  const users = await prisma.user.findMany({
    where: { whatsapp_number: { not: null }, notificationSettings: { is: { enabled: true } } },
    include: { notificationSettings: true },
  });

  for (const user of users) {
    const settings = user.notificationSettings;
    if (!String(user.whatsapp_number || '').replace(/\D/g, '')) continue;

    if (settings.whatsapp_last_digest !== today) {
      await prisma.notificationSettings.update({ where: { id: settings.id }, data: { whatsapp_last_digest: today } });
      try {
        const msg = await billsMessage(user, settings, today);
        if (msg) await sendText(user.whatsapp_number, msg);
      } catch (err) {
        console.error('[whatsapp/digest] Falha no aviso de contas para %s: %s', user.email, err.message);
      }
    }

    if (settings.weekly_summary && weekdayOf(today) === 1 && settings.whatsapp_last_weekly !== today) {
      await prisma.notificationSettings.update({ where: { id: settings.id }, data: { whatsapp_last_weekly: today } });
      try {
        const msg = await weeklyMessage(user, today);
        if (msg) await sendText(user.whatsapp_number, msg);
      } catch (err) {
        console.error('[whatsapp/digest] Falha no resumo semanal para %s: %s', user.email, err.message);
      }
    }
  }
}

let timer = null;
let running = false;

export function startDigestScheduler() {
  if (timer || process.env.WHATSAPP_DIGEST_DISABLED === 'true') return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runDigest();
    } catch (err) {
      console.error('[whatsapp/digest] Erro:', err.message);
    } finally {
      running = false;
    }
  };
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  setTimeout(tick, 30 * 1000);
}
