import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import {
  Menu,
  LayoutDashboard, 
  Plus, 
  List, 
  BarChart3, 
  Settings,
  Receipt,
  CreditCard,
  Target,
  Bot,
  ShieldCheck,
  Star,
  Tag,
  LogOut,
  Moon,
  Sun,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import InAppAlerts from "./components/notifications/InAppAlerts";
import BillsDueAlert from "./components/alerts/BillsDueAlert";
import useDarkMode from "./hooks/useDarkMode";
import BottomTabBar from "./components/mobile/BottomTabBar";
import stamaLogo from "@/assets/stama-logo.png";
import DeleteAccount from "./components/settings/DeleteAccount";

const navigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { title: "Nova Transação", url: createPageUrl("NewTransactionOptions"), icon: Plus },
  { title: "Transações", url: createPageUrl("Transactions"), icon: List },
  { title: "Cartões de Crédito", url: createPageUrl("CreditCards"), icon: CreditCard },
  { title: "Contas a Pagar", url: createPageUrl("BillsToPay"), icon: Receipt },
  { title: "Contas a Receber", url: createPageUrl("BillsToReceive"), icon: Wallet },
  { title: "Crediário", url: createPageUrl("Crediario"), icon: CreditCard },
  { title: "Metas", url: createPageUrl("Goals"), icon: Target },
  { title: "Consultoria IA", url: createPageUrl("AIConsulting"), icon: Bot },
  { title: "Relatórios", url: createPageUrl("Reports"), icon: BarChart3 },
  { title: "Configurações de Alertas", url: createPageUrl("NotificationSettings"), icon: Settings },
  { title: "Categorias", url: createPageUrl("TransactionCategories"), icon: Tag },
  { title: "Planejamento Futuro", url: createPageUrl("FuturePlanning"), icon: Calendar },
  { title: "Minha Assinatura", url: createPageUrl("MySubscription"), icon: Star }
];

const adminItems = [
  { title: "Painel Admin", url: createPageUrl("AdminDashboard"), icon: ShieldCheck }
];

const NavLink = ({ to, children, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm'
          : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300'
      }`}
    >
      {children}
    </Link>
  );
};

const SidebarInner = ({ user, onLinkClick, handleLogout, isDark, toggleDark }) => (
  <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
    <div className="border-b border-slate-100 p-4 lg:p-6 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shrink-0">
          <img src={stamaLogo} alt="STAMA" className="w-full h-full object-cover" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white text-lg">STAMA</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Controle Financeiro</p>
        </div>
      </div>
    </div>
    
    <div className="flex-1 overflow-y-auto p-4 min-h-0">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-2">
          Menu Principal
        </p>
        {navigationItems.map((item) => (
          <NavLink key={item.title} to={item.url} onClick={onLinkClick}>
            <item.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
            <span className="font-medium">{item.title}</span>
          </NavLink>
        ))}
      </div>

      {user && user.role === 'admin' && (
        <div className="space-y-1 mt-8">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-2">
            Administração
          </p>
          {adminItems.map((item) => (
            <NavLink key={item.title} to={item.url} onClick={onLinkClick}>
              <item.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
              <span className="font-medium">{item.title}</span>
            </NavLink>
          ))}
          {/* Any admin (role === 'admin') manages plans too — no more hardcoded super-admin email. */}
          <NavLink to={createPageUrl("SubscriptionAdmin")} onClick={onLinkClick}>
            <Settings className="w-5 h-5 transition-transform group-hover:scale-110" />
            <span className="font-medium">Planos & Preços</span>
          </NavLink>
        </div>
      )}
    </div>

    <div className="shrink-0 p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
      <Button
        onClick={toggleDark}
        variant="outline"
        className="w-full gap-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        {isDark ? "Modo Claro" : "Modo Escuro"}
      </Button>
      <DeleteAccount />
      <Button
        onClick={handleLogout}
        variant="outline"
        className="w-full border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 gap-2"
      >
        <LogOut className="w-4 h-4" />
        Sair da Conta
      </Button>
    </div>
  </div>
);

export default function Layout({ children, currentPageName }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isDark, toggle: toggleDark } = useDarkMode();

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isMobileMenuOpen]);

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate('/login');
  };

  // No loading/login-screen branches here anymore — ProtectedRoute (App.jsx) already
  // guarantees an authenticated `user` before Layout ever renders.

  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 pb-20 lg:pb-0">
      <BillsDueAlert />

      {/* Desktop Sidebar */}
      <div className="w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-200 dark:border-slate-700 shadow-lg hidden lg:flex lg:flex-col h-screen sticky top-0 shrink-0 overflow-hidden">
        <SidebarInner user={user} handleLogout={handleLogout} isDark={isDark} toggleDark={toggleDark} />
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-0 left-0 bottom-16 w-64 bg-white dark:bg-slate-900 z-50 flex flex-col lg:hidden overflow-hidden"
            >
              <SidebarInner
                user={user}
                handleLogout={handleLogout}
                onLinkClick={() => setIsMobileMenuOpen(false)}
                isDark={isDark}
                toggleDark={toggleDark}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b dark:border-slate-700 p-4 flex justify-between items-center sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden shadow-md shrink-0">
              <img src={stamaLogo} alt="STAMA" className="w-full h-full object-cover" />
            </div>
            <h2 className="font-bold text-slate-900 text-md">STAMA</h2>
          </div>
          <div className="flex items-center">
            <InAppAlerts />
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-6 h-6" />
            </Button>
          </div>
        </header>
        
        {/* Desktop Header */}
        <header className="hidden lg:flex justify-end items-center p-4">
          <InAppAlerts />
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
        
        <BottomTabBar />
      </div>
    </div>
  );
}