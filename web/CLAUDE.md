# CLAUDE.md — Kinevo Web Dashboard

> Este arquivo é o contexto persistente para qualquer instância do Claude que trabalhe neste repositório.
> Leia INTEIRO antes de executar qualquer tarefa. Não questione decisões de arquitetura aqui documentadas.

---

## Visão Geral

Kinevo Web Dashboard é o painel do personal trainer. Permite gerenciar alunos, prescrever programas de treino (com motor de IA), gerenciar financeiro/assinaturas, enviar formulários, trocar mensagens e acompanhar treinos em tempo real.

**Monorepo:** Este repo é o workspace `web` dentro de `kinevo-monorepo`. Os workspaces são `web`, `mobile` e `shared`.

---

## Stack e Versões

| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | 16.1.6 | Framework (App Router) |
| React | 19.1.0 | UI |
| TypeScript | 5.x | Tipagem estrita |
| Tailwind CSS | 4.x | Estilização (com CSS variables) |
| Supabase SSR | 0.8.0 | Auth + DB client |
| Supabase JS | 2.94.0 | Client base |
| Zustand | 5.0.11 | Estado global (4 stores) |
| Stripe | 20.3.1 | Pagamentos e Connect |
| Framer Motion | 12.34.0 | Animações |
| Lucide React | 0.563.0 | Ícones |
| AI SDK (Vercel) | 4.3.19 | Integração LLM |
| @anthropic-ai/sdk | 0.39.0 | Claude (prescrição IA) |
| @ai-sdk/openai | 1.3.24 | GPT-4o-mini (formulários) |
| React Compiler | 1.0.0 | Otimização automática |
| next-themes | 0.4.6 | Dark/light mode |
| @dnd-kit | 6.3.1 / 10.0.0 | Drag & drop (exercícios) |

---

## Estrutura de Pastas

```
src/
├── app/                    ← App Router (páginas e API routes)
│   ├── layout.tsx          ← Root layout (ThemeProvider)
│   ├── page.tsx            ← Landing page pública
│   ├── globals.css         ← Sistema de design (CSS variables + Tailwind v4)
│   ├── (auth)/             ← Login, signup, forgot/update-password
│   ├── dashboard/          ← Painel principal do treinador
│   ├── students/           ← Gestão de alunos
│   │   └── [id]/           ← Perfil, prescrição, programas
│   ├── programs/           ← Templates de programa
│   ├── exercises/          ← Biblioteca de exercícios
│   ├── forms/              ← Templates de formulário + inbox de respostas
│   ├── messages/           ← Chat treinador ↔ aluno
│   ├── training-room/      ← Interface de treino ao vivo
│   ├── financial/          ← Planos, assinaturas, billing
│   ├── settings/           ← Configurações do treinador
│   └── api/                ← Route handlers (30+)
│       ├── assistant/chat/ ← Endpoint do chat IA
│       ├── prescription/   ← Geração de programas
│       ├── webhooks/stripe/← Webhook handler (Stripe v20+)
│       ├── cron/           ← Jobs agendados (push, forms, expiração)
│       └── notifications/  ← Push tokens, preferências
│
├── components/             ← 130+ componentes React
│   ├── ui/                 ← Base UI (button, skeleton, tooltip)
│   ├── landing/            ← Landing page
│   ├── settings/           ← Tela de configurações
│   ├── messages/           ← Interface de chat
│   ├── forms/              ← Form builder/viewer
│   ├── financial/          ← Componentes de billing
│   ├── assistant/          ← Chat IA
│   └── theme-provider.tsx  ← next-themes com forçamento por rota
│
├── actions/                ← Server Actions (~8.000 LOC)
│   ├── create-student.ts   ← Criação de aluno (com auth)
│   ├── prescription/       ← Pipeline de prescrição
│   ├── financial/          ← Operações de billing
│   ├── forms/              ← Gerência de formulários
│   ├── programs/           ← Atribuição de programas
│   ├── training-room/      ← Atualizações de treino ao vivo
│   └── onboarding/         ← Estado de onboarding
│
├── lib/                    ← Utilitários e lógica de negócio
│   ├── supabase/           ← Clientes Supabase (client, server, admin, middleware)
│   ├── prescription/       ← Motor de prescrição IA (26 arquivos, ~15K LOC)
│   ├── stripe/             ← Inicialização Stripe
│   ├── push-notifications.ts
│   ├── rate-limit.ts
│   └── z-index.ts          ← Constantes de z-index
│
├── hooks/                  ← Hooks customizados
│   ├── use-muscle-groups.ts ← CRUD de grupos musculares
│   └── use-spotlight-position.ts
│
├── stores/                 ← Zustand stores
│   ├── onboarding-store.ts  ← Tour + milestones (persistido no server)
│   ├── sidebar-store.ts     ← Estado da sidebar
│   ├── training-room-store.ts ← Estado do treino ao vivo
│   └── assistant-chat-store.ts ← Conversa do chat IA
│
└── types/                  ← Tipos TypeScript locais
    ├── messages.ts          ← Message, Conversation
    ├── exercise.ts          ← MuscleGroup, Exercise
    └── financial.ts         ← DisplayStatus, FinancialStudent, ContractEventType
```

