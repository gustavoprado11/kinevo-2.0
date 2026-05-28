# Landing pública do trainer + captação de leads

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto

Hoje o personal trainer no Kinevo não tem onde apontar potenciais alunos vindos do Instagram, indicação ou Google. Manda PDF, planilha de WhatsApp, ou Calendly genérico. O Kinevo já entregou a marca do estúdio (logo, cor, nome) em `/settings` — mas essa marca só existe **dentro** do app do aluno, não tem vitrine pública.

Essa spec cria uma **landing page pública por trainer** (`kinevoapp.com/com/[slug]`) e o ciclo de captação → notificação → conversão de leads em alunos. É o primeiro mecanismo do Kinevo que ajuda o trainer a **conseguir** novos alunos — o que destrava o ciclo virtuoso (trainer cresce → trainer paga mais → trainer fica preso).

Reaproveita a marca já configurada (logo, cor, nome). O HTML de referência aprovado está em `~/Desktop/kinevo-landing-trainer.html`.

## Objetivo

1. Trainer publica sua landing em **menos de 5 min** após o onboarding da marca.
2. Lead que abre a landing → preenche form → trainer recebe notificação imediata + atende via WhatsApp em < 1h.
3. Trainer gerencia leads dentro do Kinevo (web + mobile Trainer Mode).
4. Trainer mede conversão (leads recebidos × convertidos em alunos).

## Escopo

### Incluído
- Tabela `trainer_leads` + `trainers.public_slug` + `trainers.landing_*` (campos de conteúdo da landing).
- Página pública `(public)/com/[slug]/page.tsx` — Server Component, sem auth.
- Server action `submitTrainerLead` com rate-limit, honeypot, validação Zod.
- Tela de **edição da landing** em `/landing` (editor + preview lado a lado).
- Card de entrada em `/settings` (link pra editor + status publicada/rascunho).
- Tela de **leads** em web (`/leads`) e mobile Trainer Mode.
- Notificação ao trainer (push + linha em `trainer_notifications`) ao receber lead.
- Conversão de lead → student (pré-preenche `create-student` com dados do lead).
- Brand-aware: a landing usa `brand_color`, `brand_logo_url`, `brand_name` já existentes.

### Excluído
- Custom domains (`coachgustavo.com.br`) — apenas slug em `kinevoapp.com/com/[slug]`.
- A/B testing de landings (uma landing por trainer).
- Email transacional (Resend/Postmark) — push + in-app cobrem MVP; e-mail vira fast-follow.
- SEO/OG customizável — derivamos meta tags do trainer (sensible defaults).
- Reviews/depoimentos com sistema real (depoimentos são manuais nessa versão).
- Métricas avançadas (page views, funil) — só lead count + conversion básico.
- Multi-idioma. Português apenas.
- Captação via QR code estampado / impressão — fora desta spec.

## Arquivos Afetados

### Novos
- `supabase/migrations/166_trainer_leads.sql`
- `supabase/migrations/167_trainer_landing_fields.sql`
- `web/src/actions/leads/submit-trainer-lead.ts` (server action pública, com rate-limit)
- `web/src/actions/leads/update-lead-status.ts`
- `web/src/actions/leads/convert-lead-to-student.ts`
- `web/src/actions/trainer/update-landing.ts`
- `web/src/actions/trainer/update-slug.ts` (checa disponibilidade, validação)
- `web/src/app/(public)/com/[slug]/page.tsx` (Server Component)
- `web/src/app/(public)/com/[slug]/_components/` (LeadForm, HeroSection, etc.)
- `web/src/app/(public)/com/[slug]/not-found.tsx`
- `web/src/app/landing/page.tsx` (editor: editor + preview)
- `web/src/app/landing/_components/` (LandingEditor, sections, PreviewIframe)
- `web/src/app/leads/page.tsx` (lista)
- `web/src/app/leads/[id]/page.tsx` (detalhe)
- `web/src/components/settings/landing-section.tsx` (card em /settings com link pro editor)
- `web/src/lib/landing/slug.ts` (slugify + reserved list)
- `web/src/lib/landing/defaults.ts` (headlines, FAQ defaults)
- `mobile/app/(trainer-tabs)/leads.tsx` (nova aba mobile no Trainer Mode)
- `mobile/components/trainer/leads/LeadCard.tsx`
- `mobile/components/trainer/leads/LeadDetailSheet.tsx`
- `mobile/hooks/useLeads.ts`

