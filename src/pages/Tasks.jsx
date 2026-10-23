import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Check, Trash2, Play, Bell, Repeat, Loader2 } from "lucide-react";
import { Task, User } from "@/api/entities";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AgentBubble } from "../components/agents/agents";

const PRIORITY = {
  high: { label: "Alta", dot: "bg-red-500" },
  medium: { label: "Média", dot: "bg-amber-400" },
  low: { label: "Baixa", dot: "bg-slate-300" },
};
const RECURRENCE = { none: "Não repete", daily: "Todo dia", weekly: "Toda semana", monthly: "Todo mês" };
const DAY_MS = 86400000;

function dayKey(task) {
  if (task.remind_at) return format(new Date(task.remind_at), "yyyy-MM-dd");
  if (task.due_date) return String(task.due_date).slice(0, 10);
  return null;
}

// Próxima ocorrência de uma recorrente — mesma regra de server/src/whatsapp/tasks.js.
function nextOccurrence(task) {
  const step = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (task.recurrence === "daily") return new Date(d.getTime() + DAY_MS).toISOString();
    if (task.recurrence === "weekly") return new Date(d.getTime() + 7 * DAY_MS).toISOString();
    const next = new Date(d);
    next.setUTCMonth(d.getUTCMonth() + 1);
    return next.toISOString();
  };
  return { due_date: step(task.due_date), remind_at: step(task.remind_at) };
}

function whenLabel(task) {
  if (task.remind_at) return format(new Date(task.remind_at), "dd/MM 'às' HH:mm");
  if (task.due_date) return format(new Date(String(task.due_date).slice(0, 10) + "T00:00:00"), "dd/MM");
  return "Sem prazo";
}

