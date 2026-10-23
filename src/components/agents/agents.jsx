import React from "react";
import { format } from "date-fns";
import stamaLogo from "@/assets/stama-logo.png";

// Equipe virtual do Stama: cada área do app tem um agente que "assina" os recados daquela área
// (no app e nas respostas do WhatsApp — ver AGENTS em server/src/whatsapp/assistant.js).
export const AGENTS = {
  stama: { name: "Stama", role: "Seu assistente", gradient: "from-brand-500 to-brand-800" },
  bia: { name: "Bia", role: "Finanças", gradient: "from-emerald-400 to-teal-700" },
  otto: { name: "Otto", role: "Agenda", gradient: "from-fuchsia-400 to-violet-700" },
  gil: { name: "Gil", role: "Conta e suporte", gradient: "from-sky-400 to-slate-600" },
};

export function AgentAvatar({ agent = "stama", size = "h-11 w-11", className = "" }) {
  const a = AGENTS[agent] || AGENTS.stama;
  if (agent === "stama") {
    return <img src={stamaLogo} alt="Stama" className={`${size} shrink-0 rounded-full border-2 border-brand-200 object-cover dark:border-brand-800 ${className}`} />;
  }
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br ${a.gradient} font-display text-base font-semibold text-white shadow-sm dark:border-slate-900 ${className}`}
      aria-label={a.name}
    >
      {a.name.charAt(0)}
    </span>
  );
}

// Recado de um agente no formato de mensagem do WhatsApp (nome · área, texto, hora e ✓✓).
export function AgentBubble({ agent = "stama", children, time }) {
  const a = AGENTS[agent] || AGENTS.stama;
  const now = time || format(new Date(), "HH:mm");
  return (
    <div className="flex items-start gap-3">
      <AgentAvatar agent={agent} />
      <div className="agent-bubble flex-1">
        <p className="text-sm">
          <span className="font-semibold text-brand-700 dark:text-brand-300">{a.name}</span>
          <span className="text-slate-500 dark:text-slate-300"> · {a.role}</span>
        </p>
        <div className="mt-0.5 flex flex-wrap items-end justify-between gap-x-3">
          <div className="text-[15px] leading-relaxed sm:text-base">{children}</div>
          <span className="ml-auto flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
            {now}
            <svg viewBox="0 0 16 11" className="h-3 w-4 fill-sky-500" aria-hidden="true">
              <path d="M11.07.65 4.98 6.74 2.4 4.16 1.34 5.22l3.64 3.64 7.15-7.15zM14.6.65 8.5 6.74l-.7-.7-1.06 1.06 1.76 1.76 7.15-7.15z" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
