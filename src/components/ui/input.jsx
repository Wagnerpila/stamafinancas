import * as React from "react"

import { cn } from "@/lib/utils"

const isNativeDateTimeType = (type) => type === "date" || type === "time" || type === "datetime-local" || type === "month" || type === "week";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    (<input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        // O calendário/valor desses campos é desenhado pelo navegador (fora do nosso CSS normal);
        // em navegadores mobile isso frequentemente ignora bg-transparent e nossas variáveis de
        // cor, resultando em texto branco sobre fundo branco (ilegível). Forçamos o tema nativo
        // claro nesses campos especificamente, garantindo contraste em qualquer aparelho/tema.
        isNativeDateTimeType(type) && "[color-scheme:light] bg-white text-slate-900 dark:bg-white dark:text-slate-900",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
