import React, { useState, useEffect } from "react";
import { SubscriptionPlan } from "@/entities/SubscriptionPlan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, Edit } from "lucide-react";
import { motion } from "framer-motion";

const featureLabels = {
  photo_capture: "Fotografar Comprovante",
  voice_command: "Comando de Voz", 
  file_upload: "Upload de Arquivos",
  ai_consulting: "Consultoria com IA",
  advanced_reports: "Relatórios Avançados",
  bills_management: "Gestão de Contas",
  goals_tracking: "Acompanhamento de Metas",
  unlimited_transactions: "Transações Ilimitadas"
};

const defaultPlans = [
  {
    plan_name: "free",
    features: {
      photo_capture: false,
      voice_command: false,
      file_upload: false,
      ai_consulting: false,
      advanced_reports: false,
      bills_management: true,
      goals_tracking: true,
      unlimited_transactions: false
    },
    pricing: { monthly_price: 0, yearly_price: 0 },
    transaction_limit: 10
  },
  {
    plan_name: "premium",
    features: {
      photo_capture: true,
      voice_command: true,
      file_upload: true,
      ai_consulting: true,
      advanced_reports: true,
      bills_management: true,
      goals_tracking: true,
      unlimited_transactions: true
    },
    pricing: { monthly_price: 39.90, yearly_price: 399.90 },
    transaction_limit: -1
  }
];

export default function SubscriptionAdmin() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      let data = await SubscriptionPlan.list();
      
      // Filtrar apenas planos free e premium
      data = data.filter(plan => ['free', 'premium'].includes(plan.plan_name));
      
      if (data.length === 0) {
        // Criar apenas planos padrão free e premium se não existirem
        for (const plan of defaultPlans) {
          await SubscriptionPlan.create(plan);
        }
        data = await SubscriptionPlan.list();
        data = data.filter(plan => ['free', 'premium'].includes(plan.plan_name));
      }
      
      setPlans(data);
    } catch (error) {
      console.error("Erro ao carregar planos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (planData) => {
    try {
      if (editingPlan) {
        await SubscriptionPlan.update(editingPlan.id, planData);
      } else {
        await SubscriptionPlan.create(planData);
      }
      setEditingPlan(null);
      await loadPlans();
    } catch (error) {
      console.error("Erro ao salvar plano:", error);
    }
  };

  const planColors = {
    free: "bg-gray-100 text-gray-800",
    premium: "bg-purple-100 text-purple-800"
  };

  const planNames = {
    free: "Gratuito",
    premium: "Premium"
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Planos de Assinatura</h1>
            <p className="text-slate-600 dark:text-slate-300">Configure os planos disponíveis e suas funcionalidades</p>
          </div>
        </div>
      </motion.div>

      {editingPlan && (
        <PlanEditor
          plan={editingPlan}
          onSave={handleSavePlan}
          onCancel={() => setEditingPlan(null)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className={`border-0 shadow-xl bg-white/90 dark:bg-slate-800 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 ${
              plan.plan_name === 'premium' ? 'ring-2 ring-purple-300 scale-105' : ''
            }`}>
              <CardHeader className="text-center pb-2">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <Badge className={`${planColors[plan.plan_name]} mb-2`}>
                      {plan.plan_name.toUpperCase()}
                    </Badge>
                    <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                      {planNames[plan.plan_name]}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingPlan(plan)}
                    className="hover:bg-blue-100 hover:text-blue-600"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="py-6">
                  <div className="text-4xl font-bold text-slate-900 dark:text-white">
                    R$ {plan.pricing?.monthly_price?.toFixed(2)}
                    <span className="text-lg font-normal text-slate-500 dark:text-slate-400">/mês</span>
                  </div>
                  {plan.pricing?.yearly_price > 0 && (
                    <div className="text-sm text-slate-500 mt-1">
                      ou R$ {plan.pricing.yearly_price.toFixed(2)}/ano (economize 17%)
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-3 text-center">Funcionalidades Incluídas:</h4>
                  <div className="space-y-3">
                    {Object.entries(plan.features || {}).map(([feature, enabled]) => (
                      <div key={feature} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-700">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {featureLabels[feature]}
                        </span>
                        <Badge 
                          variant={enabled ? "default" : "secondary"} 
                          className={`text-xs ${enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}
                        >
                          {enabled ? "✓ Incluído" : "✗ Não incluído"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="pt-4 border-t text-center">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Limite de Transações:
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`font-bold ${plan.transaction_limit === -1 ? 'text-emerald-600 border-emerald-200' : 'text-blue-600 border-blue-200'}`}
                    >
                      {plan.transaction_limit === -1 ? '∞ Ilimitado' : `${plan.transaction_limit} por mês`}
                    </Badge>
                  </div>
                </div>

                {plan.plan_name === 'premium' && (
                  <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                    <p className="text-sm font-semibold text-purple-700 mb-1">🎯 Mais Popular</p>
                    <p className="text-xs text-purple-600">Ideal para controle financeiro completo</p>
                  </div>
                )}

                {plan.plan_name === 'free' && (
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-semibold text-gray-700 mb-1">🚀 Comece Grátis</p>
                    <p className="text-xs text-gray-600">Perfeito para começar a organizar suas finanças</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-purple-50 max-w-2xl mx-auto">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">💡 Recomendação</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Comece com o plano <strong>Gratuito</strong> para testar as funcionalidades básicas. 
              Quando precisar de recursos avançados como IA e relatórios completos, 
              faça upgrade para o plano <strong>Premium</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlanEditor({ plan, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    plan_name: plan.plan_name || '',
    features: plan.features || {},
    pricing: plan.pricing || { monthly_price: 0, yearly_price: 0 },
    transaction_limit: plan.transaction_limit || 10,
    active: plan.active !== false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleFeatureChange = (feature, enabled) => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: enabled
      }
    }));
  };

  const handlePricingChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        [field]: parseFloat(value) || 0
      }
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {plan.id ? 'Editar Plano' : 'Novo Plano'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="plan_name">Nome do Plano</Label>
                <Input
                  id="plan_name"
                  value={formData.plan_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, plan_name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction_limit">Limite de Transações</Label>
                <Input
                  id="transaction_limit"
                  type="number"
                  value={formData.transaction_limit}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    transaction_limit: parseInt(e.target.value) || 0 
                  }))}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="monthly_price">Preço Mensal (R$)</Label>
                <Input
                  id="monthly_price"
                  type="number"
                  step="0.01"
                  value={formData.pricing.monthly_price}
                  onChange={(e) => handlePricingChange('monthly_price', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearly_price">Preço Anual (R$)</Label>
                <Input
                  id="yearly_price"
                  type="number"
                  step="0.01"
                  value={formData.pricing.yearly_price}
                  onChange={(e) => handlePricingChange('yearly_price', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-slate-900 dark:text-white">Funcionalidades</h4>
              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(featureLabels).map(([feature, label]) => (
                  <div key={feature} className="flex items-center justify-between p-3 rounded-lg border dark:border-slate-600 dark:bg-slate-700">
                    <Label htmlFor={feature}>{label}</Label>
                    <Switch
                      id={feature}
                      checked={formData.features[feature] || false}
                      onCheckedChange={(checked) => handleFeatureChange(feature, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                Salvar Plano
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}