---

## Convenções de Código

### Componentes React

- **Server Components** são o padrão. Use para data fetching (páginas, layouts).
- **Client Components** (`'use client'`) apenas quando necessário: interatividade, hooks de estado, event handlers.
- **Naming:** PascalCase para componentes, kebab-case para arquivos (`student-modal.tsx`).
- **Imports:** `@/` para paths relativos ao `src/`. `@kinevo/shared/` para tipos compartilhados.

### Server Actions

- Prefixo `'use server'` no topo do arquivo.
- Sempre validam autenticação (`supabase.auth.getUser()`) antes de qualquer operação.
- Usam `supabaseAdmin` (service role) para operações privilegiadas (criar auth users, bypass RLS).
- Retornam objetos tipados `{ success: boolean, error?: string, data?: T }`.

### Estilização

- **Tailwind CSS v4** com `@import "tailwindcss"` no globals.css.
- **CSS Variables semânticas** definidas em `:root` (light) e `.dark` (dark mode).
- **Shield Strategy:** Componentes existentes usam hex hardcoded propositalmente. NÃO migrar para variáveis — isso previne regressões visuais.
- **Apple HIG no light mode:** Background #F5F5F7, texto #1D1D1F, primary #007AFF (Apple blue).
- **Dark mode:** Background #09090B, primary #8b5cf6 (Violet).
- **Animações customizadas:** `shimmer`, `float-slow`, `pulse-soft`, `shake` definidas no globals.css.
- **Z-index system:** Usar variáveis CSS (`--z-sticky`, `--z-header`, `--z-sidebar`, `--z-modal`, `--z-tooltip`).

### TypeScript

- **Strict mode ativado.**
- Tipos do banco via `@kinevo/shared/types/database` (auto-gerado com `npm run gen:types`).
- Path aliases: `@/*` → `./src/*`, `@kinevo/shared/*` → `../shared/*`.

### Ícones

- **Lucide React** exclusivamente. Nunca usar emoji como ícone.
- Import: `import { IconName } from 'lucide-react'`.

---

## Integrações

### Supabase

Três clientes distintos em `lib/supabase/`:

| Client | Arquivo | Uso | RLS |
|---|---|---|---|
| Browser | `client.ts` | Componentes `'use client'` | ✅ Respeita |
| Server | `server.ts` | Server Components + Actions | ✅ Respeita |
| Admin | `admin.ts` | Operações privilegiadas | ❌ Bypassa |

- **Auth:** Cookie-based sessions via `@supabase/ssr`. Middleware renova sessão em cada request.
- **RLS:** Todas as tabelas têm policies. `current_trainer_id()` e `current_student_id()` são helpers SQL.
- **Realtime:** Habilitado em `messages`, `assistant_insights`, `trainer_notifications`.
- **Storage:** Buckets para avatars e mensagens (imagens).

### Stripe

- **Webhook handler** em `api/webhooks/stripe/route.ts` — compatível com Stripe v20+.
- **Eventos tratados:** `checkout.session.completed`, `invoice.payment_succeeded/failed`, `customer.subscription.updated/deleted`.
- **Idempotência:** Tabela `webhook_events` previne processamento duplicado.
- **Retorno:** Sempre 200 OK (mesmo em erro) para evitar retry loops do Stripe.
- **Connect:** Webhook separado em `api/webhooks/stripe-connect/`.

### Motor de IA (Prescrição)

