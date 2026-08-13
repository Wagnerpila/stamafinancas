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

// Tenta resolver um valor de categoria "solto" (ex: salvo por uma versão antiga do app que usava
// o enum fixo acima, ou devolvido por uma IA que não recebeu a lista de categorias do usuário)
// para o nome exato de uma categoria real do usuário. Usado como rede de segurança em qualquer
// lugar que recebe uma categoria vinda de fora (IA, dado legado) — nunca é a única fonte de
// verdade, o usuário sempre pode escolher outra no formulário.
export function resolveCategoryName(raw, userCategoryNames = []) {
  if (!raw) return "";
  const rawLower = String(raw).toLowerCase();

  // 1. Já bate exatamente (ou só difere em maiúsculas/minúsculas) com uma categoria real
  const direct = userCategoryNames.find(name => name.toLowerCase() === rawLower);
  if (direct) return direct;

  // 2. É um slug antigo do enum fixo (ex: "food") — traduz pro rótulo em português e tenta
  // casar esse rótulo com uma categoria real do usuário
  const legacy = ALL_CATEGORIES.find(c => c.value === rawLower);
  if (legacy) {
    const byLabel = userCategoryNames.find(name => name.toLowerCase() === legacy.label.toLowerCase());
    if (byLabel) return byLabel;
  }

  return ""; // sem correspondência confiável — deixa em branco pro usuário escolher
}