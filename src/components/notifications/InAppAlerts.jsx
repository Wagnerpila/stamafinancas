import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function InAppAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (!currentUser) return;
        const bills = await base44.entities.Bill.filter({ created_by: currentUser.email });
        
        console.log("Contas encontradas:", bills.length);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const newAlerts = [];
        
        bills.forEach(bill => {
          // Só processar contas pendentes
          if (bill.status !== 'pending') return;
          
          const dueDate = new Date(bill.due_date);
          dueDate.setHours(0, 0, 0, 0);

          if (dueDate < today) {
            // Conta vencida
            newAlerts.push({
              id: `bill-overdue-${bill.id}`,
              type: 'overdue',
              message: `Conta "${bill.title}" está vencida`,
              date: bill.due_date,
              url: createPageUrl(bill.type === 'payable' ? "BillsToPay" : "BillsToReceive"),
              priority: 1
            });
          } else {
            // Calcular dias até o vencimento
            const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            if (daysUntilDue <= 3) {
              newAlerts.push({
                id: `bill-due-soon-${bill.id}`,
                type: 'due_soon',
                message: `Conta "${bill.title}" vence ${daysUntilDue === 0 ? 'hoje' : `em ${daysUntilDue} dia(s)`}`,
                date: bill.due_date,
                url: createPageUrl(bill.type === 'payable' ? "BillsToPay" : "BillsToReceive"),
                priority: daysUntilDue === 0 ? 1 : 2
              });
            }
          }
        });
        
        // Ordenar por prioridade e data
        newAlerts.sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return new Date(a.date) - new Date(b.date);
        });
        
        console.log("Alertas criados:", newAlerts.length);
        setAlerts(newAlerts);

      } catch (error) {
        console.error("Erro ao buscar alertas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {alerts.length > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {alerts.length > 9 ? '9+' : alerts.length}
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel>Notificações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <DropdownMenuItem disabled>
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              Carregando...
            </div>
          </DropdownMenuItem>
        ) : alerts.length === 0 ? (
          <DropdownMenuItem disabled>
            <div className="text-center py-4">
              <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nenhum alerta no momento</p>
            </div>
          </DropdownMenuItem>
        ) : (
          alerts.map(alert => (
            <Link to={alert.url} key={alert.id}>
              <DropdownMenuItem className="flex items-start gap-3 cursor-pointer p-4 hover:bg-slate-100 dark:hover:bg-slate-700">
                <AlertTriangle className={`w-5 h-5 mt-1 flex-shrink-0 ${
                  alert.type === 'overdue' ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white break-words">
                    {alert.message}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatDistanceToNow(new Date(alert.date), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </DropdownMenuItem>
            </Link>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}