### Editados
- `web/src/app/settings/page.tsx` (renderiza `LandingSection` na seção 02 "Sua marca" ou nova seção)
- `web/src/middleware.ts` (whitelist da rota pública `/com/*`)
- `web/src/lib/push-notifications.ts` (novo evento `new_lead`)
- `web/src/actions/create-student.ts` (aceita `from_lead_id` opcional pra rastrear conversão)
- `mobile/app/(trainer-tabs)/_layout.tsx` (5 abas → 6 abas, ou substitui uma)

## Comportamento Esperado

### Fluxo do Usuário — Lead (potencial aluno)

1. Lead vê o link `kinevoapp.com/com/gustavo-prado` na bio do Instagram do trainer.
2. Abre no celular. Landing carrega em < 2s, com a marca do trainer (logo, cor, nome).
3. Rola: hero, credenciais, números, mockups do app, processo, depoimentos, FAQ.
4. Preenche form: nome, e-mail, WhatsApp, objetivo (chip), nível (chip), mensagem opcional.
5. Clica em **Enviar mensagem** → button vira "Mensagem enviada ✓" (state local).
6. Vê confirmação inline: "Recebi sua mensagem, retorno em até 24h. — Gustavo".

### Fluxo do Usuário — Trainer (recebendo o lead)

1. Trainer ouve push: **"🔔 Novo lead — Pedro · meta: emagrecer"**.
2. Tap → abre Kinevo direto na tela do lead: nome, contato, objetivo, nível, mensagem, hora.
3. Botão primário **"Falar no WhatsApp"** abre `wa.me/<whatsapp>?text=Oi%20<nome>%2C%20vi%20que...`.
4. Trainer marca como **Contatado**. Status do lead atualiza.
5. Quando converte: botão **"Converter em aluno"** → abre `create-student` com dados pré-preenchidos do lead.
6. Após criar aluno: lead fica com status `converted` + link pro student.

### Fluxo do Usuário — Trainer (configurando a landing)

1. No `/settings`, vê card **"Sua landing pública"** com status (Rascunho / Publicada · X visitas) + URL + botão "Editar".
2. Clica em "Editar" → vai pra `/landing`.
3. Editor em 2 colunas:
   - Esquerda: accordion de seções (Identidade · Hero · Credenciais · Especializações · Depoimentos · Preço · FAQ · Visibilidade).
   - Direita: preview ao vivo (iframe do `/com/[slug]?preview=true`).
4. Configura URL pública (slug): default `nome-sobrenome`; checa disponibilidade em tempo real.
5. Preenche/edita conteúdo das seções. Cada save é incremental (auto-save 1s debounce).
6. Toggle **Publicar** no topo. Publicada → URL fica acessível; despublicada → 404.

### Fluxo Técnico

**Submissão de lead (público, sem auth):**
1. Form submete → server action `submitTrainerLead({slug, name, email, whatsapp, goal, level, message, hp})`.
2. Rate-limit: 5 submissões por IP por hora (existing `lib/rate-limit.ts`).
3. Honeypot field (`hp`): se preenchido, descarta silenciosamente (bot).
4. Zod valida shape + tamanhos (anti-spam: msg max 1000 chars).
5. `supabaseAdmin.from('trainers').select('id').eq('public_slug', slug).eq('landing_published', true).single()` → resolve trainer.
6. Se trainer não existe ou landing despublicada → retorna sucesso fake (não vaza info).
7. `supabaseAdmin.from('trainer_leads').insert({...})` (service role pra bypassar RLS já que lead não tá autenticado).
8. `supabaseAdmin.from('trainer_notifications').insert({trainer_id, type:'new_lead', payload, action_url:'/leads/<id>'})`.
9. Dispara push: chamada à `lib/push-notifications.ts` com tokens registrados do trainer (categoria `new_lead`, deeplink `/leads/<id>`).
10. Retorna `{success: true}` em < 500ms.

