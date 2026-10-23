// Kit visual do Stama: as peças que todas as telas usam pra ter a mesma cara — cabeçalho de
// subpágina, seletor de mês em pílula, cartões de resumo, busca + filtros em pílula, grupos por
// dia, itens de lista, etiquetas de status e estado vazio.

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, Search } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createPageUrl } from "@/utils";

export const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------------------------------------------------------------------------
// Cabeçalho da subpágina (renderizado pelo Layout; a página só informa o conteúdo)
// ---------------------------------------------------------------------------

// Dois contextos de propósito: a página só usa o setter (estável), então atualizar o cabeçalho
// re-renderiza apenas o cabeçalho do Layout — nunca a página, que voltaria a chamar o setter com
// funções/elementos novos e entraria em loop.
const PageHeaderSetContext = createContext(() => {});
const PageHeaderStateContext = createContext({});

export function PageHeaderProvider({ children }) {
  const [header, setHeader] = useState({});
  return (
    <PageHeaderSetContext.Provider value={setHeader}>
      <PageHeaderStateContext.Provider value={header}>{children}</PageHeaderStateContext.Provider>
    </PageHeaderSetContext.Provider>
  );
}

export function usePageHeaderState() {
  return useContext(PageHeaderStateContext);
}

// Uso na página: usePageHeader({ title, subtitle, badge, onAdd, addLabel, back, actions }) — os
// valores entram no cabeçalho fixo do Layout e somem ao sair da página. onAdd pode ser uma função
// nova a cada render: o cabeçalho sempre chama a mais recente.
export function usePageHeader({ title, subtitle, badge, onAdd, addLabel, back, actions } = {}) {
  const setHeader = useContext(PageHeaderSetContext);
  const onAddRef = useRef(onAdd);
  onAddRef.current = onAdd;
  const hasAdd = !!onAdd;
  useEffect(() => {
    setHeader({ title, subtitle, badge, onAdd: hasAdd ? () => onAddRef.current?.() : undefined, addLabel, back, actions });
  }, [setHeader, title, subtitle, badge, hasAdd, addLabel, back, actions]);
  useEffect(() => () => setHeader({}), [setHeader]);
}

