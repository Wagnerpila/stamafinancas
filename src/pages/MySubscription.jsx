import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { getAdminContact } from '@/functions/getAdminContact';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Star, Crown, MessageCircle, Check, X, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function MySubscription() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const handleRequestPremium = async () => {
    try {
      const { data } = await getAdminContact();
      const message = `Olá! Gostaria de solicitar o upgrade para o plano Premium.

*Meus dados:*
Nome: ${user.full_name}
Email: ${user.email}

Por favor, libere minha assinatura Premium. Obrigado!`;
      
      const whatsappUrl = `https://wa.me/${data.phoneNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Erro ao obter contato:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Alert variant="destructive">
        <X className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar informações do usuário.
        </AlertDescription>
      </Alert>
    );
  }

  const isPremium = user.subscription_plan_name === 'premium';

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Minha Assinatura</h1>
            <p className="text-slate-600 dark:text-slate-300">Gerencie sua assinatura e acesse recursos premium</p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Atual */}
        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              {isPremium ? <Crown className="w-5 h-5 text-yellow-600" /> : <Star className="w-5 h-5" />}
              Status da Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <Badge 
                className={isPremium ? "bg-yellow-100 text-yellow-800" : "bg-slate-100 text-slate-800"}
              >
                {isPremium ? 'PREMIUM' : 'GRATUITO'}
              </Badge>
              <p className="text-slate-600 dark:text-slate-300 mt-4">
                {isPremium 
                  ? 'Você tem acesso a todos os recursos premium!' 
                  : 'Você está no plano gratuito'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upgrade para Premium */}
        {!isPremium && (
          <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <Crown className="w-5 h-5" />
                Upgrade Premium
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Solicite o upgrade para Premium e tenha acesso a recursos exclusivos!
                </p>
                <Button 
                  onClick={handleRequestPremium}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Solicitar via WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recursos dos Planos */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Plano Gratuito */}
        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <Star className="w-5 h-5" />
              Plano Gratuito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm dark:text-slate-200">Até 50 transações/mês</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm dark:text-slate-200">Controle básico de contas</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm dark:text-slate-200">Relatórios simples</span>
              </li>
              <li className="flex items-center gap-2">
                <X className="w-4 h-4 text-red-500" />
                <span className="text-sm text-slate-500">Consultoria IA limitada</span>
              </li>
              <li className="flex items-center gap-2">
                <X className="w-4 h-4 text-red-500" />
                <span className="text-sm text-slate-500">Relatórios avançados</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Plano Premium */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <Crown className="w-5 h-5" />
              Plano Premium
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Transações ilimitadas</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Consultoria IA completa</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Relatórios avançados</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Upload de fotos ilimitado</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Suporte prioritário</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}