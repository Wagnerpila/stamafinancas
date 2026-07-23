import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, List, Target, Plus } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  {
    name: "Dashboard",
    path: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
  },
  {
    name: "Transações",
    path: createPageUrl("Transactions"),
    icon: List,
  },
  {
    name: "add",
    path: createPageUrl("NewTransactionOptions"),
    icon: Plus,
  },
  {
    name: "Metas",
    path: createPageUrl("Goals"),
    icon: Target,
  },
];

export default function BottomTabBar() {
  const location = useLocation();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 z-[9999]" style={{ transform: 'translateZ(0)', willChange: 'transform', WebkitTransform: 'translateZ(0)' }}>
      <div className="flex items-center justify-around h-16 pb-safe">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const isAddButton = tab.name === "add";

          if (isAddButton) {
            return (
              <Link key={tab.name} to={tab.path} className="flex-1 flex justify-center">
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="w-14 h-14 -mt-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full shadow-lg flex items-center justify-center"
                >
                  <tab.icon className="w-7 h-7 text-white" />
                </motion.div>
              </Link>
            );
          }

          return (
            <Link
              key={tab.name}
              to={tab.path}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2"
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={`transition-colors ${
                  isActive ? "text-blue-600" : "text-slate-500"
                }`}
              >
                <tab.icon className="w-6 h-6" />
              </motion.div>
              <span
                className={`text-xs font-medium ${
                  isActive ? "text-blue-600" : "text-slate-500"
                }`}
              >
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}