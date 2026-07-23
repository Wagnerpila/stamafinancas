import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  gradient, 
  trend,
  trendIcon: TrendIcon 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="relative overflow-hidden border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5`} />
        <CardContent className="p-6 relative">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl bg-gradient-to-r ${gradient} shadow-lg`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            {trend && TrendIcon && (
              <div className="flex items-center gap-1">
                <TrendIcon className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-600">{trend}</span>
              </div>
            )}
          </div>
          
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}