import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { format, addMonths, subMonths, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createPageUrl } from "@/utils";
import { getBillsForMonth, normalizeTitle } from "../lib/billRecurrence";
import { AgentBubble } from "../agents/agents";

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Datas de lançamento são "dia" (gravadas como meia-noite UTC): usa só o YYYY-MM-DD, senão o fuso
// de Brasília empurra o dia 1º pro mês anterior.
function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(String(raw).slice(0, 10) + "T00:00:00");
  return isNaN(d) ? null : d;
}

function inMonth(raw, ref) {
  const d = parseDate(raw);
  return !!d && d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
}

// "R$ 1.234,56" com a parte inteira gigante e símbolo/centavos pequenos.
export function BigAmount({ value, className = "" }) {
  const negative = value < 0;
  const [int, cents] = brl(Math.abs(value)).split(",");
  return (
    <p className={`flex items-baseline font-display text-slate-900 dark:text-white ${className}`}>
      <span className="mr-1 text-2xl font-medium text-slate-700 dark:text-slate-300 sm:text-3xl">{negative ? "-R$" : "R$"}</span>
      <span className="text-6xl font-bold leading-none tracking-tight sm:text-7xl">{int}</span>
      <span className="text-2xl font-medium text-slate-700 dark:text-slate-300 sm:text-3xl">,{cents}</span>
    </p>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div>
      <p className="font-display text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`mt-1 font-display text-lg font-semibold sm:text-xl ${tone || "text-slate-900 dark:text-white"}`}>R$ {brl(value)}</p>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <section className="space-y-6 py-8 first:pt-2">
      <p className="section-label">{label}</p>
      {children}
    </section>
  );
}