const EMPTY_FORM = { title: "", notes: "", date: "", time: "", priority: "medium", recurrence: "none" };

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const me = await User.me();
      setTasks(await Task.filter({ created_by: me.email }, "-created_date"));
    } catch (err) {
      console.error("Erro ao carregar tarefas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const today = format(new Date(), "yyyy-MM-dd");
  const columns = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done");
    const soon = format(new Date(Date.now() + 2 * DAY_MS), "yyyy-MM-dd");
    const dueSoon = open.filter((t) => t.status !== "in_progress" && dayKey(t) && dayKey(t) <= soon);
    const dueSoonIds = new Set(dueSoon.map((t) => t.id));
    const byDate = (a, b) => (dayKey(a) || "9999").localeCompare(dayKey(b) || "9999");
    return [
      { id: "soon", title: "Vencendo", tone: "text-red-600", items: dueSoon.sort(byDate) },
      { id: "pending", title: "Pendentes", tone: "text-slate-500", items: open.filter((t) => t.status === "pending" && !dueSoonIds.has(t.id)).sort(byDate) },
      { id: "progress", title: "Em andamento", tone: "text-brand-700 dark:text-brand-300", items: open.filter((t) => t.status === "in_progress").sort(byDate) },
      {
        id: "done",
        title: "Concluídas",
        tone: "text-slate-400",
        items: tasks
          .filter((t) => t.status === "done")
          .sort((a, b) => String(b.completed_at || "").localeCompare(String(a.completed_at || "")))
          .slice(0, 15),
      },
    ];
  }, [tasks]);

  const weekDone = tasks.filter((t) => t.status === "done" && t.completed_at && Date.now() - new Date(t.completed_at).getTime() < 7 * DAY_MS).length;
  const overdue = tasks.filter((t) => t.status !== "done" && dayKey(t) && dayKey(t) < today).length;

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const remindAt = form.date && form.time ? new Date(`${form.date}T${form.time}:00`).toISOString() : null;
      await Task.create({
        title: form.title.trim(),
        notes: form.notes.trim() || null,
        due_date: form.date || null,
        remind_at: remindAt,
        priority: form.priority,
        recurrence: form.recurrence,
      });
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await load();
    } catch (err) {
      alert(`Não foi possível salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const complete = async (task) => {
    if (task.recurrence && task.recurrence !== "none") {
      await Task.update(task.id, { ...nextOccurrence(task), reminded_at: null, status: "pending" });
    } else {
      await Task.update(task.id, { status: "done", completed_at: new Date().toISOString() });
    }
    load();
  };

  const start = async (task) => {
    await Task.update(task.id, { status: "in_progress" });
    load();
  };

  const remove = async (task) => {
    if (!confirm(`Excluir "${task.title}"?`)) return;
    await Task.delete(task.id);
    load();
  };

  const reopen = async (task) => {
    await Task.update(task.id, { status: "pending", completed_at: null });
    load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
      <section className="space-y-6">
        <p className="section-label">Tarefas e lembretes</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
            {columns[0].items.length + columns[1].items.length + columns[2].items.length} <span className="text-slate-400">abertas</span>
          </h1>
          <button type="button" onClick={() => setFormOpen(true)} className="pill-primary">
            <Plus className="h-4 w-4" /> Nova tarefa
          </button>
        </div>
        <AgentBubble agent="otto">
          {overdue > 0 ? (
            <>
              você tem <strong>{overdue} tarefa{overdue > 1 ? "s" : ""} atrasada{overdue > 1 ? "s" : ""}</strong>. Quer que eu te lembre de novo? É só me pedir no WhatsApp.
            </>
          ) : weekDone > 0 ? (
            <>
              você concluiu <strong>{weekDone}</strong> tarefa{weekDone > 1 ? "s" : ""} nos últimos 7 dias. Bom ritmo! 💪
            </>
          ) : (
            <>me mande no WhatsApp: "me lembra de ligar pro contador amanhã às 10h" — eu anoto aqui e te chamo na hora.</>
          )}
        </AgentBubble>
      </section>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => (
            <div key={col.id} className="space-y-3">
              <p className={`flex items-center justify-between font-display text-xs font-semibold uppercase tracking-[0.2em] ${col.tone}`}>
                {col.title} <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800">{col.items.length}</span>
              </p>
              {col.items.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400 dark:border-slate-700">Nada por aqui.</p>}
              {col.items.map((task) => {
                const late = task.status !== "done" && dayKey(task) && dayKey(task) < today;
                return (
                  <div key={task.id} className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${PRIORITY[task.priority]?.dot || PRIORITY.medium.dot}`} title={`Prioridade ${PRIORITY[task.priority]?.label || "Média"}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`font-display font-medium ${task.status === "done" ? "text-slate-400 line-through" : "text-slate-900 dark:text-white"}`}>{task.title}</p>
                        {task.notes && <p className="mt-0.5 text-sm text-slate-500">{task.notes}</p>}
                        <p className={`mt-2 flex flex-wrap items-center gap-3 text-xs ${late ? "font-semibold text-red-600" : "text-slate-500"}`}>
                          <span className="flex items-center gap-1">
                            {task.remind_at && <Bell className="h-3.5 w-3.5" />} {whenLabel(task)}
                          </span>
                          {task.recurrence && task.recurrence !== "none" && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <Repeat className="h-3.5 w-3.5" /> {RECURRENCE[task.recurrence]}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {task.status === "done" ? (
                        <button type="button" onClick={() => reopen(task)} className="text-xs font-medium text-slate-500 hover:text-slate-800">
                          Reabrir
                        </button>
                      ) : (
                        <>
                          <button type="button" onClick={() => complete(task)} className="inline-flex items-center gap-1 rounded-full bg-brand-700 px-3 py-1 text-xs font-medium text-white hover:bg-brand-800">
                            <Check className="h-3.5 w-3.5" /> Concluir
                          </button>
                          {task.status !== "in_progress" && (
                            <button type="button" onClick={() => start(task)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                              <Play className="h-3.5 w-3.5" /> Iniciar
                            </button>
                          )}
                        </>
                      )}
                      <button type="button" onClick={() => remove(task)} className="ml-auto rounded-full p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600" aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Nova tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="O que precisa ser feito?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            <Input placeholder="Observações (opcional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                Prazo
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
              <label className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                Lembrar às
                <Input type="time" value={form.time} disabled={!form.date} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                Prioridade
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {Object.entries(PRIORITY).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                Repetir
                <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {Object.entries(RECURRENCE).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-slate-500">Com prazo e horário, o Otto te avisa pelo WhatsApp na hora marcada.</p>
            <button type="button" onClick={save} disabled={saving || !form.title.trim()} className="pill-primary w-full justify-center disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar tarefa
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
