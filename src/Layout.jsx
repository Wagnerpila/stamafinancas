import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { Menu, Plus, LogOut, Moon, Sun } from "lucide-react";
import InAppAlerts from "./components/notifications/InAppAlerts";
import BillsDueAlert from "./components/alerts/BillsDueAlert";
import useDarkMode from "./hooks/useDarkMode";
import DeleteAccount from "./components/settings/DeleteAccount";
import MainMenu, { BrandMark, MesaList, ProfileCard } from "./components/navigation/MainMenu";
import { mesasFor, mesaForPage } from "./components/navigation/menuConfig";
import { AgentAvatar } from "./components/agents/agents";

// Abas das mesas no topo ("Finanças com a Bia · Agenda com o Otto"), com o avatar do agente: a mesa da página
// atual fica em destaque, as outras levam pra primeira página delas.
function MesaTabs({ user, currentPageName }) {
  const current = mesaForPage(currentPageName, user);
  const location = useLocation();
  return (
    <div className="relative">
      <nav className="flex items-center gap-6 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none] lg:px-8">
        {mesasFor(user).map((mesa) => {
          const active = mesa.id === current.id;
          return (
            <Link
              key={mesa.id}
              to={createPageUrl(mesa.items[0].page)}
              className={`flex shrink-0 items-center gap-2.5 transition-opacity ${active ? "" : "opacity-50 hover:opacity-80"}`}
              aria-current={active ? "page" : undefined}
            >
              <AgentAvatar agent={mesa.agent} size="h-9 w-9" className={active ? "ring-2 ring-brand-600 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950" : ""} />
              <span className="leading-tight">
                <span className={`block font-display text-sm font-semibold ${active ? "uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300" : "text-slate-600 dark:text-slate-300"}`}>
                  {mesa.title}
                </span>
                <span className={`block text-xs ${active ? "text-brand-700/80 dark:text-brand-300/80" : "text-slate-400"}`}>{mesa.subtitle}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      <div key={location.pathname} className="mx-4 h-[3px] rounded-full bg-gradient-to-r from-brand-200 via-fuchsia-400 to-violet-400 opacity-80 lg:mx-8" />
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isDark, toggle: toggleDark } = useDarkMode();

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/login");
  };

  // No loading/login-screen branches here anymore — ProtectedRoute (App.jsx) already
  // guarantees an authenticated `user` before Layout ever renders.

  return (
    <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950">
      <BillsDueAlert />

      {/* Desktop: barra lateral com as mesas */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950 lg:flex">
        <div className="flex items-center justify-between px-5 py-5">
          <BrandMark />
          <button
            type="button"
            onClick={toggleDark}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            aria-label={isDark ? "Modo claro" : "Modo escuro"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
          <ProfileCard user={user} />
          <p className="section-label !text-slate-500">Mesas</p>
          {mesasFor(user).map((mesa) => (
            <MesaList key={mesa.id} mesa={mesa} compact />
          ))}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white py-2.5 font-display text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              <LogOut className="h-4 w-4" /> Sair da conta
            </button>
            <DeleteAccount />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 border-b border-slate-200/60 bg-slate-50/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center justify-between px-4 py-3 lg:hidden">
            <BrandMark size="sm" />
            <InAppAlerts />
          </div>
          <div className="hidden justify-end px-8 pt-3 lg:flex">
            <InAppAlerts />
          </div>
          <MesaTabs user={user} currentPageName={currentPageName} />
        </header>

        <main className="flex-1 overflow-auto pb-32 lg:pb-8">{children}</main>
      </div>

      {/* Mobile: barra flutuante "Abrir menu" + atalho de nova transação */}
      <div className="fixed inset-x-0 bottom-0 z-[9999] px-4 lg:hidden" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-xl items-center gap-2 rounded-[2rem] border border-slate-200 bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-1 items-center justify-center gap-3 rounded-[1.6rem] bg-slate-100 py-3.5 font-display text-base font-medium text-slate-800 transition active:scale-[0.99] dark:bg-slate-800 dark:text-slate-100"
          >
            <Menu className="h-5 w-5" /> Abrir menu
          </button>
          <Link
            to={createPageUrl("NewTransactionOptions")}
            className="flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-full bg-brand-700 text-white shadow-md transition active:scale-95"
            aria-label="Nova transação"
          >
            <Plus className="h-6 w-6" />
          </Link>
        </div>
      </div>

      <MainMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        isDark={isDark}
        toggleDark={toggleDark}
        onLogout={handleLogout}
      />
    </div>
  );
}