- **26 arquivos em `lib/prescription/`** (~15K LOC).
- Pipeline: `program-builder` → `rules-engine` → `exercise-selector` → `structural-optimizer` → `ai-optimizer` (Claude) → `prompt-builder`.
- **Feature flags** via env: `ENABLE_COMPACT_EXERCISE_POOL`, `ENABLE_SLOT_BASED_BUILDER`, `ENABLE_AI_OPTIMIZER`, `ENABLE_VOLUME_V2`.
- **LLM para forms:** GPT-4o-mini via `OPENAI_API_KEY` (env separada).

### Push Notifications

- `lib/push-notifications.ts` — Firebase/Expo Push Service.
- Cron jobs em `api/cron/` para processar fila e validar receipts.
- Registro de token via `api/notifications/register-token`.

---

## Middleware

```typescript
// src/middleware.ts
// Roda em TODA request exceto: _next/static, _next/image, favicon, api/webhooks, api/cron, api/financial, api/notifications, assets
// Função: updateSession() renova cookies de auth do Supabase
```

**Rotas públicas:** `/`, `/login`, `/signup`, `/auth/*`, `/privacy`, `/terms`, `/android`.
**Rotas protegidas:** Todo o resto redireciona para `/login` se não autenticado.

---

## Zustand Stores

| Store | Persistência | Uso |
|---|---|---|
| `onboarding-store` | Sync com server (debounce 800ms) | Tours, milestones, checklist |
| `sidebar-store` | Local | Estado aberto/fechado da sidebar |
| `training-room-store` | Local | Sessão de treino ao vivo |
| `assistant-chat-store` | Local | Histórico de conversa IA |

---

## Regras Invioláveis

1. **Zero novos erros de TypeScript.** O build deve passar limpo.
2. **Sem `any`.** Use tipos explícitos ou `unknown` com type guards.
3. **Mudanças cirúrgicas.** Nunca reescrever código que já funciona. Altere apenas o necessário.
4. **Retrocompatibilidade obrigatória.** Toda mudança deve manter funcionalidades existentes.
5. **Shield Strategy.** Não migrar hex hardcoded para variáveis CSS em componentes existentes.
6. **Ícones = Lucide.** Nunca emoji. Nunca outro icon pack.
7. **Server Actions para mutações.** Não criar API routes para operações que podem ser Server Actions.
8. **Admin client só quando necessário.** Preferir o client com RLS. Usar admin apenas para criação de auth users ou operações que exigem bypass de RLS.
9. **Webhook idempotência.** Todo novo webhook handler deve checar `webhook_events` antes de processar.
10. **Feature flags.** Novas features do motor de prescrição devem ter flag em `.env`.

---

## Decisões de Arquitetura (não questionar)

- **Next.js App Router** (não Pages Router).
- **React Compiler** habilitado — não precisa de `useMemo`/`useCallback` manual na maioria dos casos.
- **Turbopack** para dev.
- **Monorepo com npm workspaces** (não Turborepo, não pnpm).
- **Supabase como backend completo** — auth, DB, RLS, Realtime, Storage. Sem backend separado.
- **Server Actions para mutações** — preferência sobre API routes.
- **Motor de prescrição no server** — toda lógica de IA roda no Next.js, não em Edge Functions.
- **Stripe v20+** — `current_period_end` no `SubscriptionItem`, não no `Subscription`.
- **CSS Variables + Tailwind v4** — sistema de design unificado.
- **Sem Edge Functions do Supabase** — toda lógica server-side é Next.js API routes ou Server Actions.
- **91 migrations SQL** — esquema evolui incrementalmente. Nunca reescrever migrations existentes.

---

## Como Criar Novas Features

### Nova Página

1. Criar pasta em `src/app/[rota]/page.tsx` (Server Component por padrão).
2. Se precisar de interatividade, extrair para um Client Component em `src/components/`.
3. Data fetching no Server Component, passar via props.

### Novo Server Action

1. Criar em `src/actions/[domínio]/[ação].ts`.
2. Prefixar com `'use server'`.
3. Autenticar com `createClient()` de `@/lib/supabase/server` + `getUser()`.
4. Retornar `{ success, error?, data? }`.

### Nova API Route

1. Criar em `src/app/api/[path]/route.ts`.
2. Usar apenas para: webhooks, cron jobs, endpoints que precisam de headers específicos.
3. Para mutações normais, preferir Server Actions.

