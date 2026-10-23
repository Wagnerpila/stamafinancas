import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, subMonths } from "date-fns";
import { Repeat, Plus, AlertTriangle, Copy, Loader2, ArrowRight } from "lucide-react";
import { Bill, Transaction, User } from "@/api/entities";
import { createPageUrl } from "@/utils";
import { normalizeTitle } from "../components/lib/billRecurrence";
import { BigAmount } from "../components/dashboard/FinanceOverview";
import { AgentBubble } from "../components/agents/agents";

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const RECURRENCE = { monthly: "mensal", quarterly: "trimestral", yearly: "anual" };
const MONTHLY_FACTOR = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

// Datas de lançamento/vencimento são "dia" (gravadas como meia-noite UTC): usa só o YYYY-MM-DD,
// senão o fuso de Brasília mostra o dia anterior.
function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(String(raw).slice(0, 10) + "T00:00:00");
  return isNaN(d) ? null : d;
}

// Próximo vencimento de uma recorrente a partir de hoje (mesmo dia do mês da origem).
function nextDue(bill) {
  const origin = parseDate(bill.due_date);
  if (!origin) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const step = bill.recurrence === "quarterly" ? 3 : bill.recurrence === "yearly" ? 12 : 1;
  const d = new Date(origin);
  while (d < today) d.setMonth(d.getMonth() + step);
  return d;
}

