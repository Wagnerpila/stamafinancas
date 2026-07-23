import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Share2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ShareDataButton() {
  const [isSharing, setIsSharing] = useState(false);
  const [sharedData, setSharedData] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkSharingStatus();
  }, []);

  const checkSharingStatus = async () => {
    try {
      const user = await base44.auth.me();
      const existing = await base44.entities.SharedFinancialData.filter({
        user_id: user.id
      });

      if (existing.length > 0) {
        setSharedData(existing[0]);
        setIsSharing(existing[0].is_sharing);
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const generateAnonymousId = () => {
    return 'USER-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  };

  const calculateFinancialData = async (user) => {
    const transactions = await base44.entities.Transaction.list();
    
    // Filter by created_by email
    const userTransactions = transactions.filter(t => t.created_by === user.email);

    console.log('Total transactions:', transactions.length);
    console.log('User transactions:', userTransactions.length);
    console.log('User email:', user.email);

    const totalIncome = userTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpense = userTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    // Calculate category spending
    const categorySpending = {};
    userTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const category = t.category;
        if (category) {
          if (!categorySpending[category]) {
            categorySpending[category] = 0;
          }
          categorySpending[category] += Math.abs(t.amount || 0);
        }
      });

    // Calculate monthly data
    const monthlyData = {};
    userTransactions.forEach(t => {
      const date = t.date || t.created_date;
      if (!date) return;
      const month = new Date(date).toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        monthlyData[month].income += (t.amount || 0);
      } else if (t.type === 'expense') {
        monthlyData[month].expense += Math.abs(t.amount || 0);
      }
    });

    const monthsTracked = Object.keys(monthlyData).length;
    const monthlyAverageExpense = monthsTracked > 0 ? totalExpense / monthsTracked : 0;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

    const financialEvolution = Object.entries(monthlyData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        income: data.income,
        expense: data.expense,
        balance: data.income - data.expense
      }));

    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      monthly_average_expense: monthlyAverageExpense,
      savings_rate: savingsRate,
      category_spending: categorySpending,
      months_tracked: monthsTracked,
      financial_evolution: financialEvolution,
      last_updated: new Date().toISOString()
    };
  };

  const handleShare = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const financialData = await calculateFinancialData(user);

      console.log('Financial data calculated:', financialData);

      if (sharedData) {
        // Update existing
        const updated = await base44.entities.SharedFinancialData.update(sharedData.id, {
          ...financialData,
          is_sharing: true
        });
        console.log('Updated shared data:', updated);
      } else {
        // Create new
        const created = await base44.entities.SharedFinancialData.create({
          user_id: user.id,
          anonymous_id: generateAnonymousId(),
          is_sharing: true,
          ...financialData
        });
        console.log('Created shared data:', created);
      }

      setIsSharing(true);
      setShowDialog(true);
      await checkSharingStatus();
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      alert('Erro ao compartilhar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleStopSharing = async () => {
    try {
      if (sharedData) {
        await base44.entities.SharedFinancialData.update(sharedData.id, {
          is_sharing: false
        });
        setIsSharing(false);
      }
    } catch (error) {
      console.error('Erro ao parar compartilhamento:', error);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        {!isSharing ? (
          <Button
            onClick={handleShare}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Share2 className="w-5 h-5 mr-2" />
            {loading ? 'Compartilhando...' : 'Compartilhar Meus Dados'}
          </Button>
        ) : (
          <>
            <Button
              onClick={() => navigate(createPageUrl('CommunityNetwork'))}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Users className="w-5 h-5 mr-2" />
              Ver Rede de Usuários
            </Button>
            <Button
              onClick={handleShare}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {loading ? 'Atualizando...' : 'Atualizar Dados Compartilhados'}
            </Button>
            <Button
              onClick={handleStopSharing}
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
            >
              Parar de Compartilhar
            </Button>
          </>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados Compartilhados com Sucesso!</DialogTitle>
            <DialogDescription>
              Seu ID anônimo é: <span className="font-bold text-blue-600">{sharedData?.anonymous_id}</span>
              <br /><br />
              Agora você pode ver a evolução financeira de outros usuários e trocar experiências.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => {
            setShowDialog(false);
            navigate(createPageUrl('CommunityNetwork'));
          }}>
            Ver Rede Agora
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}