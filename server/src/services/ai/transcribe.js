// Transcrição de áudio (mensagens de voz do WhatsApp). A API da Anthropic não recebe áudio, então
// usa o primeiro serviço disponível, priorizando os gratuitos:
//   1. Gemini (GEMINI_API_KEY) — plano gratuito, entende o áudio direto
//   2. Groq (GROQ_API_KEY) — plano gratuito, Whisper large v3
//   3. OpenAI (OPENAI_API_KEY) — pago

import { geminiProvider } from './gemini.js';

export function isTranscriptionAvailable() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
}

async function whisperCompatible({ url, apiKey, model, buffer, mimeType }) {
  const baseType = mimeType.split(';')[0].trim();
  const ext = { 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/webm': 'webm' }[baseType] || 'ogg';

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: baseType }), `audio.${ext}`);
  form.append('model', model);
  form.append('language', 'pt');

  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(`Transcription error (${response.status}): ${text.slice(0, 300)}`);
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  return String(data.text || '').trim();
}

export async function transcribeAudio(buffer, mimeType = 'audio/ogg') {
  if (process.env.GEMINI_API_KEY) {
    const text = await geminiProvider.generateText({
      prompt: 'Transcreva este áudio em português exatamente como foi falado. Responda só com a transcrição, sem comentários.',
      files: [{ base64: buffer.toString('base64'), mimeType: mimeType.split(';')[0].trim() || 'audio/ogg' }],
    });
    return text.trim();
  }
  if (process.env.GROQ_API_KEY) {
    return whisperCompatible({
      url: 'https://api.groq.com/openai/v1/audio/transcriptions',
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3',
      buffer,
      mimeType,
    });
  }
  if (process.env.OPENAI_API_KEY) {
    return whisperCompatible({
      url: 'https://api.openai.com/v1/audio/transcriptions',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1',
      buffer,
      mimeType,
    });
  }
  const err = new Error('Transcrição de áudio indisponível: defina GEMINI_API_KEY (gratuita) em server/.env.');
  err.status = 503;
  throw err;
}
