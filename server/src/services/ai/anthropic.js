const API_URL = 'https://api.anthropic.com/v1/messages';

function buildContent({ prompt, files }) {
  const content = [];
  for (const file of files || []) {
    if (file.mimeType === 'application/pdf') {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file.base64 },
      });
    } else {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: file.mimeType, data: file.base64 },
      });
    }
  }
  content.push({ type: 'text', text: prompt });
  return content;
}

async function call({ system, prompt, files, tool }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY não configurada.');
    err.status = 503;
    throw err;
  }

  const body = {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: buildContent({ prompt, files }) }],
  };
  if (tool) {
    body.tools = [tool];
    body.tool_choice = { type: 'tool', name: tool.name };
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(`Anthropic API error (${response.status}): ${text.slice(0, 500)}`);
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  return data;
}

export const anthropicProvider = {
  name: 'anthropic',

  async generateStructured({ system, prompt, schema, files }) {
    const tool = {
      name: 'record_result',
      description: 'Registra o resultado extraído/gerado no formato estruturado solicitado.',
      input_schema: schema,
    };
    const data = await call({ system, prompt, files, tool });
    const block = data.content?.find((b) => b.type === 'tool_use');
    if (!block) throw new Error('A IA não retornou dados estruturados.');
    return block.input;
  },

  async generateText({ system, prompt, files }) {
    const data = await call({ system, prompt, files });
    const block = data.content?.find((b) => b.type === 'text');
    return block?.text || '';
  },
};
