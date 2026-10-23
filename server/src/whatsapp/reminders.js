// Envia pelo WhatsApp os lembretes de tarefas (Task.remind_at) na hora marcada. Roda a cada
// minuto; recorrentes já ganham o próximo horário logo após o aviso.

import { prisma } from '../lib/prisma.js';
import { getStatus, sendText } from './index.js';
import { nextOccurrence } from './tasks.js';

let timer = null;
let running = false;

async function runReminders() {
  const now = new Date();
  const due = await prisma.task.findMany({
    where: { status: { not: 'done' }, remind_at: { lte: now }, reminded_at: null },
    include: { user: true },
    take: 50,
  });
  if (!due.length) return;
  if ((await getStatus()).status !== 'connected') return;

  for (const task of due) {
    // Marca antes de enviar: se o envio falhar, não fica reenviando o mesmo lembrete a cada minuto.
    const recurring = task.recurrence && task.recurrence !== 'none';
    await prisma.task.update({
      where: { id: task.id },
      data: recurring ? { ...nextOccurrence(task), reminded_at: null } : { reminded_at: now },
    });
    if (!task.user?.whatsapp_number) continue;
    try {
      await sendText(
        task.user.whatsapp_number,
        `_Otto · agenda_\n⏰ *Lembrete:* ${task.title}${task.notes ? `\n\n${task.notes}` : ''}\n\nQuando fizer, me diga "feito" que eu dou baixa. ✅`
      );
    } catch (err) {
      console.error('[whatsapp/reminders] Falha ao enviar lembrete %s: %s', task.id, err.message);
    }
  }
}

export function startReminderScheduler() {
  if (timer) return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runReminders();
    } catch (err) {
      console.error('[whatsapp/reminders] Erro:', err.message);
    } finally {
      running = false;
    }
  }, 60 * 1000);
}