export function RoundButton({ children, onClick, label, tone = "outline", className = "", type = "button" }) {
  const tones = {
    outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
    primary: "bg-brand-700 text-white shadow-md hover:bg-brand-800",
  };
  return (
    <button type={type} onClick={onClick} aria-label={label} title={label} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${tones[tone]} ${className}`}>
      {children}
    </button>
  );
}

export function SubpageHeader({ title, subtitle, badge, onAdd, addLabel = "Adicionar", back, actions }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (typeof back === "string") navigate(createPageUrl(back));
    else if (window.history.length > 1) navigate(-1);
    else navigate(createPageUrl("Dashboard"));
  };
  return (
    <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 lg:px-8">
      <RoundButton onClick={goBack} label="Voltar">
        <ChevronLeft className="h-5 w-5" />
      </RoundButton>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
          {badge && (
            <span className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700 dark:border-brand-800 dark:bg-brand-900/40 dark:text-brand-300">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions}
      {onAdd && (
        <RoundButton onClick={onAdd} label={addLabel} tone="primary" className="h-14 w-14">
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </RoundButton>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estrutura e blocos
// ---------------------------------------------------------------------------

export function PageBody({ children, className = "", wide = false }) {
  return <div className={`mx-auto space-y-5 px-4 py-5 pb-28 lg:px-8 lg:pb-10 ${wide ? "max-w-6xl" : "max-w-3xl"} ${className}`}>{children}</div>;
}

export function SectionLabel({ children, className = "" }) {
  return <p className={`section-label ${className}`}>{children}</p>;
}

export function Panel({ children, className = "", padded = true, dashed = false, as: Tag = "div", ...rest }) {
  return (
    <Tag
      className={`rounded-[28px] bg-white dark:bg-slate-900 ${
        dashed ? "border border-dashed border-slate-300 dark:border-slate-700" : "border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-slate-800"
      } ${padded ? "p-5 sm:p-6" : ""} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const VALUE_TONES = {
  positive: "text-brand-700 dark:text-brand-300",
  negative: "text-red-600",
  info: "text-blue-700 dark:text-sky-400",
  warning: "text-amber-600",
  neutral: "text-slate-900 dark:text-white",
};

// Cartão de resumo: rótulo espaçado com linha + valor grande. `value` numérico vira R$.
export function StatCard({ label, value, tone = "neutral", hint, icon, size = "md", onClick, className = "", money = true }) {
  const display = typeof value === "number" && money ? `R$ ${brl(value)}` : value;
  return (
    <Panel as={onClick ? "button" : "div"} onClick={onClick} className={`w-full text-left ${onClick ? "transition hover:shadow-md" : ""} ${className}`}>
      <p className="section-label !text-[11px] !tracking-[0.22em] !text-slate-500">
        <span className="flex items-center gap-1.5">
          {label}
          {icon}
        </span>
      </p>
      <p className={`mt-2 font-display font-bold tracking-tight ${size === "lg" ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"} ${VALUE_TONES[tone] || VALUE_TONES.neutral}`}>{display}</p>
      {hint && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
    </Panel>
  );
}

export function StatGrid({ children, cols = 2 }) {
  return <div className={`grid gap-3 ${cols === 3 ? "grid-cols-2 sm:grid-cols-3" : cols === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"}`}>{children}</div>;
}

// Seletor de mês em pílula: ‹ Outubro de 2026 ›
export function MonthPill({ date, onChange, disableFuture = false, extra }) {
  const label = format(date, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase());
  const isFuture = disableFuture && addMonths(date, 1) > new Date();
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-2 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
        <button type="button" onClick={() => onChange(subMonths(date, 1))} className="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[10rem] text-center font-display text-base font-semibold text-slate-900 dark:text-white">{label}</span>
        <button
          type="button"
          onClick={() => onChange(addMonths(date, 1))}
          disabled={isFuture}
          className="rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {extra}
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder = "Buscar…", onFilters, filtersActive = false }) {
  return (
    <div className="flex items-center gap-3">
      <label className="relative flex-1">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-brand-900"
        />
      </label>
      {onFilters && (
        <RoundButton onClick={onFilters} label="Filtros" className={`h-14 w-14 ${filtersActive ? "!border-brand-600 !text-brand-700" : ""}`}>
          <SlidersHorizontal className="h-5 w-5" />
        </RoundButton>
      )}
    </div>
  );
}

// Filtros em pílula, ativo em preto: options = [{ value, label }]
export function FilterChips({ options, value, onChange }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`shrink-0 rounded-full px-5 py-2.5 font-display text-[15px] font-medium transition ${
              active
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {o.label}
            {o.count !== undefined && <span className={`ml-1.5 text-xs ${active ? "opacity-70" : "text-slate-400"}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

const BADGE_TONES = {
  green: "border-brand-300 text-brand-700 dark:border-brand-700 dark:text-brand-300",
  orange: "border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400",
  red: "border-red-300 text-red-600 dark:border-red-800 dark:text-red-400",
  blue: "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-400",
  gray: "border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400",
};

export function StatusBadge({ children, tone = "gray" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-0.5 font-display text-[11px] font-semibold uppercase tracking-[0.15em] ${BADGE_TONES[tone] || BADGE_TONES.gray}`}>
      {children}
    </span>
  );
}

// Cabeçalho de grupo por dia: "HOJE · SEX 23/10" ......... R$ 200,00
export function DayHeader({ date, total, tone = "positive" }) {
  const d = date instanceof Date ? date : new Date(String(date).slice(0, 10) + "T00:00:00");
  const today = format(new Date(), "yyyy-MM-dd") === format(d, "yyyy-MM-dd");
  const label = `${today ? "Hoje · " : ""}${format(d, "EEE dd/MM", { locale: ptBR }).replace(".", "")}`;
  return (
    <div className="flex items-center justify-between px-1 pt-3">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{label}</p>
      {total !== undefined && <p className={`font-display text-sm font-semibold ${VALUE_TONES[tone]}`}>R$ {brl(Math.abs(total))}</p>}
    </div>
  );
}

// Item de lista: ponto · título / meta em caixa alta ......... valor + etiqueta
export function ListItem({ title, meta, amount, amountTone = "neutral", sign = "", badge, dotClass = "bg-slate-400", onClick, children, right, leading }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Panel as={Tag} padded={false} onClick={onClick} className={`flex w-full items-center gap-4 px-5 py-4 text-left ${onClick ? "transition hover:shadow-md" : ""}`}>
      {leading || <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[17px] font-semibold text-slate-900 dark:text-white">{title}</p>
        {meta && <p className="mt-0.5 truncate text-xs font-medium uppercase tracking-[0.15em] text-slate-500">{meta}</p>}
        {children}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {amount !== undefined && (
          <p className={`font-display text-lg font-semibold ${VALUE_TONES[amountTone]}`}>
            {sign}R$ {brl(Math.abs(amount))}
          </p>
        )}
        {badge}
        {right}
      </div>
    </Panel>
  );
}

export function EmptyState({ title, text, action, icon }) {
  return (
    <Panel dashed className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon && <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-500 dark:border-slate-600">{icon}</span>}
      <p className="font-display text-xl font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {text && <p className="max-w-sm text-slate-500 dark:text-slate-400">{text}</p>}
      {action}
    </Panel>
  );
}

export function PillButton({ children, onClick, tone = "primary", className = "", type = "button", disabled, ...rest }) {
  const tones = {
    primary: "bg-brand-700 text-white hover:bg-brand-800",
    dark: "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800",
    danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-transparent",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 font-display text-sm font-medium transition active:scale-[0.98] disabled:opacity-50 ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// Barra de progresso fina (orçamento, metas, limite do cartão).
export function ThinBar({ pct, tone = "bg-brand-700" }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const color = tone === "auto" ? (p >= 100 ? "bg-red-500" : p >= 80 ? "bg-amber-500" : "bg-brand-700") : tone;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${p}%` }} />
    </div>
  );
}
