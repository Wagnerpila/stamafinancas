import React from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MonthFilter({ selectedDate, onChange, yearMode, onToggleYearMode }) {
  const label = yearMode
    ? `Ano de ${selectedDate.getFullYear()}`
    : format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });

  const isCurrentMonth =
    !yearMode &&
    selectedDate.getMonth() === new Date().getMonth() &&
    selectedDate.getFullYear() === new Date().getFullYear();

  const isCurrentYear =
    yearMode && selectedDate.getFullYear() === new Date().getFullYear();

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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
        <CalendarDays className="w-4 h-4 text-slate-400" />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePrev}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize min-w-[140px] text-center">
          {label}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleNext}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <Button
        variant={yearMode ? "default" : "outline"}
        size="sm"
        className={`text-xs px-3 py-1.5 h-auto rounded-xl ${yearMode ? "bg-blue-600 text-white hover:bg-blue-700" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
        onClick={onToggleYearMode}
      >
        {yearMode ? "Ver por mês" : "Ver ano todo"}
      </Button>
    </div>
  );
}