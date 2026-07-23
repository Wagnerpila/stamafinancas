// Categorias universais usadas em todo o sistema
export const EXPENSE_CATEGORIES = [
  { value: "food", label: "Alimentação" },
  { value: "transport", label: "Transporte" },
  { value: "health", label: "Saúde" },
  { value: "education", label: "Educação" },
  { value: "entertainment", label: "Entretenimento" },
  { value: "shopping", label: "Compras" },
  { value: "bills", label: "Contas" },
  { value: "rent", label: "Aluguel" },
  { value: "other_expense", label: "Outros" },
];

export const INCOME_CATEGORIES = [
  { value: "salary", label: "Salário" },
  { value: "freelance", label: "Freelance" },
  { value: "investment", label: "Investimentos" },
  { value: "other_income", label: "Outras Receitas" },
];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function getCategoryLabel(value) {
  return ALL_CATEGORIES.find(c => c.value === value)?.label || value || "—";
}