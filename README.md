# FinançasAI

Sistema financeiro pessoal/SaaS — 100% self-hosted, sem dependência do Base44.

## Stack

- **Frontend**: React + Vite + Tailwind + shadcn/ui (`/`)
- **Backend**: Node.js + Express + Prisma + SQLite (`/server`)
- **Auth**: email/senha com JWT (bcrypt + jsonwebtoken)
- **IA**: adapter plugável (Anthropic Claude ou OpenAI) — opcional, o app funciona sem ele

## Como rodar localmente

Primeira vez:

```bash
# 1. Backend
cd server
cp .env.example .env      # ajuste se quiser (JWT_SECRET, ADMIN_EMAIL, provedor de IA...)
npm install
npx prisma migrate dev    # cria server/prisma/dev.db
npm run seed              # cria os planos "free" e "premium"

# 2. Frontend (na raiz do projeto)
cd ..
npm install
```

Todo dia, para rodar os dois juntos:

```bash
npm run dev:all
```

Isso sobe o backend em `http://localhost:3001` e o frontend em `http://localhost:5173`
(o Vite faz proxy de `/api` e `/uploads` para o backend automaticamente).

Ou rode cada um separado, em dois terminais:

```bash
npm run dev:server   # backend
npm run dev          # frontend
```

## Primeiro acesso

Abra `http://localhost:5173`, clique em "Criar conta" e registre-se com seu email/senha.
**O primeiro usuário cadastrado vira administrador automaticamente** (ou qualquer email igual
a `ADMIN_EMAIL` no `server/.env`). Isso dá acesso ao Painel Admin e a Planos & Preços.

## Habilitando IA (opcional)

As funcionalidades de IA (OCR de comprovante/fatura, transação por voz/texto, resumo mensal,
consultoria financeira, importação de extrato) ficam desabilitadas até você configurar um
provedor em `server/.env`:

```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

ou

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Sem isso configurado, essas telas mostram um erro amigável explicando que a IA não está
configurada — o resto do app funciona normalmente.

## Estrutura

```
src/            frontend (React)
  api/          cliente HTTP para o backend (entities.js, integrations.js, apiClient.js)
  entities/     shims de compatibilidade (import { X } from '@/entities/X')
  pages/        páginas da aplicação
server/         backend (Express + Prisma)
  prisma/       schema.prisma + migrations + dev.db
  src/routes/   rotas da API (auth, entities genérico, upload, ai, users, subscription-plans)
  src/services/ lógica de negócio (entityConfig, adapters de IA, prompts)
  uploads/      arquivos enviados (comprovantes, faturas) — local, não versionado
```

## Segurança

Toda entidade é isolada por usuário no backend (nunca no cliente) — o `user_id` do dono é
sempre derivado do token JWT autenticado, nunca aceito do corpo da requisição. Rotas de admin
(`/api/users`, escrita em `/api/subscription-plans`) exigem `role: "admin"` verificado no
servidor.

## Bot do WhatsApp

Não usa a API oficial da Meta — conecta via WhatsApp Web (biblioteca
[Baileys](https://github.com/WhiskeySockets/Baileys)), pareando por QR Code direto no
Painel Admin do app (`/api/whatsapp/*`, `server/src/whatsapp/`). A sessão fica salva ao
lado do banco SQLite, então sobrevive a redeploys sem precisar de um segundo volume.

Fluxo: o usuário manda uma foto/PDF de comprovante ou fatura para o número conectado; o
bot identifica o remetente pelo `whatsapp_number` cadastrado em Configurações > Alertas,
roda o mesmo adapter de IA usado no OCR de comprovantes, e lança a transação automaticamente
na conta da pessoa — respondendo com um resumo do que foi registrado.
