// Tarefas e lembretes usados pelo bot (criar/listar/concluir) e pelo agendador de avisos.

import { prisma } from '../lib/prisma.js';
import { normalizeText } from './finance.js';
import { addDays, formatDateTimeBR, formatShortBR, fromLocalDateTime, isDateStr, localDateOf, toDbDate, todayStr } from './dates.js';

export const TASK_RECURRENCE_LABELS = { none: '', daily: 'todo dia', weekly: 'toda semana', monthly: 'todo mês' };
const PRIORITY_ICON = { high: '🔴', medium: '🟡', low: '⚪' };
const DAY_MS = 86400000;

// Próxima ocorrência de uma tarefa recorrente: avança prazo e lembrete juntos.
export function nextOccurrence(task) {
  const step = (date) => {
    if (!date) return null;
    const d = new Date(date);
    if (task.recurrence === 'daily') return new Date(d.getTime() + DAY_MS);
    if (task.recurrence === 'weekly') return new Date(d.getTime() + 7 * DAY_MS);
    if (task.recurrence === 'monthly') {
      const next = new Date(d);
      next.setUTCMonth(d.getUTCMonth() + 1);
      return next;
    }
    return d;
  };
  return { due_date: step(task.due_date), remind_at: step(task.remind_at) };
}

export async function createTask(user, raw) {
  const title = String(raw?.title || '').trim();
  if (!title) return { error: 'Me diga o que é a tarefa. Ex: "me lembra de ligar pro contador amanhã às 10h".' };
  const remindAt = fromLocalDateTime(raw.remind_at);
  const due = isDateStr(raw.due_date) ? raw.due_date : remindAt ? localDateOf(remindAt) : null;
  const recurrence = TASK_RECURRENCE_LABELS[raw.recurrence] !== undefined ? raw.recurrence : 'none';

  const task = await prisma.task.create({
    data: {
      user_id: user.id,
      created_by: user.email,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      due_date: due ? toDbDate(due) : null,
      remind_at: remindAt,
      priority: ['low', 'medium', 'high'].includes(raw.priority) ? raw.priority : 'medium',
      recurrence,
    },
  });
  return { task };
}

export function describeTask(task) {
  const parts = [];
  if (task.remind_at) parts.push(`⏰ ${formatDateTimeBR(task.remind_at)}`);
  else if (task.due_date) parts.push(`📅 ${formatShortBR(new Date(task.due_date).toISOString().slice(0, 10))}`);
  if (task.recurrence && task.recurrence !== 'none') parts.push(`🔁 ${TASK_RECURRENCE_LABELS[task.recurrence]}`);
  return `${PRIORITY_ICON[task.priority] || '🟡'} *${task.title}*${parts.length ? ` — ${parts.join(' · ')}` : ''}`;
}

export async function openTasks(userId) {
  return prisma.task.findMany({
    where: { user_id: userId, status: { not: 'done' } },
    orderBy: [{ due_date: 'asc' }, { created_date: 'asc' }],
  });
}

export function taskDay(task) {
  if (task.remind_at) return localDateOf(task.remind_at);
  if (task.due_date) return new Date(task.due_date).toISOString().slice(0, 10);
  return null;
}

export async function listTasksMessage(userId, scope = 'all') {
  const today = todayStr();
  const tasks = await openTasks(userId);
  const limit = scope === 'today' ? today : scope === 'week' ? addDays(today, 7) : null;
  const overdue = tasks.filter((t) => taskDay(t) && taskDay(t) < today);
  const upcoming = tasks.filter((t) => {
    const day = taskDay(t);
    if (day && day < today) return false;
    if (!limit) return true;
    return day && day <= limit;
  });
  if (!overdue.length && !upcoming.length) {
    return scope === 'today' ? 'Nada pendente pra hoje! 🎉' : 'Você não tem tarefas abertas. 🎉';
  }
  const title = scope === 'today' ? 'Pra hoje' : scope === 'week' ? 'Próximos 7 dias' : 'Suas tarefas';
  return (
    `📋 *${title}*\n\n` +
    (overdue.length ? `⚠️ *Atrasadas*\n${overdue.map(describeTask).join('\n')}\n\n` : '') +
    upcoming.map(describeTask).join('\n') +
    '\n\nQuando terminar, me diga ("já liguei pro contador") que eu dou baixa.'
  ).replace(/\n{3,}/g, '\n\n');
}

// Concluir uma recorrente reabre a próxima ocorrência em vez de fechar de vez.
export async function completeTask(task) {
  if (task.recurrence && task.recurrence !== 'none') {
    const next = nextOccurrence(task);
    await prisma.task.update({ where: { id: task.id }, data: { ...next, reminded_at: null, status: 'pending' } });
    return { task, recurring: true, next };
  }
  await prisma.task.update({ where: { id: task.id }, data: { status: 'done', completed_at: new Date() } });
  return { task, recurring: false };
}

export async function completeTaskByTitle(userId, title) {
  const tasks = await openTasks(userId);
  const wanted = normalizeText(title);
  if (!wanted) return null;
  const task =
    tasks.find((t) => normalizeText(t.title) === wanted) ||
    tasks.find((t) => normalizeText(t.title).includes(wanted) || wanted.includes(normalizeText(t.title)));
  return task ? completeTask(task) : null;
}