export default function Recurring() {
  const [bills, setBills] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);

  const load = async () => {
    try {
      const me = await User.me();
      const [b, t] = await Promise.all([Bill.filter({ created_by: me.email }), Transaction.filter({ created_by: me.email }, "-date")]);
      setBills(b);
      setTransactions(t);
    } catch (err) {
      console.error("Erro ao carregar recorrências:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const data = useMemo(() => {
    const recurring = bills
      .filter((b) => b.recurrence && b.recurrence !== "none" && b.status !== "paid")
      .map((b) => ({ ...b, next: nextDue(b) }))
      .sort((a, b) => (a.next || 0) - (b.next || 0));
    const monthlyOut = recurring.filter((b) => b.type === "payable").reduce((s, b) => s + b.amount * (MONTHLY_FACTOR[b.recurrence] || 1), 0);
    const monthlyIn = recurring.filter((b) => b.type === "receivable").reduce((s, b) => s + b.amount * (MONTHLY_FACTOR[b.recurrence] || 1), 0);

    // Alerta: recorrente cujo último lançamento com o mesmo nome saiu com valor diferente.
    const priceChanges = [];
    recurring.forEach((b) => {
      const key = normalizeTitle(b.title);
      const last = transactions.find((t) => normalizeTitle(t.description) === key);
      if (last && Math.abs(Math.abs(last.amount) - b.amount) > Math.max(1, b.amount * 0.02)) {
        priceChanges.push({ bill: b, last });
      }
    });

    // Alerta: mesma descrição e valor lançados mais de uma vez em até 3 dias (últimos 60 dias).
    const cutoff = Date.now() - 60 * 86400000;
    const recent = transactions.filter((t) => t.type === "expense" && (parseDate(t.date)?.getTime() || 0) >= cutoff);
    const duplicates = [];
    const seen = new Set();
    recent.forEach((a) => {
      recent.forEach((b) => {
        if (a.id >= b.id || seen.has(b.id)) return;
        const days = Math.abs((parseDate(a.date) - parseDate(b.date)) / 86400000);
        if (normalizeTitle(a.description) === normalizeTitle(b.description) && Math.abs(a.amount - b.amount) < 0.01 && days <= 3) {
          duplicates.push([a, b]);
          seen.add(b.id);
        }
      });
    });

    // Padrões: gasto/receita com a mesma descrição em 2+ dos últimos 3 meses, sem conta recorrente.
    const billTitles = new Set(bills.map((b) => normalizeTitle(b.title)));
    const groups = {};
    for (let i = 0; i <= 3; i++) {
      const ref = format(subMonths(new Date(), i), "yyyy-MM");
      transactions.forEach((t) => {
        if (String(t.date || "").slice(0, 7) !== ref || t.invoice_id) return;
        const key = normalizeTitle(t.description);
        if (!key || billTitles.has(key)) return;
        groups[key] = groups[key] || { months: new Set(), items: [] };
        groups[key].months.add(ref);
        groups[key].items.push(t);
      });
    }
    const patterns = Object.values(groups)
      .filter((g) => g.months.size >= 2)
      .map((g) => {
        const latest = g.items.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
        const avg = g.items.reduce((s, t) => s + Math.abs(t.amount), 0) / g.items.length;
        return { latest, avg, months: g.months.size };
      })
      .sort((a, b) => b.avg - a.avg);

    return { recurring, monthlyOut, monthlyIn, priceChanges, duplicates, patterns };
  }, [bills, transactions]);

  const makeRecurring = async (pattern) => {
    const t = pattern.latest;
    setCreating(t.id);
    try {
      const day = parseDate(t.date) || new Date();
      const next = new Date(day);
      next.setMonth(next.getMonth() + 1);
      await Bill.create({
        title: t.description,
        amount: Math.round(pattern.avg * 100) / 100,
        type: t.type === "income" ? "receivable" : "payable",
        category: t.category,
        due_date: format(next, "yyyy-MM-dd"),
        recurrence: "monthly",
        status: "pending",
        notes: "Criada a partir de um padrão detectado pelo Stama.",
      });
      await load();
    } catch (err) {
      alert(`Não foi possível criar: ${err.message}`);
    } finally {
      setCreating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  const alerts = data.priceChanges.length + data.duplicates.length;

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-4 md:p-8">
      <section className="space-y-6">
        <p className="section-label">Recorrências</p>
        <BigAmount value={data.monthlyOut} />
        <p className="text-lg text-slate-600 dark:text-slate-300">
          comprometidos <strong className="text-slate-900 dark:text-white">todo mês</strong> com contas fixas
          {data.monthlyIn > 0 && (
            <>
              {" "}· entra fixo <strong className="text-brand-700 dark:text-brand-300">+R$ {brl(data.monthlyIn)}</strong>
            </>
          )}
          .
        </p>
        <AgentBubble agent="bia">
          {alerts > 0
            ? `encontrei ${alerts} ponto${alerts > 1 ? "s" : ""} de atenção nas suas cobranças — dá uma olhada logo abaixo.`
            : data.patterns.length > 0
              ? `achei ${data.patterns.length} gasto${data.patterns.length > 1 ? "s" : ""} que se repete${data.patterns.length > 1 ? "m" : ""} todo mês. Quer transformar em recorrência pra eu prever seus próximos meses?`
              : "tudo em ordem: nenhuma cobrança estranha e nenhum padrão sem plano."}
        </AgentBubble>
        <div className="flex flex-wrap gap-3">
          <Link to={createPageUrl("BillsToPay")} className="pill-primary">
            <Plus className="h-4 w-4" /> Nova conta fixa
          </Link>
          <Link to={createPageUrl("FuturePlanning")} className="pill-outline">
            Projeção <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {alerts > 0 && (
        <section className="space-y-4">
          <p className="section-label !text-red-600">Alertas</p>
          <div className="space-y-3">
            {data.priceChanges.map(({ bill, last }) => (
              <div key={`p-${bill.id}`} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <p className="text-slate-800 dark:text-slate-100">
                  <strong>{bill.title}</strong> mudou de preço: cadastrada por R$ {brl(bill.amount)}, último lançamento de{" "}
                  <strong>R$ {brl(Math.abs(last.amount))}</strong> em {format(parseDate(last.date), "dd/MM")}.
                </p>
              </div>
            ))}
            {data.duplicates.map(([a, b]) => (
              <div key={`d-${a.id}-${b.id}`} className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
                <Copy className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <p className="text-slate-800 dark:text-slate-100">
                  Possível <strong>cobrança duplicada</strong>: “{a.description}” de R$ {brl(Math.abs(a.amount))} em {format(parseDate(a.date), "dd/MM")} e{" "}
                  {format(parseDate(b.date), "dd/MM")}.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <p className="section-label">Contas fixas</p>
        {data.recurring.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-300">Nenhuma conta recorrente ainda. Pelo WhatsApp: “aluguel 1500 todo dia 10”.</p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-900">
            {data.recurring.map((b) => (
              <div key={b.id} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0 dark:border-slate-800">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${b.type === "receivable" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"} dark:bg-slate-800`}>
                  <Repeat className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-medium text-slate-900 dark:text-white">{b.title}</p>
                  <p className="text-sm text-slate-500">
                    {RECURRENCE[b.recurrence] || b.recurrence}
                    {b.next && <> · próximo {format(b.next, "dd/MM")}</>}
                    {b.category && <> · {b.category}</>}
                  </p>
                </div>
                <p className={`font-display font-semibold ${b.type === "receivable" ? "text-brand-700 dark:text-brand-300" : "text-slate-900 dark:text-white"}`}>
                  {b.type === "receivable" ? "+" : ""}R$ {brl(b.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.patterns.length > 0 && (
        <section className="space-y-4">
          <p className="section-label">Padrões sem plano</p>
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-900">
            {data.patterns.map((p) => (
              <div key={p.latest.id} className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0 dark:border-slate-800">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-medium text-slate-900 dark:text-white">{p.latest.description}</p>
                  <p className="text-sm text-slate-500">
                    apareceu em {p.months} dos últimos 4 meses · média R$ {brl(p.avg)}
                  </p>
                </div>
                <button type="button" onClick={() => makeRecurring(p)} disabled={creating === p.latest.id} className="pill-outline !py-1.5">
                  {creating === p.latest.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />} Virar recorrência
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
