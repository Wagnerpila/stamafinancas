
import React, { useEffect, useState, useCallback } from 'react';
import { Bill } from "@/entities/Bill";
import { NotificationSettings } from "@/entities/NotificationSettings";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, BellOff, AlertTriangle, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function NotificationManager() {
  const [permissions, setPermissions] = useState('default');
  const [settings, setSettings] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const showNotification = useCallback((title, body, tag = 'default') => {
    console.log('Tentando mostrar notificação:', { title, body, tag, permission: Notification.permission });
    
    if (!isSupported) {
      alert(`${title}\n${body}`);
      return;
    }

    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag,
          requireInteraction: true
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        setTimeout(() => {
          notification.close();
        }, 8000);

        console.log('Notificação criada com sucesso');
      } catch (error) {
        console.error('Erro ao criar notificação:', error);
        alert(`${title}\n${body}`);
      }
    } else {
      console.warn('Permissão negada para notificações');
      alert(`${title}\n${body}`);
    }
  }, [isSupported]);

  const checkBillsAndNotify = useCallback(async (userEmail) => {
    if (!user || !settings?.enabled) return;
    
    try {
      console.log('Verificando contas automaticamente...');
      const bills = await Bill.filter({ created_by: userEmail });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dueDateThreshold = new Date();
      dueDateThreshold.setDate(today.getDate() + (settings?.bills_due_days || 3));
      
      let dueSoon = 0;
      let overdue = 0;
      let overdueList = [];
      let dueSoonList = [];
      
      bills.forEach(bill => {
        if (bill.status === 'paid') return;
        
        const billDate = new Date(bill.due_date);
        billDate.setHours(0, 0, 0, 0);
        
        if (billDate < today) {
          overdue++;
          overdueList.push(bill.title);
        } else if (billDate <= dueDateThreshold) {
          dueSoon++;
          dueSoonList.push(bill.title);
        }
      });

      console.log(`Verificação automática: ${dueSoon} vencendo, ${overdue} em atraso`);

      if (dueSoon > 0) {
        showNotification(
          '📅 Contas Vencendo',
          `${dueSoon} conta(s) vencendo: ${dueSoonList.slice(0, 2).join(', ')}${dueSoonList.length > 2 ? '...' : ''}`,
          'bills-due'
        );
      }

      if (overdue > 0 && settings.overdue_reminders) {
        showNotification(
          '⚠️ Contas em Atraso',
          `${overdue} conta(s) em atraso: ${overdueList.slice(0, 2).join(', ')}${overdueList.length > 2 ? '...' : ''}`,
          'bills-overdue'
        );
      }
    } catch (error) {
      console.error('Erro na verificação automática:', error);
    }
  }, [user, settings, showNotification]);

  const startAutomaticChecking = useCallback((userEmail) => {
    // Check immediately
    checkBillsAndNotify(userEmail);
    
    // Then check every 2 hours
    const interval = setInterval(() => {
      checkBillsAndNotify(userEmail);
    }, 2 * 60 * 60 * 1000); // 2 hours

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [checkBillsAndNotify]);

  const loadSettings = useCallback(async (userEmail) => {
    try {
      const data = await NotificationSettings.filter({ created_by: userEmail });
      if (data.length > 0) {
        setSettings(data[0]);
      } else {
        const defaultSettings = {
          enabled: true,
          bills_due_days: 3,
          overdue_reminders: true,
          goals_progress: true,
          weekly_summary: true,
          created_by: userEmail
        };
        const created = await NotificationSettings.create(defaultSettings);
        setSettings(created);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setSettings({
        enabled: true,
        bills_due_days: 3,
        overdue_reminders: true,
        goals_progress: true,
        weekly_summary: true
      });
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      // Check for iOS, which does not support web push notifications
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

      // Check notification support
      const supported = 'Notification' in window && !isIOS;
      setIsSupported(supported);
      
      // Check current permission
      if (supported) {
        setPermissions(Notification.permission);
      }

      // Load user
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        await loadSettings(currentUser.email);
        
        // Start automatic notification checking
        if (supported && Notification.permission === 'granted') {
          startAutomaticChecking(currentUser.email);
        }
      } catch (e) {
        console.error("Erro ao carregar usuário:", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadSettings, startAutomaticChecking]);

  const requestPermission = async () => {
    if (!isSupported) {
      alert('Notificações não são suportadas neste navegador ou dispositivo.');
      return;
    }

    try {
      console.log('Solicitando permissão...');
      const permission = await Notification.requestPermission();
      console.log('Permissão obtida:', permission);
      setPermissions(permission);
      
      if (permission === 'granted') {
        showNotification('Sucesso!', 'Notificações foram ativadas com sucesso.');
        // Start automatic checking
        if (user) {
          startAutomaticChecking(user.email);
        }
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
      alert('Não foi possível solicitar a permissão de notificação. Verifique as configurações do seu navegador.');
    }
  };

  const testNotification = () => {
    console.log('Executando teste de notificação...');
    showNotification(
      'Teste de Notificação ✅',
      'Se você está vendo esta mensagem, o sistema de alertas está funcionando perfeitamente!',
      'test-notification'
    );
    alert("Comando de notificação de teste enviado! Se nada apareceu, verifique as configurações de Foco/Não Perturbe do seu sistema operacional.");
  };

  const checkBillsNow = async () => {
    if (!user) return;
    
    try {
      await checkBillsAndNotify(user.email);
    } catch (error) {
      console.error('Erro ao verificar contas:', error);
      showNotification('❌ Erro', 'Não foi possível verificar suas contas no momento.');
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      if (!user) return;

      let updated;
      if (settings?.id) {
        updated = await NotificationSettings.update(settings.id, newSettings);
      } else {
        updated = await NotificationSettings.create({ ...newSettings, created_by: user.email });
      }
      setSettings(updated);
      showNotification('✅ Configurações', 'Suas configurações foram salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações. Por favor, tente novamente.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Notificações web não são suportadas no sistema iOS (iPhone/iPad), independentemente do navegador utilizado (Chrome, Safari, etc.). Para receber alertas, por favor, acesse o sistema em um dispositivo Windows, Android ou macOS.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-2xl mx-auto p-4 sm:p-6 lg:p-8"
    >
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Bell className="w-5 h-5" />
            Sistema de Alertas Inteligentes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border">
            <div className="flex items-start sm:items-center gap-3 mb-4 sm:mb-0">
              {permissions === 'granted' ? (
                <Bell className="w-6 h-6 text-green-600 flex-shrink-0" />
              ) : (
                <BellOff className="w-6 h-6 text-red-600 flex-shrink-0" />
              )}
              <div>
                <p className="font-semibold text-base sm:text-lg">Status das Notificações</p>
                <p className="text-sm text-slate-500">
                  {permissions === 'granted' ? '✅ Ativadas e funcionando' : '❌ Precisam ser ativadas'}
                </p>
              </div>
            </div>
            {permissions !== 'granted' && (
              <Button onClick={requestPermission} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                Ativar Notificações
              </Button>
            )}
          </div>

          {settings && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3 mb-2 sm:mb-0">
                  <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className="text-base sm:text-md">Alertar contas com vencimento em:</span>
                </div>
                <select
                  value={settings.bills_due_days || 3}
                  onChange={(e) => updateSettings({
                    ...settings,
                    bills_due_days: parseInt(e.target.value)
                  })}
                  className="px-3 py-1 rounded border bg-white w-full sm:w-auto"
                >
                  <option value={1}>1 dia</option>
                  <option value={2}>2 dias</option>
                  <option value={3}>3 dias</option>
                  <option value={7}>1 semana</option>
                </select>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3 mb-2 sm:mb-0">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <span className="text-base sm:text-md">Lembrar contas em atraso</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.overdue_reminders || false}
                  onChange={(e) => updateSettings({
                    ...settings,
                    overdue_reminders: e.target.checked
                  })}
                  className="w-4 h-4 mt-1 sm:mt-0"
                />
              </div>
            </div>
          )}

          <div className="space-y-3 pt-4 border-t">
            <Button 
              onClick={testNotification} 
              variant="outline" 
              className="w-full"
            >
              🧪 Testar Notificação
            </Button>
            
            <Button 
              onClick={checkBillsNow} 
              variant="outline" 
              className="w-full"
            >
              🔍 Verificar Minhas Contas Agora
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert className="max-w-2xl mx-auto">
        <Bell className="h-4 w-4" />
        <AlertDescription>
          <strong>💡 Dica:</strong> O sistema agora verifica automaticamente suas contas a cada 2 horas e enviará notificações quando necessário. Você também pode ver os alertas no ícone do sino no topo da tela.
        </AlertDescription>
      </Alert>
    </motion.div>
  );
}
