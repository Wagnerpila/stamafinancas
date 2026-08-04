import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Line, ComposedChart } from 'recharts';
import { motion } from "framer-motion";
import { toLocalDateString } from "@/components/lib/dateUtils";

const COLORS = {
  income: '#16a34a',
  expense: '#dc2626'
};

const CATEGORY_COLORS = {
  'Alimentação': '#ff6b35',
  'Transporte': '#f7931e',
  'Saúde': '#4ecdc4',
  'Educação': '#c44569',
  'Lazer': '#f8b500',
  'Compras': '#2563eb',
  'Contas': '#16a34a',
  'Aluguel': '#9333ea',
  'Salário': '#10b981',
  'Freelance': '#06b6d4',
  'Investimento': '#8b5cf6',
  'Outras Receitas': '#64748b',
  'Outras Despesas': '#94a3b8'
};

export default function TransactionChart({ transactions, creditCardTxs = [], type = "bar" }) {
  const monthlyData = React.useMemo(() => {
    const dataMap = {};
    
    transactions.forEach(transaction => {
      // Handle both ISO format and YYYY-MM-DD format
      let dateStr = transaction.date;
      if (dateStr.includes('T')) {
        // ISO format - convert using utility
        dateStr = toLocalDateString(dateStr);
      }
      // Now dateStr is in YYYY-MM-DD format
      const [year, month, day] = dateStr.split('-');
      const monthKey = `${year}-${month}`;
      
      // Create month label
      const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const monthLabel = `${monthNames[parseInt(month) - 1]} de ${year.slice(2)}`;
      
      if (!dataMap[monthKey]) {
        dataMap[monthKey] = { monthKey, month: monthLabel, income: 0, expense: 0, balance: 0 };
      }
      
      if (transaction.type === 'income') {
        dataMap[monthKey].income += transaction.amount;
      } else {
        dataMap[monthKey].expense += Math.abs(transaction.amount);
      }
    });
    
    const sorted = Object.values(dataMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    // Calculate running balance
    let running = 0;
    sorted.forEach(d => {
      running += d.income - d.expense;
      d.balance = running;
    });
    return sorted;
  }, [transactions]);

  const categoryLabels = {
    salary: "Salário",
    freelance: "Freelance",
    investment: "Investimento",
    other_income: "Outras Receitas",
    food: "Alimentação",
    transport: "Transporte",
    health: "Saúde",
    education: "Educação",
    entertainment: "Lazer",
    shopping: "Compras",
    bills: "Contas",
    rent: "Aluguel",
    other_expense: "Outras Despesas"
  };

  const categoryData = React.useMemo(() => {
    const data = {};

    // Resolve o valor bruto da categoria pro nome de exibição ANTES de agrupar — senão uma
    // transação antiga com category="bills" (slug do enum antigo) e outra com category="Contas"
    // (categoria customizada com o mesmo significado) viram duas fatias separadas no gráfico em
    // vez de somarem numa só.
    const resolveLabel = (raw) => categoryLabels[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Faturas já pagas (evita dupla contagem com CreditCardTransactions)
    const paidInvoiceIds = new Set(
      transactions.filter(t => t.invoice_id).map(t => t.invoice_id)
    );

    // Transações normais de despesa apenas
    transactions.forEach(transaction => {
      if (transaction.type !== "expense" || transaction.is_food_voucher) return;
      const name = resolveLabel(transaction.category);
      data[name] = (data[name] || 0) + Math.abs(transaction.amount);
    });

    // Transações de cartão — apenas de faturas não pagas
    creditCardTxs.forEach(t => {
      if (t.invoice_id && paidInvoiceIds.has(t.invoice_id)) return;
      const name = resolveLabel(t.category || "other_expense");
      data[name] = (data[name] || 0) + Math.abs(t.amount || 0);
    });

    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions, creditCardTxs]);

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="14"
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const renderLegend = (props) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {payload.map((entry, index) => (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm font-medium text-slate-700">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (type === "pie") {
    const totalExpenses = categoryData.reduce((sum, item) => sum + item.value, 0);
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">
              Gastos por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="45%"
                    innerRadius={0}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={CustomLabel}
                    labelLine={false}
                  >
                    {categoryData.map((entry, index) => (
                     <Cell 
                       key={`cell-${index}`} 
                       fill={CATEGORY_COLORS[entry.name] || '#64748b'}
                       stroke="#000000"
                       strokeWidth={1.5}
                     />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [
                      `R$ ${value.toFixed(2)} (${((value / totalExpenses) * 100).toFixed(1)}%)`, 
                      name
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend content={renderLegend} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900">
            Receitas vs Despesas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData} margin={{ top: 40, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="month" 
                  stroke="#64748b" 
                  tick={{ fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis hide />
                <Tooltip 
                  formatter={(value, name) => [
                    `R$ ${value.toFixed(2)}`, 
                    name === 'income' ? 'Receitas' : name === 'expense' ? 'Despesas' : 'Saldo'
                  ]}
                  labelStyle={{ color: '#1e293b' }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  formatter={(value) => {
                    if (value === 'income') return 'Receitas';
                    if (value === 'expense') return 'Despesas';
                    return 'Saldo';
                  }}
                  wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }}
                  iconType="square"
                />
                <Bar dataKey="income" fill={COLORS.income} radius={[4, 4, 0, 0]} name="income" label={{ position: 'top', formatter: (value) => value > 0 ? `R$ ${value.toFixed(0)}` : '', fontSize: 10, fill: '#16a34a' }} />
                <Bar dataKey="expense" fill={COLORS.expense} radius={[4, 4, 0, 0]} name="expense" label={{ position: 'top', formatter: (value) => value > 0 ? `R$ ${value.toFixed(0)}` : '', fontSize: 10, fill: '#dc2626' }} />
                <Line type="monotone" dataKey="balance" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed', r: 4 }} name="balance" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}