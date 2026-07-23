/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AIConsulting from './pages/AIConsulting';
import TransactionCategories from './pages/TransactionCategories';
import AdminDashboard from './pages/AdminDashboard';
import BillsToPay from './pages/BillsToPay';
import BillsToReceive from './pages/BillsToReceive';
import CategoryBudgets from './pages/CategoryBudgets';
import CommunityNetwork from './pages/CommunityNetwork';
import Crediario from './pages/Crediario';
import CreditCardInvoices from './pages/CreditCardInvoices';
import CreditCardTransactions from './pages/CreditCardTransactions';
import CreditCards from './pages/CreditCards';
import Dashboard from './pages/Dashboard';
import FileUploadTransaction from './pages/FileUploadTransaction';
import Goals from './pages/Goals';
import ImportStatement from './pages/ImportStatement';
import ManualTransaction from './pages/ManualTransaction';
import MySubscription from './pages/MySubscription';
import NewTransactionOptions from './pages/NewTransactionOptions';
import NotificationSettings from './pages/NotificationSettings';
import PhotoTransaction from './pages/PhotoTransaction';
import Reports from './pages/Reports';
import ReviewImportedTransactions from './pages/ReviewImportedTransactions';
import SubscriptionAdmin from './pages/SubscriptionAdmin';
import Transactions from './pages/Transactions';
import VoiceTransaction from './pages/VoiceTransaction';
import FuturePlanning from './pages/FuturePlanning';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIConsulting": AIConsulting,
    "TransactionCategories": TransactionCategories,
    "AdminDashboard": AdminDashboard,
    "BillsToPay": BillsToPay,
    "BillsToReceive": BillsToReceive,
    "CategoryBudgets": CategoryBudgets,
    "CommunityNetwork": CommunityNetwork,
    "Crediario": Crediario,
    "CreditCardInvoices": CreditCardInvoices,
    "CreditCardTransactions": CreditCardTransactions,
    "CreditCards": CreditCards,
    "Dashboard": Dashboard,
    "FileUploadTransaction": FileUploadTransaction,
    "Goals": Goals,
    "ImportStatement": ImportStatement,
    "ManualTransaction": ManualTransaction,
    "MySubscription": MySubscription,
    "NewTransactionOptions": NewTransactionOptions,
    "NotificationSettings": NotificationSettings,
    "PhotoTransaction": PhotoTransaction,
    "Reports": Reports,
    "ReviewImportedTransactions": ReviewImportedTransactions,
    "SubscriptionAdmin": SubscriptionAdmin,
    "Transactions": Transactions,
    "VoiceTransaction": VoiceTransaction,
    "FuturePlanning": FuturePlanning,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};