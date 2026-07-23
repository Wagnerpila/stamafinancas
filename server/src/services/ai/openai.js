const API_URL = 'https://api.openai.com/v1/chat/completions';

function buildContent({ prompt, files }) {
  const content = [{ type: 'text', text: prompt }];
  for (const file of files || []) {
    if (file.mimeType === 'application/pdf') {
      // Chat Completions has no first-class PDF input; best-effort as a data URL image block,
      // which only works if the provider treats page 1 as an image. Prefer the Anthropic
      // provider for PDF invoice/statement OCR.
      continue;
    }
    content.push({
      type: 'image_url',
      image_url: { url: `data:${file.mimeType};base64,${file.base64}` },
    });
  }
  return content;
}

async function call({ system, prompt, files, responseFormat }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY não configurada.');
    err.status = 503;
    throw err;
  }

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: buildContent({ prompt, files }) });

  const body = {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages,
  };
  if (responseFormat) body.response_format = responseFormat;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(`OpenAI API error (${response.status}): ${text.slice(0, 500)}`);
    err.status = 502;
    throw err;
  }

  return response.json();
}

export const openaiProvider = {
  name: 'openai',

  async generateStructured({ system, prompt, schema, files }) {
    const data = await call({
      system,
      prompt,
      files,
      responseFormat: {
        type: 'json_schema',
        json_schema: { name: 'record_result', schema, strict: false },
      },
    });
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('A IA não retornou dados estruturados.');
    return JSON.parse(text);
  },

  async generateText({ system, prompt, files }) {
    const data = await call({ system, prompt, files });
    return data.choices?.[0]?.message?.content || '';
  },
};
