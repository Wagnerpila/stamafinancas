import * as React from "react"

import { cn } from "@/lib/utils"

const isNativeDateTimeType = (type) => type === "date" || type === "time" || type === "datetime-local" || type === "month" || type === "week";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    (<input
      type={type}
      className={cn(
        "flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-base transition dark:border-slate-700 dark:bg-slate-900 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-100 dark:focus-visible:ring-brand-900 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        // O calendário/valor desses campos é desenhado pelo navegador (fora do nosso CSS normal);
        // em navegadores mobile isso frequentemente ignora bg-transparent e nossas variáveis de
        // cor, resultando em texto branco sobre fundo branco (ilegível). Forçamos o tema nativo
        // claro nesses campos especificamente. Além disso usamos um fundo levemente acinzentado e
        // uma borda mais forte (em vez de bg-white + border-input, quase invisível sobre um card
        // claro) para o campo ficar visível como um controle distinto, não uma mancha branca.
        isNativeDateTimeType(type) && "[color-scheme:light] bg-slate-100 text-slate-900 border-2 border-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-300",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
