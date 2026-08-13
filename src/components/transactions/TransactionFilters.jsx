import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, X } from "lucide-react";

const categoryLabels = {
  salary: "Salário",
  freelance: "Freelance", 
  investment: "Investimento",
  other_income: "Outras Receitas",
  food: "Alimentação",
  transport: "Transporte",
  health: "Saúde",
  education: "Educação",
  entertainment: "Entretenimento",
  shopping: "Compras",
  bills: "Contas",
  rent: "Aluguel",
  other_expense: "Outras Despesas"
};

export default function TransactionFilters({ filters, onFiltersChange, cards = [] }) {
  const handleFilterChange = (key, value) => {
    const next = { ...filters, [key]: value };
    // Ao sair do filtro "Cartão de crédito" o sub-filtro de qual cartão perde o sentido — reseta
    // pra não deixar um filtro escondido (cardId) ainda ativo sem aparecer na tela.
    if (key === 'source' && value !== 'credit_card') next.cardId = 'all';
    onFiltersChange(next);
  };

  const clearFilters = () => {
    onFiltersChange({
      type: 'all',
      category: 'all',
      source: 'all',
      cardId: 'all',
      search: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value && value !== 'all' && value !== ''
  );

  return (
    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm mb-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Filtros</h3>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={filters.source} onValueChange={(value) => handleFilterChange('source', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="statement_import">Extrato importado</SelectItem>
                <SelectItem value="credit_card">Cartão de crédito</SelectItem>
                <SelectItem value="manual">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filters.source === 'credit_card' && cards.length > 1 && (
            <div>
              <Select value={filters.cardId || 'all'} onValueChange={(value) => handleFilterChange('cardId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Qual cartão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cartões</SelectItem>
                  {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Input
              placeholder="Buscar descrição..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
          
          <div>
            {/* <input type="date"> ignora o atributo placeholder em todo navegador — sem esse
                rótulo visível não dava pra saber qual campo era o inicial e qual era o final. */}
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Data inicial</label>
            <div className="relative">
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className={filters.dateFrom ? "pr-10" : ""}
              />
              {filters.dateFrom && (
                <button
                  type="button"
                  onClick={() => handleFilterChange('dateFrom', '')}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  aria-label="Limpar data inicial"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Data final</label>
            <div className="relative">
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className={filters.dateTo ? "pr-10" : ""}
              />
              {filters.dateTo && (
                <button
                  type="button"
                  onClick={() => handleFilterChange('dateTo', '')}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  aria-label="Limpar data final"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}