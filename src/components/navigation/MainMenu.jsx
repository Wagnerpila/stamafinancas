import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sun, Moon, SlidersHorizontal, ChevronRight, LogOut } from "lucide-react";
import { createPageUrl } from "@/utils";
import stamaLogo from "@/assets/stama-logo.png";
import DeleteAccount from "../settings/DeleteAccount";
import { mesasFor, itemUrl } from "./menuConfig";

const PLAN_LABEL = { free: "Plano gratuito", premium: "Plano Premium" };

// Lista de uma mesa: cabeçalho em pílula com o ponto colorido + cartão com os itens.
export function MesaList({ mesa, onNavigate, compact = false }) {
  const location = useLocation();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <span className={`h-2.5 w-2.5 rounded-full ${mesa.dot}`} />
        <span className="font-display text-base font-semibold text-slate-900 dark:text-white">{mesa.title}</span>
        {!compact && <span className="text-xs text-slate-400">{mesa.subtitle}</span>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {mesa.items.map((item) => {
          const active = location.pathname === itemUrl(item);
          return (
            <Link
              key={item.page}
              to={itemUrl(item)}
              onClick={onNavigate}
              className={`group flex items-center gap-4 px-5 ${compact ? "py-2.5" : "py-3.5"} transition-colors ${
                active
                  ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
                  : "text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <item.icon className={`h-5 w-5 shrink-0 ${active ? "text-brand-700 dark:text-brand-300" : "text-slate-500"}`} strokeWidth={1.75} />
              <span className={`flex-1 font-display ${compact ? "text-sm" : "text-[15px]"} font-medium`}>{item.title}</span>
              <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function ProfileCard({ user, onNavigate }) {
  const initial = (user?.full_name || user?.email || "?").trim().charAt(0).toUpperCase();
  return (
    <Link
      to={createPageUrl("MySubscription")}
      onClick={onNavigate}
      className="flex items-center gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 font-display text-lg font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-100">
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg font-semibold text-slate-900 dark:text-white">
          {user?.full_name?.split(" ")[0] || user?.email}
        </span>
        <span className="block text-sm text-slate-500">{PLAN_LABEL[user?.subscription_plan_name] || "Plano"}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-slate-300" />
    </Link>
  );
}

export function BrandMark({ size = "md" }) {
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  return (
    <span className="flex items-center gap-2.5">
      <span className={`${box} overflow-hidden rounded-xl shadow-sm`}>
        <img src={stamaLogo} alt="STAMA" className="h-full w-full object-cover" />
      </span>
      <span className="font-display text-xl font-medium tracking-tight text-slate-900 dark:text-white">stama</span>
    </span>
  );
}

const roundBtn =
  "flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

export default function MainMenu({ open, onClose, user, isDark, toggleDark, onLogout }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed inset-0 z-[10000] flex flex-col bg-slate-50 dark:bg-slate-950"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
            <BrandMark />
            <div className="flex items-center gap-2">
              <Link to={createPageUrl("NotificationSettings")} onClick={onClose} className={roundBtn} aria-label="Preferências">
                <SlidersHorizontal className="h-5 w-5" />
              </Link>
              <button type="button" onClick={toggleDark} className={roundBtn} aria-label={isDark ? "Modo claro" : "Modo escuro"}>
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button type="button" onClick={onClose} className={roundBtn} aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-xl space-y-6 px-4 py-6 pb-16">
              <ProfileCard user={user} onNavigate={onClose} />

              <p className="section-label !text-slate-500">Mesas</p>

              {mesasFor(user).map((mesa) => (
                <MesaList key={mesa.id} mesa={mesa} onNavigate={onClose} />
              ))}

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white py-3 font-display text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                >
                  <LogOut className="h-4 w-4" /> Sair da conta
                </button>
                <DeleteAccount />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