**Gerenciamento de leads (autenticado, RLS):**
- Trainer só vê os próprios via policy `trainer_leads_own (trainer_id = current_trainer_id())`.
- Lista `/leads` ordenada por `created_at DESC`, filtros: status, período.
- Detalhe `/leads/[id]` com botão "WhatsApp", "Marcar contatado", "Converter em aluno", "Arquivar".

**Conversão lead → aluno:**
1. Trainer clica "Converter em aluno" → server action `convertLeadToStudent(leadId)`.
2. Action redireciona pra `/students/new?from_lead=<id>` com query params pré-preenchidos.
3. Form de create-student carrega dados do lead. Trainer ajusta o que precisa.
4. Ao salvar student: update lead `status='converted'`, `converted_to_student_id=<student.id>`.

## Modelo de Dados

### Migration 166 — `trainer_leads`

```sql
CREATE TABLE IF NOT EXISTS public.trainer_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id    UUID NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  whatsapp      TEXT NOT NULL,
  goal          TEXT,
  level         TEXT,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new','contacted','converted','archived')),
  source        TEXT NOT NULL DEFAULT 'landing_public',
  source_slug   TEXT,
  ip_hash       TEXT,
  user_agent    TEXT,
  contacted_at  TIMESTAMPTZ,
  converted_to_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trainer_leads_owner ON public.trainer_leads (trainer_id, created_at DESC);
CREATE INDEX idx_trainer_leads_status ON public.trainer_leads (trainer_id, status, created_at DESC);
CREATE INDEX idx_trainer_leads_ip ON public.trainer_leads (ip_hash, created_at DESC);

ALTER TABLE public.trainer_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY trainer_leads_own ON public.trainer_leads
  FOR ALL USING (trainer_id = current_trainer_id())
  WITH CHECK (trainer_id = current_trainer_id());
```

### Migration 167 — campos da landing em `trainers`

```sql
ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS public_slug         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS landing_published   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS landing_headline    TEXT,
  ADD COLUMN IF NOT EXISTS landing_subheadline TEXT,
  ADD COLUMN IF NOT EXISTS landing_bio         TEXT,
  ADD COLUMN IF NOT EXISTS landing_city        TEXT,
  ADD COLUMN IF NOT EXISTS landing_cref        TEXT,
  ADD COLUMN IF NOT EXISTS landing_certifications  TEXT[],
  ADD COLUMN IF NOT EXISTS landing_specializations TEXT[],
  ADD COLUMN IF NOT EXISTS landing_year_started INT,
  ADD COLUMN IF NOT EXISTS landing_stats        JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_testimonials JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_price_label  TEXT,
  ADD COLUMN IF NOT EXISTS landing_faq          JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_hero_image_url TEXT;

-- Slug pode ter apenas a-z, 0-9, hífen; min 3 max 40 chars.
ALTER TABLE public.trainers
  DROP CONSTRAINT IF EXISTS trainers_public_slug_format_chk,
  ADD CONSTRAINT trainers_public_slug_format_chk
    CHECK (public_slug IS NULL OR public_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$');

-- Permite leitura pública dos campos de landing quando publicada.
-- Já existe policy "Students can view their trainer" (migration 091).
-- Nova policy aditiva para leitura anônima da landing publicada.
CREATE POLICY trainers_public_landing_read ON public.trainers
  FOR SELECT
  USING (landing_published = true);
```

> **Atenção segurança:** a policy `trainers_public_landing_read` permite leitura anônima (qualquer um) de **todas** as colunas da row do trainer. Não temos column-level RLS no Postgres, então a página pública deve usar `supabaseAdmin` com `select` explícito limitado às colunas `landing_*` + `brand_*` + `name`, `avatar_url`, `instagram_handle` — **nunca** `email`, `theme`, `auth_user_id`, etc. Documentar no comment da policy.

### Slugs reservados

`lib/landing/slug.ts` exporta `RESERVED_SLUGS`:

```
admin, api, app, auth, blog, cdn, dashboard, docs, email, estudio,
financial, help, leads, login, logout, mail, oauth, pricing, privacy,
settings, signup, students, studio, support, terms, test, www
```

Mais `kinevoapp`, `kinevo`, e variações.

## Onde o trainer configura a landing