export default function FinanceOverview({ transactions, creditCardTxs, bills, budgets, selectedDate, onChangeDate }) {
  const today = new Date();
  const isCurrentMonth = isSameMonth(selectedDate, today);

  const data = useMemo(() => {
    const monthTxs = transactions.filter((t) => inMonth(t.date || t.created_date, selectedDate));
    const received = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    const paid = monthTxs
      .filter((t) => t.type === "expense" && !t.is_food_voucher)
      .reduce((s, t) => s + Math.abs(t.amount || 0), 0);

    const monthBills = getBillsForMonth(bills, selectedDate);
    const pendingBills = monthBills.filter((b) => b.status !== "paid");
    const pendingPay = pendingBills.filter((b) => b.type === "payable").reduce((s, b) => s + b.amount, 0);
    const pendingReceive = pendingBills.filter((b) => b.type === "receivable").reduce((s, b) => s + b.amount, 0);
    const balance = received - paid;
    const projected = balance + pendingReceive - pendingPay;

    // Compromissos fixos = contas recorrentes do mês (a instância virtual ou a cópia própria dela).
    const recurringIds = new Set(bills.filter((b) => b.recurrence && b.recurrence !== "none").map((b) => b.id));
    const fixed = monthBills.filter((b) => (b.recurrence && b.recurrence !== "none") || (b.linked_bill_id && recurringIds.has(b.linked_bill_id)));
    const fixedPay = fixed.filter((b) => b.type === "payable");
    const fixedOut = fixedPay.reduce((s, b) => s + b.amount, 0);
    const fixedIn = fixed.filter((b) => b.type === "receivable").reduce((s, b) => s + b.amount, 0);
    const fixedDone = fixedPay.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0);

    const todayKey = format(today, "yyyy-MM-dd");
    const overdue = bills.filter(
      (b) => b.status !== "paid" && (!b.recurrence || b.recurrence === "none") && String(b.due_date).slice(0, 10) < todayKey
    );

    // Gastos por categoria (mesma regra de CategorySpendingCompact) no mês e no anterior.
    const spendByCat = (ref) => {
      const totals = {};
      transactions.forEach((t) => {
        if (t.type !== "expense" || t.is_food_voucher || t.invoice_id || !inMonth(t.date || t.created_date, ref)) return;
        totals[t.category || "Outros"] = (totals[t.category || "Outros"] || 0) + Math.abs(t.amount || 0);
      });
      creditCardTxs.forEach((t) => {
        if (!inMonth(t.purchase_date || t.created_date, ref)) return;
        totals[t.category || "Outros"] = (totals[t.category || "Outros"] || 0) + Math.abs(t.amount || 0);
      });
      return totals;
    };
    const cur = spendByCat(selectedDate);
    const prev = spendByCat(subMonths(selectedDate, 1));

    const notes = [];
    const growth = Object.entries(cur)
      .map(([cat, v]) => ({ cat, v, p: prev[cat] || 0 }))
      .filter((g) => g.p > 0 && g.v - g.p > 50)
      .sort((a, b) => b.v - b.p - (a.v - a.p))[0];
    if (growth) {
      notes.push({ key: "growth", strong: growth.cat, text: `subiu ${Math.round(((growth.v - growth.p) / growth.p) * 100)}% em relação ao mês passado (R$ ${brl(growth.p)} → R$ ${brl(growth.v)}).` });
    }
    budgets.forEach((b) => {
      const spent = cur[b.category] || 0;
      if (b.monthly_limit > 0 && spent / b.monthly_limit >= 0.8) {
        const pct = Math.round((spent / b.monthly_limit) * 100);
        notes.push({ key: `budget-${b.id}`, strong: b.category, text: `já usou ${pct}% do orçamento (R$ ${brl(spent)} de R$ ${brl(b.monthly_limit)}).` });
      }
    });
    if (overdue.length) {
      notes.push({ key: "overdue", strong: `${overdue.length} conta${overdue.length > 1 ? "s" : ""} atrasada${overdue.length > 1 ? "s" : ""}`, text: `somando R$ ${brl(overdue.reduce((s, b) => s + b.amount, 0))}.` });
    }

    // "Padrão sem plano": gasto que se repete em 2 dos últimos 3 meses e não virou conta recorrente.
    const billTitles = new Set(bills.map((b) => normalizeTitle(b.title)));
    const seen = {};
    const labels = {};
    for (let i = 1; i <= 3; i++) {
      const ref = subMonths(selectedDate, i);
      const monthSet = new Set();
      transactions.forEach((t) => {
        if (t.type !== "expense" || !inMonth(t.date || t.created_date, ref)) return;
        const key = normalizeTitle(t.description);
        if (key && !billTitles.has(key)) {
          monthSet.add(key);
          labels[key] = labels[key] || t.description;
        }
      });
      monthSet.forEach((k) => (seen[k] = (seen[k] || 0) + 1));
    }
    const patterns = Object.entries(seen).filter(([, n]) => n >= 2).map(([k]) => labels[k]);

    return { received, paid, balance, projected, pendingPay, fixedOut, fixedIn, fixedDone, notes, patterns, overdue };
  }, [transactions, creditCardTxs, bills, budgets, selectedDate]);

  const periodLabel = isCurrentMonth ? "Este mês" : format(selectedDate, "MMMM yyyy", { locale: ptBR });
  const flowTotal = data.received + data.paid;
  const paidShare = flowTotal ? Math.min(100, Math.round((data.paid / flowTotal) * 100)) : 0;

  const balanceMessage =
    data.received === 0 && data.paid === 0 ? (
      <>seu saldo está em <strong>R$ {brl(data.balance)}</strong>. Manda seus gastos pro Stama no WhatsApp que eu organizo tudo.</>
    ) : data.balance >= 0 ? (
      <>
        sobraram <strong>R$ {brl(data.balance)}</strong> {isCurrentMonth ? "até agora" : "no mês"}
        {data.pendingPay > 0 ? <> — ainda vencem <strong>R$ {brl(data.pendingPay)}</strong> em contas.</> : "."}
      </>
    ) : (
      <>
        as saídas passaram as entradas em <strong>R$ {brl(Math.abs(data.balance))}</strong>. Vale olhar as categorias que mais pesaram.
      </>
    );

  // Peso dos fixos sobre tudo que sai no mês: o que já saiu + o que ainda vence.
  const expectedOut = data.paid + data.pendingPay;
  const fixedMessage =
    expectedOut === 0 ? (
      "sem saídas no período para medir o peso dos fixos."
    ) : (
      <>
        seus fixos representam <strong>{Math.round((data.fixedOut / expectedOut) * 100)}%</strong> das saídas previstas do mês.
      </>
    );

  return (
    <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
      <Section label="Saldo do período">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onChangeDate(subMonths(selectedDate, 1))}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-900"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[7rem] text-center font-display text-sm font-semibold uppercase tracking-[0.25em] text-brand-700 dark:text-brand-300">
            {periodLabel}
          </span>
          <button
            type="button"
            onClick={() => onChangeDate(addMonths(selectedDate, 1))}
            disabled={isCurrentMonth}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <BigAmount value={data.balance} className="py-4" />

        <div className="relative h-1.5 rounded-full bg-brand-100 dark:bg-brand-950" title={`Pago: ${paidShare}% do fluxo`}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-brand-700" style={{ width: `${100 - paidShare}%` }} />
          <span className="absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white bg-brand-700 dark:border-slate-950" style={{ left: `${100 - paidShare}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Stat label="Recebido" value={data.received} />
          <Stat label="Pago" value={data.paid} />
          <Stat label="Projetado" value={data.projected} tone={data.projected < 0 ? "text-red-600" : undefined} />
        </div>

        <AgentBubble agent="bia">{balanceMessage}</AgentBubble>

        <div className="flex flex-wrap gap-3">
          <Link to={createPageUrl("Transactions")} className="pill-primary">
            Explorar <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to={createPageUrl("BillsToPay")} className="pill-outline">
            Contas
          </Link>
        </div>
      </Section>

      <Section label="Compromissos fixos">
        <div>
          <BigAmount value={data.fixedOut} />
          {data.fixedIn > 0 && (
            <p className="mt-2 font-display text-lg font-semibold text-brand-700 dark:text-brand-300">entra fixo +R$ {brl(data.fixedIn)}</p>
          )}
        </div>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          o que <strong className="text-slate-900 dark:text-white">já estava contratado</strong> antes do mês começar.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <Stat label="Já quitado" value={data.fixedDone} />
          <Stat label="Ainda vence" value={Math.max(0, data.fixedOut - data.fixedDone)} />
        </div>
        <AgentBubble agent="bia">{fixedMessage}</AgentBubble>
        <div className="flex flex-wrap gap-3">
          <Link to={createPageUrl("Recurring")} className="pill-primary">
            Explorar <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to={createPageUrl("CreditCards")} className="pill-outline">
            Parceladas
          </Link>
        </div>
      </Section>

      <Section label="A Bia notou">
        {data.notes.length === 0 && data.patterns.length === 0 ? (
          <p className="text-2xl text-slate-600 dark:text-slate-300">
            nenhum padrão <strong className="text-slate-900 dark:text-white">sem plano</strong>.
          </p>
        ) : (
          <ul className="space-y-3 text-lg text-slate-600 dark:text-slate-300">
            {data.notes.map((n) => (
              <li key={n.key}>
                <strong className="text-slate-900 dark:text-white">{n.strong}</strong> {n.text}
              </li>
            ))}
            {data.patterns.length > 0 && (
              <li>
                <strong className="text-slate-900 dark:text-white">{data.patterns.length} gasto{data.patterns.length > 1 ? "s" : ""} que se repete{data.patterns.length > 1 ? "m" : ""}</strong>{" "}
                todo mês sem estar em contas recorrentes ({data.patterns.slice(0, 3).join(", ")}).
              </li>
            )}
          </ul>
        )}
        <AgentBubble agent="bia">
          {data.patterns.length > 0
            ? "transformar o que se repete em recorrência me ajuda a prever seus próximos meses com mais precisão."
            : "o que se repete na sua vida já virou recorrência ou programação — sigo de olho nos próximos 90 dias."}
        </AgentBubble>
        <div className="flex flex-wrap gap-3">
          <Link to={createPageUrl("Reports")} className="pill-primary">
            Explorar <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to={createPageUrl("Recurring")} className="pill-outline">
            Recorrentes
          </Link>
        </div>
      </Section>
    </div>
  );
}
