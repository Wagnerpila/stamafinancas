// Provedor Google Gemini — tem plano gratuito (chave em https://aistudio.google.com/apikey) e
// aceita imagem, PDF e áudio no mesmo formato, então serve pra OCR de comprovantes, interpretação
// de mensagens do bot e transcrição de áudio sem nenhum serviço pago.

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function model() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

async function call({ system, prompt, files, schema }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY não configurada.');
    err.status = 503;
    throw err;
  }

  const parts = (files || []).map((file) => ({ inline_data: { mime_type: file.mimeType, data: file.base64 } }));
  parts.push({ text: prompt });

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { maxOutputTokens: 8192 },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (schema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseJsonSchema = schema;
  }

  const response = await fetch(`${API_BASE}/${model()}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(`Gemini API error (${response.status}): ${text.slice(0, 500)}`);
    err.status = response.status === 429 ? 429 : 502;
    throw err;
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error(
      'O arquivo tem muitos lançamentos e a resposta da IA foi cortada antes de terminar. Tente enviar um período menor ou dividir o arquivo em partes.'
    );
  }
  return (candidate?.content?.parts || []).map((p) => p.text || '').join('');
}

export const geminiProvider = {
  name: 'gemini',

  async generateStructured({ system, prompt, schema, files }) {
    const text = await call({ system, prompt, files, schema });
    if (!text) throw new Error('A IA não retornou dados estruturados.');
    return JSON.parse(text);
  },

  async generateText({ system, prompt, files }) {
    return call({ system, prompt, files });
  },
};