### Novo Componente

1. Arquivo em `src/components/[domínio]/[nome].tsx`.
2. Kebab-case no arquivo, PascalCase no export.
3. Client Component apenas se necessário (`'use client'`).
4. Estilização com Tailwind. Sem CSS modules.

### Nova Migration

1. Usar `supabase migration new [nome]` para criar.
2. Incluir RLS policies para a nova tabela.
3. Incluir índices para FKs e campos de busca.
4. Após aplicar, rodar `npm run gen:types` para atualizar tipos compartilhados.

---

## Variáveis de Ambiente Relevantes

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Stripe
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_CONNECT_WEBHOOK_SECRET

# OpenAI (Forms)
OPENAI_API_KEY
OPENAI_FORMS_MODEL=gpt-4o-mini
FORMS_AI_LLM_ENABLED=true

# Prescrição Feature Flags
ENABLE_COMPACT_EXERCISE_POOL=true
ENABLE_SLOT_BASED_BUILDER=true
ENABLE_BUILDER_FIRST=false
ENABLE_AI_OPTIMIZER=true
ENABLE_VOLUME_V2=true
```

---

## Banco de Dados — Tabelas Principais

> Tipos completos em `shared/types/database.ts`. Gerar com `npm run gen:types`.

| Tabela | Descrição |
|---|---|
| `trainers` | Perfil do treinador (1:1 com auth.users) |
| `students` | Alunos (N:1 com trainers via coach_id) |
| `exercises` | Biblioteca (owner_id NULL = sistema, UUID = treinador) |
| `assigned_programs` | Programas atribuídos a alunos |
| `assigned_workouts` | Treinos dentro de programas |
| `assigned_workout_items` | Exercícios dentro de treinos |
| `workout_sessions` | Sessões de treino (status: in_progress, completed) |
| `set_logs` | Registros de séries (peso, reps) |
| `messages` | Chat assíncrono treinador ↔ aluno |
| `contracts` | Contratos de billing (Stripe) |
| `forms` | Templates de formulário |
| `form_submissions` | Respostas submetidas |
| `student_prescription_profiles` | Perfil para prescrição IA |
| `prescription_generations` | Histórico de gerações IA |
| `assistant_insights` | Insights gerados pelo assistente IA |
| `trainer_notifications` | Notificações in-app do treinador |

---

## Comandos Úteis

```bash
# Dev
npm run dev                    # Start dev server (Turbopack)
npm run build                  # Production build
npm run lint                   # ESLint

# Monorepo (da raiz)
npm run web                    # Alias para dev do web
npm run gen:types              # Regenerar tipos do Supabase

# Supabase
supabase migration new [nome]  # Nova migration
supabase db push               # Aplicar migrations
supabase gen types typescript --project-id $REF > shared/types/database.ts
```

---

## Incidents & Lessons Learned

### 2026-04-07 — Stripe Webhook Disabled (9 days)

**Root cause:** Webhook registered in Stripe Dashboard as `https://kinevoapp.com/api/webhooks/stripe`.
The Vercel domain config redirects `kinevoapp.com → www.kinevoapp.com` with a 307.
Stripe does not follow redirects — every delivery attempt failed silently until auto-disable.

**Impact:** No trainer lost access. The access guard checks `status` only (`trialing` or `active`),
not `current_period_end`. Trainers remained on stale `trialing` status which still passed the gate.
~21 webhook events were lost over 9 days (March 23 – April 7, 2026).

**Fix:**
1. Updated webhook URL in Stripe Dashboard to `https://www.kinevoapp.com/api/webhooks/stripe`
2. Reactivated the endpoint
3. Ran one-off script `scripts/sync-stale-subscriptions.ts` to fetch live state from Stripe
   and upsert all 6 trainer subscriptions (status + current_period_end + cancel_at_period_end)

**Rule:** Any external integration (Stripe, webhooks, third-party services) must always use
`https://www.kinevoapp.com` (with www). Never `https://kinevoapp.com`.
The canonical production domain is `www.kinevoapp.com`.

**Files involved:**
- `web/src/app/api/webhooks/stripe/route.ts` — main webhook handler
- `web/src/lib/get-trainer.ts` — primary access guard (checks status only, not period_end)