### Entrada principal: `/settings` → "Sua landing pública"

Card novo no `/settings` (na seção 02 "Sua marca" abaixo do BrandingSection, ou em seção própria se o eyebrow numerado precisar):

```
┌─────────────────────────────────────────────┐
│ 🌐 Sua landing pública     [Rascunho]      │
│ kinevoapp.com/com/gustavo-prado  📋        │
│                                              │
│ Compartilhe esse link na bio do Instagram   │
│ e capture novos alunos automaticamente.     │
│                                              │
│                            [Editar landing →]│
└─────────────────────────────────────────────┘
```

Estados:
- **Não publicada** (default): badge `Rascunho` + CTA "Editar landing" + URL desabilitada visualmente.
- **Publicada**: badge `Publicada` verde + métrica leve ("12 leads · 3 esta semana") + ícone copy.

### Editor dedicado: `/landing`

Página própria pra a edição rica. Layout dois-painéis:

**Esquerda (40% da viewport):**
- Top bar: status (Rascunho/Publicada) + URL + toggle Publish + botão "Abrir landing".
- Accordion de seções:
  1. **Identidade & URL** — slug (com checker), city, headline curta opcional.
  2. **Hero** — headline grande, subheadline, foto de capa opcional (override do avatar).
  3. **Credenciais** — CREF, certificações (lista), ano de início.
  4. **Especializações** — multi-select de chips (lista predefinida + custom).
  5. **Números** — stats (students_count, years, rating) — manual ou auto-derivado.
  6. **Depoimentos** — lista de `{name, photo_url, quote, role, goal}`.
  7. **Plano** — `landing_price_label` (ex.: "R$ 380/mês" ou "Sob consulta").
  8. **FAQ** — lista editável de Q&A. Defaults pré-preenchidos (preço, remoto, cancelamento, equipamento).
  9. **Visibilidade & SEO** — toggle de seções, meta title/description (avançado, recolhido por default).

Cada seção tem auto-save (debounce 800ms) — sem botão "salvar". Indicador `Salvo · agora há pouco` no header.

**Direita (60% da viewport):**
- Preview ao vivo do `/com/[slug]?preview=true` em iframe.
- Toggle responsivo: Desktop / Mobile (default mobile).
- Refresh quando dados de seção mudam (debounce + revalidate da preview route).

### Botão "Publicar"

- Pre-flight checklist (modal antes de publicar):
  - Slug definido ✓
  - Headline preenchida ✓
  - Foto de hero ou avatar ✓
  - WhatsApp do trainer no perfil (pra usar como contact fallback) ✓
- Marca `landing_published = true`.
- Mostra modal de sucesso com a URL + botões "Copiar link" e "Abrir no Instagram".

### O que NÃO entra na configuração

- Cor da marca, logo, nome do estúdio — JÁ configurados em `/settings` → "Sua marca". O editor da landing puxa essas variáveis automaticamente. Se trainer quiser mudar, volta em "Sua marca".
- Avatar do trainer — JÁ está no Perfil. Foto de hero pode override, mas avatar é o default.

## Surfaces resumidas

| Rota | Tipo | Função |
|---|---|---|
| `/com/[slug]` | Pública (no auth) | Landing page do trainer |
| `/com/[slug]?preview=true` | Pública mas com banner "Preview" | Render igual mas com badge "Modo preview" |
| `/landing` | Trainer auth | Editor da landing |
| `/leads` | Trainer auth | Lista de leads |
| `/leads/[id]` | Trainer auth | Detalhe do lead |
| `/settings` | Trainer auth | Card de entrada pra editor da landing |
| `mobile (trainer-tabs)/leads` | Trainer auth | Lista mobile no Trainer Mode |

## Notificação ao trainer

Quando lead é submetido:

1. **`trainer_notifications`** (tabela existente) — insere row com `type='new_lead'`, `title`, `body`, `action_url='/leads/{id}'`. Alimenta o sino in-app na sidebar do web e no header mobile.
2. **Push notification** via Expo Push Service usando tokens em `push_tokens`:
   - Title: `Novo lead 🔔`
   - Body: `<name> · meta: <goal>`
   - Data: `{leadId, deeplink: 'kinevo://leads/<id>'}`
