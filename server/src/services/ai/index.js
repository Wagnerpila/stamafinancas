import { anthropicProvider } from './anthropic.js';
import { openaiProvider } from './openai.js';

export function getAIProvider() {
  const configured = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (configured === 'anthropic') return anthropicProvider;
  if (configured === 'openai') return openaiProvider;
  return null;
}

export function requireAIProvider() {
  const provider = getAIProvider();
  if (!provider) {
    const err = new Error(
      'Nenhum provedor de IA está configurado. Defina AI_PROVIDER (anthropic|openai) e a respectiva API key em server/.env para habilitar este recurso.'
    );
    err.status = 503;
    throw err;
  }
  return provider;
}
