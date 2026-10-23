import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MonthFilter({ selectedDate, onChange, yearMode, onToggleYearMode }) {
  const label = yearMode
    ? `Ano de ${selectedDate.getFullYear()}`
    : format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });

  const handlePrev = () => {
    if (yearMode) {
      const d = new Date(selectedDate);
      d.setFullYear(d.getFullYear() - 1);
      onChange(d);
    } else {
      onChange(subMonths(selectedDate, 1));
    }
  };

  const handleNext = () => {
    if (yearMode) {
      const d = new Date(selectedDate);
      d.setFullYear(d.getFullYear() + 1);
      onChange(d);
    } else {
      onChange(addMonths(selectedDate, 1));
    }
  };

  // Mesmo visual da pílula de mês do kit (components/stama/kit.jsx), com o modo "ano" ao lado.
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-2 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
        <button type="button" onClick={handlePrev} className="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[10rem] text-center font-display text-base font-semibold text-slate-900 dark:text-white">{label.replace(/^./, (c) => c.toUpperCase())}</span>
        <button type="button" onClick={handleNext} className="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Próximo">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onToggleYearMode}
        className={`rounded-full px-4 py-2.5 font-display text-sm font-medium ${yearMode ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
      >
        {yearMode ? "Por mês" : "Ano todo"}
      </button>
    </div>
  );
}