3. Não há e-mail nessa versão (fast-follow se demanda exigir).

## Critérios de Aceite
- [ ] Lead anônimo submete form em `/com/<slug>` → trainer recebe push em < 30s.
- [ ] Card "Sua landing pública" aparece em `/settings` com status correto.
- [ ] Editor `/landing` salva incremental por seção (sem botão "save").
- [ ] Preview iframe atualiza dentro de 1s após edição (debounce).
- [ ] Slug validado: lowercase, hífen, sem reservados, único por trainer.
- [ ] Landing despublicada retorna 404 (não vaza dados).
- [ ] Lead com slug inexistente recebe success fake (não vaza enumeração).
- [ ] Rate limit funcional (5 submissions/hora/IP).
- [ ] Honeypot descarta bots sem erro visível.
- [ ] Conversão lead → student preserva `from_lead_id` no student record (auditoria).
- [ ] Mobile Trainer Mode mostra aba/seção Leads com contador.
- [ ] RLS isolada: trainer A não vê leads do trainer B.
- [ ] Brand-aware: trocar `brand_color` em `/settings` reflete na landing.
- [ ] Sem novos erros de TypeScript.
- [ ] Retrocompatível com migrations existentes (164, 165).
- [ ] Testado no fluxo principal: trainer cria slug → publica → lead submete → trainer recebe → converte.

## Restrições Técnicas
- Seguir convenções documentadas no `web/CLAUDE.md` (Server Actions p/ mutations, supabaseAdmin com cuidado, etc).
- A landing pública DEVE ser Server Component com revalidação ISR de 60s pra balance entre frescura e performance.
- Não usar `supabase` (client) na página pública — só `supabaseAdmin` com select restrito a colunas seguras (audit anti-leak).
- Slug fica em `trainers.public_slug` (UNIQUE, opcional). Trainer pode operar sem slug (landing simplesmente não publicada).
- O fluxo de notificação não pode bloquear o submit do form: se push falhar, o lead AINDA é gravado e o trainer vê em `/leads`.
- Mobile: nova aba `Leads` no `(trainer-tabs)/_layout.tsx`. Se 5 abas virarem 6, considerar substituir uma menos usada por menu "Mais".

## Edge Cases

- **Slug colide**: o picker mostra "Indisponível" e sugere variações automáticas (`gustavo-prado-2`, `gustavo-bh`).
- **Trainer arquivado/cancelado**: landing volta a 404 automaticamente (gate em `landing_published AND subscription_active`).
- **Lead reenvia o mesmo form**: rate-limit + dedup soft por (trainer_id, email, whatsapp, < 5min) → não insere duplicata, retorna success.
- **Trainer despublicou enquanto lead estava preenchendo**: submit gracioso (success fake) — o lead nunca cai num erro vergonhoso.
- **Foto/logo quebrados**: fallback de iniciais (já temos pattern em BrandingSection).
- **Sem `brand_color` setado**: usa roxo Kinevo padrão (consistente com regra atual).
- **Slug com acento/maiúscula**: normaliza no input antes de validar.
- **Push falha (token expirado)**: trainer ainda recebe `trainer_notifications` no sino + email (futuro).

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] `lib/landing/slug.ts`: `slugify(name)`, `isReserved(slug)`, `isValid(slug)` com casos de borda (acentos, espaços, hífen consecutivo, reservados).
- [ ] `lib/landing/defaults.ts`: shape de FAQ default e headline default; merge com config do trainer.
- [ ] `lib/leads/dedup.ts`: detecta duplicata por (trainer_id, email, whatsapp, < 5min).

### Server Actions (recomendado)
- [ ] `submitTrainerLead`: happy path, rate-limit, honeypot, slug inexistente, despublicada, dedup.
- [ ] `updateLanding`: validação de slug, conflito de slug, ownership.
- [ ] `convertLeadToStudent`: cria student com `from_lead_id`, marca lead como `converted`, idempotente.
- [ ] `updateLeadStatus`: transições válidas, ownership.

### Componentes (apenas fluxos críticos)
- [ ] `LeadForm`: validação client-side + estado de submit/sucesso/erro.
- [ ] `SlugInput`: debounce check, disponibilidade visual, normalização.

