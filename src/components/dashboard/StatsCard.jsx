import React from 'react';
import { StatCard } from "../stama/kit";

// Cartão de número do painel, no visual do kit. A cor do valor vem do "gradient" que as telas já
// passavam (vermelho = negativo, verde = positivo). As antigas setas de tendência eram valores
// fixos no código, não calculados, então não são mais exibidas.
export default function StatsCard({ title, value, gradient = "" }) {
  const tone = /red|rose/.test(gradient) ? "negative" : /emerald|green|teal/.test(gradient) ? "positive" : /orange|amber|yellow/.test(gradient) ? "warning" : "neutral";
  return <StatCard label={title} value={value} tone={tone} money={false} />;
}
