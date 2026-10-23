import {
  LayoutDashboard,
  ArrowLeftRight,
  Plus,
  CreditCard,
  Receipt,
  Wallet,
  Repeat,
  CalendarClock,
  Tag,
  Target,
  PiggyBank,
  LineChart,
  CalendarRange,
  MessageCircle,
  Bot,
  FileUp,
  ListChecks,
  Bell,
  Star,
  Users,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { createPageUrl } from "@/utils";

// Menu organizado em "mesas" (áreas de trabalho), cada uma com a cor do seu ponto indicador.
// `match` lista as páginas que pertencem à mesa, pra destacar a mesa atual no topo da tela.
export const MESAS = [
  {
    id: "financas",
    agent: "bia",
    title: "Finanças",
    subtitle: "com a Bia",
    dot: "bg-brand-600",
    items: [
      { title: "Visão geral", page: "Dashboard", icon: LayoutDashboard },
      { title: "Transações", page: "Transactions", icon: ArrowLeftRight },
      { title: "Nova transação", page: "NewTransactionOptions", icon: Plus },
      { title: "Cartões e faturas", page: "CreditCards", icon: CreditCard },
      { title: "Contas a pagar", page: "BillsToPay", icon: Receipt },
      { title: "Contas a receber", page: "BillsToReceive", icon: Wallet },
      { title: "Recorrências", page: "Recurring", icon: Repeat },
      { title: "Crediário", page: "Crediario", icon: CalendarClock },
      { title: "Categorias", page: "TransactionCategories", icon: Tag },
      { title: "Orçamentos", page: "CategoryBudgets", icon: PiggyBank },
      { title: "Análises", page: "Reports", icon: LineChart },
      { title: "Planejamento", page: "FuturePlanning", icon: CalendarRange },
      { title: "Metas", page: "Goals", icon: Target },
    ],
    match: [
      "CreditCardInvoices",
      "CreditCardTransactions",
      "ManualTransaction",
      "PhotoTransaction",
      "VoiceTransaction",
      "FileUploadTransaction",
      "ReviewImportedTransactions",
    ],
  },
  {
    id: "stama",
    agent: "stama",
    title: "Stama",
    subtitle: "no WhatsApp",
    dot: "bg-emerald-500",
    items: [
      { title: "Stama no WhatsApp", page: "StamaWhatsApp", icon: MessageCircle },
      { title: "Consultoria IA", page: "AIConsulting", icon: Bot },
      { title: "Importar extrato", page: "ImportStatement", icon: FileUp },
    ],
  },
  {
    id: "agenda",
    agent: "otto",
    title: "Agenda",
    subtitle: "com o Otto",
    dot: "bg-fuchsia-500",
    items: [{ title: "Tarefas e lembretes", page: "Tasks", icon: ListChecks }],
  },
  {
    id: "conta",
    agent: "gil",
    title: "Conta",
    subtitle: "com o Gil",
    dot: "bg-slate-400",
    items: [
      { title: "Notificações e WhatsApp", page: "NotificationSettings", icon: Bell },
      { title: "Minha assinatura", page: "MySubscription", icon: Star },
      { title: "Comunidade", page: "CommunityNetwork", icon: Users },
    ],
  },
];

export const ADMIN_MESA = {
  id: "admin",
  agent: "gil",
  title: "Administração",
  subtitle: "somente admin",
  dot: "bg-amber-500",
  items: [
    { title: "Painel admin", page: "AdminDashboard", icon: ShieldCheck },
    { title: "Planos e preços", page: "SubscriptionAdmin", icon: Settings },
  ],
};

export function mesasFor(user) {
  return user?.role === "admin" ? [...MESAS, ADMIN_MESA] : MESAS;
}

export function mesaForPage(pageName, user) {
  return (
    mesasFor(user).find((m) => m.items.some((i) => i.page === pageName) || m.match?.includes(pageName)) || MESAS[0]
  );
}

export function itemUrl(item) {
  return createPageUrl(item.page);
}

// Títulos das páginas que não estão no menu (o resto vem do próprio item do menu).
const EXTRA_TITLES = {
  CreditCardInvoices: "Faturas",
  CreditCardTransactions: "Compras do cartão",
  ManualTransaction: "Lançamento manual",
  PhotoTransaction: "Foto do comprovante",
  VoiceTransaction: "Lançar por voz",
  FileUploadTransaction: "Enviar arquivo",
  ReviewImportedTransactions: "Revisar importação",
  NewTransactionOptions: "Nova transação",
};

export function pageTitle(pageName) {
  if (EXTRA_TITLES[pageName]) return EXTRA_TITLES[pageName];
  for (const mesa of [...MESAS, ADMIN_MESA]) {
    const item = mesa.items.find((i) => i.page === pageName);
    if (item) return item.title;
  }
  return "Stama";
}