## Plano de Build (marcos)

> **STATUS: CONCLUÍDO (M1–M6) — 2026-05-28.** Entregue + em produção.
> A implementação consolidou tudo num hub `/marketing` (Visão geral · Leads ·
> Landing), não previsto no plano original. Desvios anotados por marco.

**M1 — Foundation (DB + slugs)** ✅
- Migrations 166 + 167 aplicadas via MCP.
- `lib/landing/slug.ts` + tests.
- Server action `updateSlug` + checker de disponibilidade.
- Card em `/settings` (depois movido pro hub `/marketing/landing` no M6).

**M2 — Landing pública mínima** ✅
- Rota `(public)/com/[slug]/page.tsx` renderizando o mock (SELECT por colunas
  explícitas, sem PII; ISR 60s; brand-aware via CSS vars).
- Server action `submitTrainerLead` com rate-limit + honeypot + dedup soft.
- Tabela `trainer_leads` recebendo inserts.

**M3 — Notificação e gerenciamento** ✅
- `trainer_notifications` + push notification ao receber lead.
- Página de leads (lista + drawer + status + WhatsApp).
- Tela mobile (`app/leads/index.tsx`, acessada via "Mais") + badge unread.

**M4 — Editor da landing** ✅
- Página com form (cabeçalho/sobre/credenciais/especializações/plano) +
  preview iframe (mobile/desktop), dirty tracking, ⌘S.
- Desvio: salvar é manual (botão/⌘S), não auto-save incremental por seção.
- Desvio: pre-flight checklist no publish ficou fora (não priorizado).

**M5 — Conversão** ✅
- `convertLeadToStudent` (web + mobile): dedup por e-mail, cortesia via
  `createStudent`/edge function, idempotente, `converted_to_student_id`.
- Métrica de conversão visível na Visão geral do hub (KPIs).

**M6 — Polish & launch** ✅
- Onboarding: milestone "Publicar sua landing" no checklist do trainer.
- Guia "Como divulgar" com QR code no hub.
- Polish de microcópia/estados pós-consolidação.
- Desvio: E2E Playwright fora (sem infra); cobertura por unit tests
  (color, format, schemas) + build verde.

**Extra — Hub `/marketing`** ✅
- Consolidou Leads + Landing + Visão geral num só lugar; redirects de
  `/leads` e `/landing`; item único na sidebar.

**Bug corrigido no caminho:** migration 168 adicionou `'read'` ao CHECK de
`trainer_leads.status` (o M3 marcava lead como 'read' ao abrir, mas o CHECK
original não permitia — falha latente).

## Métricas de sucesso (pós-launch)

- **% de trainers ativos com slug definido** (DoD ≥ 50% em 30 dias).
- **% de slugs publicados** (DoD ≥ 30%).
- **Tempo médio de resposta a lead** (DoD < 4h em 50% dos casos).
- **% conversão lead → aluno** (DoD ≥ 15%).
- **# de leads / trainer / mês** (visibilidade de tração — sem meta dura).

## Riscos & mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Spam/bot floods | Alta | Rate-limit + honeypot + Zod + dedup soft |
| Slugs ofensivos | Média | Lista reservados + manual review na alpha |
| Trainer publica sem dados → landing fraca | Média | Pre-flight checklist + defaults sensatos |
| Lead recebe push e trainer não responde | Alta | Métrica de "tempo de resposta" exposta + nudge na semana 2 |
| Vazamento de PII via SELECT amplo | Baixa | Audit no `supabaseAdmin` da página pública: select por colunas explícitas |
| Push falha silenciosamente | Média | `trainer_notifications` é fonte da verdade; push é só UX layer |

## Referências
- Mock HTML aprovado: `~/Desktop/kinevo-landing-trainer.html`.
- Spec da marca (já entregue): `project_kinevo_branding_personal` (memory).
- TrainerCardHero real (inspiração visual): `mobile/app/(tabs)/inbox.tsx` linha ~497.
- Padrão de Server Actions: `web/CLAUDE.md` § Convenções.
- Push infra existente: `web/src/lib/push-notifications.ts`.

## Notas de Implementação
(Preenchido durante execução.)
