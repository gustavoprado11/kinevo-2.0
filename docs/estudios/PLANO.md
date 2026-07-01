# Kinevo Estúdios — Plano de Ressurreição como Tier B2B

Data: 2026-07-01. Source-of-truth do desenho. Gerado por leitura estática do monorepo (`web/`, `mobile/`, `shared/`, `supabase/`) — estado descrito é o **atual** em produção.

> **Status:** desenho aprovado, aguardando specs executáveis por fase (`SPEC_FASE_X.md`). Nenhuma linha de código escrita ainda.
>
> **Foco (Gustavo, 2026-07-01):** o produto do v1 é um **sistema de gestão do estúdio** — o gestor tem uma visão de gestão, adiciona/gere os seus treinadores, e **acompanha o que eles prescrevem, quantos alunos atendem, frequência dos alunos, aulas dadas e ocupação dos horários**. Reusa o **mesmo esqueleto** web (variante do gestor + aba "Treinadores"). A **camada de IA fica para o Parte 2.**
>
> **Descoberta-chave (auditoria de código, 2026-07-01):** o Estúdios **não é greenfield**. A tentativa anterior deixou muita coisa viva em produção como *drift* (existe no banco, sem migration no repo, sem uso no app): `students.organization_id`, `appointment_groups`, e **três RPCs de KPI de estúdio** (`get_org_coach_load`, `get_org_class_overview`, `get_org_athlete_absences`) que batem quase 1:1 com os KPIs pedidos. Grande parte do v1 é **formalizar e ligar** o que já existe — não construir do zero.

---

## 0. Decisões travadas (Gustavo, 2026-07-01)

| Decisão | Escolha | Implicação |
|---|---|---|
| **Foco do v1** | **Sistema de gestão do estúdio** (não a IA) | A fase-manchete é o **painel de gestão** + aba **Treinadores**. |
| **IA** | **Adiada para o Parte 2** | Herança de *tier de IA* + créditos por seat só no Parte 2. |
| **Escopo v1** | **Completo — com visibilidade cruzada** | Alunos são do estúdio; todos os treinadores acessam todos. |
| **Alunos** | **Pertencem ao estúdio**; `coach_id` = **treinador-responsável** (vinculação reatribuível) | Aluno pode ter (ou não) um treinador responsável; visibilidade default = **open**. |
| **Turmas / ocupação** | **Dentro do v1** | Criar turma + matricular aluno + KPI de ocupação entram no v1 (P1.4). |
| **Plataforma do painel do gestor** | **Web primeiro** | Painel + aba Treinadores só no web no v1; gestor no mobile → Parte 2. |
| **Financeiro** | **Fora do v1**; quando entrar, é **do estúdio, não do treinador** | Estúdio = uma entidade financeira (a org), desacoplada do wallet Asaas per-treinador. |
| **Onboarding** | **Dedicado do gestor** (novo); do treinador **inalterado** | Ramifica pelo mesmo mecanismo do `modality_focus`. |
| **Billing** | **Seat no nível da org** | Dono paga Stripe `quantity = seats`; coaches herdam **acesso**, não pagam individual. |

### A distinção que orienta o faseamento: **acesso ≠ IA**

Hoje o `getAiTier` mistura num único "tier": (a) **acesso ao núcleo** (alunos ilimitados, prescrever, agenda) e (b) **features de IA** (Assistente, créditos). Um coach em `'free'` fica preso em 1 aluno *e* sem IA. O coach do estúdio precisa **entrar e prescrever já no Parte 1** — isso é **acesso**, não IA. Portanto:
- **Parte 1:** a org concede ao coach **acesso ao núcleo** (produto completo **sem IA**) via override de *acesso*. O `getAiTier` **não é tocado**.
- **Parte 2:** a camada de IA (herança de tier + créditos por seat) entra por cima.

---

## 1. O que já existe hoje (ancorado em arquivos)

### Fundação viva (inclusive drift a formalizar)

| Peça | Estado | Arquivo |
|---|---|---|
| Tabelas `organizations` / `organization_members` / `appointment_groups` + RLS | ✅ vivas em prod | `migrations/157_baseline_orphan_tables.sql` |
| Helpers SQL `is_org_member` / `is_org_manager` | ✅ | `migrations/157:133-165` |
| **`students.organization_id`** (FK nullable → organizations) | ✅ **já existe** (âncora aluno→estúdio) | `shared/types/database.ts:3433-3520` |
| **`students.coach_id` NULLABLE** (aluno pode não ter responsável) | ✅ desde `migrations/084` | `084_archive_student.sql:12` |
| **RPCs de KPI de estúdio** `get_org_coach_load` (alunos+aulas/treinador), `get_org_class_overview` (capacidade/ocupação), `get_org_athlete_absences` (frequência) | ⚠️ **drift** — no banco, **sem migration no repo, sem uso no app** | `shared/types/database.ts:~4909-4945` |
| `appointment_groups` (turma: `capacity`, `coach_id`, `day_of_week`, `start_time`) | ✅ existe (órfã) | `migrations/157:71-91` |
| `recurring_appointments.appointment_group_id` (link aluno→turma) | ⚠️ coluna existe, **nenhum código escreve** | `migrations/157:95` |
| `appointment_exceptions.kind ∈ (completed, no_show, …)` (status por ocorrência) | ✅ | `migrations/106_agendamentos_tabelas.sql` |
| `getOrganizationContext()` (roles, visibility, seat_limit, isManager) | ✅ (só 3 consumidores; nada na shell/nav) | `web/src/lib/studio/get-organization.ts` |
| UI "Equipe" (add-coach, lista, roles) — a mover pra aba Treinadores | ✅ existe em settings | `web/src/components/settings/equipe-section.tsx` |
| Branding leve — org-ready via prop `isStudio` | ✅ live | `web/src/components/settings/branding-section.tsx` |
| Dashboard **solo** do treinador (base a generalizar) | ✅ | `web/src/lib/dashboard/get-dashboard-data.ts` |

### O que falta construir/ligar

| Peça | Estado | Nota |
|---|---|---|
| **Formalizar os RPCs de KPI drift** (migration + endurecer security) | ❌ | protótipos — revisar `security definer`/`search_path`/checar `is_org_manager` |
| **Criar org (self-serve)** | ❌ | grep vazio |
| **Acesso herdado** (coach entra pela org) | ❌ | `get-trainer.ts:98` só olha a sub do próprio treinador |
| **`coach_id` como responsável + RLS org-aware** | ❌ | hoje `coach_id = dono` em RLS + ~12 guards de app |
| **Shell/nav do gestor + aba Treinadores** | ❌ | sidebar não recebe nenhum sinal de org/role hoje |
| **Painel de gestão** (agrega os RPCs) | ❌ | — |
| **Fluxo turmas + matrícula (write-path)** | ❌ | ocupação dá 0% até isso existir |
| **Onboarding do gestor** | ❌ | onboarding atual é 100% trainer-shaped (só `modality_focus`) |
| **Billing por seat** | ❌ | `tiers.ts` é 100% solo |
| **Rota `/estudio`** | ❌ 404 | `settings/page.tsx:133` redireciona pra rota inexistente |

### Diagnóstico central
A fundação de dados está **mais completa do que a memória dizia** (org, students.organization_id, appointment_groups, RPCs de KPI). O trabalho do v1 é: **(1)** formalizar o drift (RPCs → migrations), **(2)** acesso herdado, **(3)** virar `coach_id` em "responsável" com RLS org-aware, **(4)** a shell/painel/aba do gestor, **(5)** o write-path de turmas, **(6)** billing. A parte sensível continua sendo a RLS org-aware (fase isolada, review A/B).

---

## 2. Modelo de produto

**O tier Estúdio (v1):** um sistema onde o **gestor**:
- adiciona/gere seus **treinadores** (aba "Treinadores") sob uma marca única (a `organization`);
- tem um **painel de gestão** — o estúdio inteiro numa visão;
- acompanha **KPIs**: frequência dos alunos, aulas dadas por treinador, ocupação dos horários, carga por treinador;
- paga por **seats**.

**Alunos são do estúdio:** todos os treinadores acessam todos os alunos (visibilidade **open**); cada aluno pode ter um **treinador-responsável** (`coach_id`, reatribuível, opcional).

**Os KPIs — aterrados em dado real:**

| KPI | Fonte | Viabilidade |
|---|---|---|
| **Frequência dos alunos** | `workout_sessions` + `appointment_exceptions(kind)` · RPC `get_org_athlete_absences` | ✅ só agregação |
| **Aulas dadas por treinador** | `appointment_exceptions(kind='completed')` + `recurring_appointments.trainer_id` · RPC `get_org_coach_load` | ✅ só agregação — **ressalva:** conta só ocorrências que o treinador marcou concluída (ver §7) |
| **Aproveitamento dos horários** | `appointment_groups.capacity` ÷ matriculados (`recurring_appointments.appointment_group_id`) · RPC `get_org_class_overview` | ⚠️ precisa do **write-path de matrícula** (P1.4) |

**Proposta de valor sobre o Premium solo:** multi-coach sob uma marca, gestão centralizada, e a visão de quem-faz-o-quê / ocupação — coisa que o solo não tem.

**Preço:** _em aberto_ — ver §7. Card entra em `tiers.ts` na P1.5.

---

## 3. Arquitetura

### 3.1 Acesso herdado (Parte 1) — override de acesso, **sem tocar na IA**
- Membro ativo de org com status ativo ganha **acesso ao núcleo**: alunos ilimitados, sem read-only lock — independente de sub solo. Aditivo em `get-trainer.ts` / `student-cap.ts` (se `getOrganizationContext()` ativo → cap ∞, `studentsLocked=false`). `getAiTier` **intocado**.
- **Puramente aditivo:** org ausente → caminho byte-a-byte idêntico ao solo. É o guard de *todo* login.
- No piloto, orgs podem ser provisionadas manualmente (service role, `subscription_status='active'`) antes do billing self-serve.

### 3.2 Alunos do estúdio + visibilidade de gestão (Parte 1) — RLS org-aware
- `students.organization_id` **já existe**; passa a ser setado quando um coach de org cria aluno (+ backfill dos existentes).
- `coach_id` vira **treinador-responsável** (nullable, reatribuível) — não mais "dono".
- **Reescrever as suposições `coach_id = dono` com fallback org-aware** (`is_org_member(organization_id)`), no padrão que `appointment_groups` já usa (`is_org_manager(org) OR coach_id = current_trainer_id()`):
  - RLS: `students` (`students_trainer_all`), `messages`, `assigned_programs`, `assigned_workouts`, `workout_sessions`, `forms`/`form_submissions`.
  - App-layer: os **~12 guards** `student.coach_id !== trainer.id` em `actions/{training-room,appointments,financial,forms}/` ganham fallback org-aware.
- **Regra de visibilidade:** gestor (owner/admin) lê tudo da org; treinador lê/atua em todos os alunos do estúdio (open default). Escrita cruzada em modo `restricted` fica para configuração futura.
- **Financeiro fica de fora do v1** (manager-only/intocado) → **encolhe a superfície de RLS a mexer**.
- Helper novo `trainer_org_id()` (org do `current_trainer_id()`, ou null) para os predicados.

### 3.3 Painel de gestão + aba Treinadores (Parte 1, web)
- **Shell variante do gestor:** forkar como o `assistantMode ? <AssistantNavSidebar/> : <Sidebar/>` já faz — mas por **role**. Threddar `orgCtx`/`isManager` de `app-layout.tsx` → `sidebar.tsx` (hoje a sidebar não recebe sinal de role).
- **Aba "Treinadores"** (`nav-items.ts` + rota): add/gerir treinador (mover `EquipeSection` de settings pra cá), drill-down por treinador (alunos + programas).
- **Painel:** generalizar `get-dashboard-data.ts` (solo) para agregação de org, consumindo os **RPCs formalizados** (§1). KPIs: frequência, aulas dadas, carga por treinador; ocupação entra com P1.4.
- Rota `/estudio` (dashboard do gestor). Coaches seguem no dashboard solo.
- **Sinal de manager:** `organization_members.role ∈ {owner, admin}` (não há coluna de role em `trainers`).

### 3.4 Turmas + matrícula (Parte 1) — write-path da ocupação
- Fluxo **criar turma** (`appointment_groups`: capacidade/horário/coach — RLS já existe) e **matricular aluno** (write-path novo: setar `recurring_appointments.appointment_group_id`, ou tabela dedicada `class_enrollments` se precisar de roster/histórico — decidir na P1.4).
- KPI de ocupação via `get_org_class_overview` (`enrolled/capacity`).

### 3.5 Onboarding do gestor (Parte 1) — ramificar pelo padrão do `modality_focus`
- O onboarding é 100% trainer-shaped, parametrizado só por `modality_focus`. **Reusar esse mecanismo:** checklist/tour próprios do gestor (convidar treinador, definir visibilidade, revisar equipe), forkados onde `WelcomeModal`+`TourRunner` são renderizados (`dashboard-client.tsx`).
- Reusar `OnboardingState` (adicionar milestones do gestor em `OnboardingMilestones` + defaults + o OR-merge em `update-onboarding-state.ts`, que enumera cada milestone). Onboarding do treinador **inalterado**.

### 3.6 Billing por seat (Parte 1)
- Assinatura Stripe única no dono, `quantity = seat_limit`. `organizations` já tem `subscription_status`/`seat_limit`/`grace_until`; faltam `stripe_customer_id`/`stripe_subscription_id`/`plan_tier`.
- Webhook atualiza `organizations.subscription_status` (idempotência via `webhook_events`, domínio sempre `www.kinevoapp.com` — incidente abril/2026).

### 3.7 Financeiro do estúdio (pós-v1) — princípio
- Quando entrar, o financeiro é **da org** (o estúdio é a entidade financeira), **não** por treinador. Isso **diverge** do modelo atual (uma subconta Asaas por treinador) — um estúdio teria uma entidade só. Desenho detalhado fora do escopo v1.

### 3.8 Camada de IA (Parte 2)
- `getAiTier`/`get-trainer.ts` passam a derivar o **tier de IA** da org; cada coach recebe cota por seat (reusa `quota.ts`/`PLAN_AI_QUOTA`). Só após o Parte 1 validado em produção.

---

## 4. Roadmap faseado

Padrão `SPEC_FASE_X.md`; regra transversal: working tree acumula, sem `git commit`/`push` durante dev (`mobile/specs/WORKFLOW.md`).

### PARTE 1 — Sistema de gestão do estúdio (web)

#### P1.0 — Fundação + formalização do drift _(sem mudança visível)_
- **Formalizar os 3 RPCs de KPI drift** numa migration (extrair do banco, endurecer: `security definer` + `search_path` + checar `is_org_manager(p_org)` dentro do RPC).
- Migration: colunas de billing na `organizations` + helper `trainer_org_id()`.
- Tipar tabelas de estúdio em `shared/types/database.ts` → remover `@ts-ignore` (`npm run gen:types`).
- Criar `web/src/app/estudio/blocked/page.tsx` (mata o 404) + corrigir `revalidatePath('/studio')` → `/estudio`.
- **Gate:** `tsc --noEmit` limpo; migrations idempotentes e backward-compat.

#### P1.1 — Org + Equipe + acesso herdado
- `create-organization.ts` (self-serve) ou provisionamento manual no piloto.
- **Acesso herdado** (§3.1) — coach entra e prescreve, sem IA. Aditivo.
- Endurecer `addCoach` (seat gate vs `seat_limit`, convite/credencial), listar/remover/desativar/role.
- Setar `students.organization_id` na criação por coach de org + backfill.
- **Gate:** coach entra sem sub solo; solo sem org idêntico ao atual (teste de regressão do guard).

#### P1.2 🔒 — Alunos do estúdio + visibilidade + vinculação _(CRÍTICO — isolar)_
- `coach_id` vira responsável (reatribuível); RLS org-aware (§3.2) nas tabelas não-financeiras; ajustar os ~12 guards de app.
- UI: reatribuir aluno entre treinadores; lista com "responsável".
- **Gate BLOQUEANTE:** review adversarial A/B (`/security-loop`): (1) estúdio X nunca lê dados de Y; (2) solo sem org isolado como hoje; (3) responsável reatribuído não vaza histórico indevido. Sem review verde, não vai pra produção.

#### P1.3 — Shell do gestor + aba Treinadores + painel _(a manchete)_
- Shell variante do gestor (fork por role) + threddar `orgCtx`/`isManager`.
- Aba "Treinadores" (mover Equipe pra cá) + drill-down por treinador.
- Painel `/estudio` agregando os RPCs: frequência + aulas dadas + carga por treinador + consolidação.
- **Onboarding dedicado do gestor** (§3.5).
- **Gate:** números batem com a contagem real por treinador.

#### P1.4 — Turmas + matrícula + ocupação
- Criar turma (`appointment_groups`) + matricular aluno (write-path; avaliar `class_enrollments`).
- KPI de ocupação (`get_org_class_overview`) ligado no painel.
- **Gate:** ocupação reflete matrículas reais (não 0%).

#### P1.5 — Billing por seat + branding de org + venda
- Checkout Stripe por seat + webhook atualizando `subscription_status`; `/estudio/blocked` funcional.
- Branding de org (prop `isStudio` pronta) no app dos alunos dos coaches.
- Card "Estúdio" em `tiers.ts` + landing/pricing.
- **Gate:** landing coerente com o backend (`tiers.ts`).

### PARTE 2 — IA + gestor no mobile

#### P2.1 — Entitlement de IA org-aware + créditos por seat (§3.8)
#### P2.2 — Gestor no mobile (estender `RoleModeContext` p/ ler `organization_members.role` + aba/variante)

---

## 5. Riscos & mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| **Vazamento multi-tenant** (RLS `coach_id`→org mal fechada) — P1.2 | 🔴 Alta | `trainer_org_id()` testado + review A/B **bloqueante**. Financeiro fora do v1 encolhe a superfície. |
| **Regressão na base solo** — acesso herdado + RLS tocam o guard de todo login | 🔴 Alta | **Aditivo**: org ausente ⇒ idêntico. Teste de regressão do guard solo. |
| **RPCs drift com segurança frouxa** (formalizar sem checar `is_org_manager`) | 🟠 Média | Endurecer no P1.0: `search_path`, `security definer`, gate de org dentro do RPC. |
| **KPI "aulas dadas" subcontar** (só conta ocorrência marcada `completed`) | 🟠 Média | Decidir política em §7 (auto-complete vs marcação manual); comunicar no painel. |
| **Webhook de billing falho** (incidente abril/2026) | 🟠 Média | `www.kinevoapp.com`; idempotência; `grace_until`. |
| **Divergência web/mobile** no acesso | 🟠 Média | Verificar o caminho mobile já na P1.1 (mesmo com gestor web-first). |

---

## 6. Regras invioláveis

1. **Aditivo, sempre.** Nenhuma mudança em `get-trainer.ts`/RLS de dados altera o comportamento de um treinador solo sem org.
2. **Acesso ≠ IA.** O Parte 1 não toca `getAiTier`.
3. **Review de segurança é gate, não sugestão** (P1.2).
4. **Financeiro = da org, nunca do treinador** (quando entrar, pós-v1).
5. **Zero novos erros de TypeScript**; sem `any` (`web/CLAUDE.md`).
6. **Migrations idempotentes e backward-compat**; nunca reescrever migrations existentes.
7. **www.kinevoapp.com** em toda integração externa; idempotência de webhook.
8. **Sem commit/push durante dev** — batch autorizado pelo Gustavo no fim.

---

## 7. Questões em aberto

- **Preço do tier Estúdio** e faixa de seats (base + adicional por seat?). Entra em `tiers.ts` na P1.5.
- **"Aulas dadas" — política de contagem:** só ocorrências marcadas `completed` (hoje), ou auto-completar ocorrências passadas não-canceladas? Decidir na P1.3.
- **Matrícula em turma:** overload de `recurring_appointments.appointment_group_id` (mínimo) vs tabela nova `class_enrollments` (roster/histórico/status por aluno). Decidir na P1.4.
- **Onboarding do estúdio:** self-serve na P1.1 ou provisionamento manual no piloto (self-serve na P1.5)?
- **Caminho de acesso no mobile** — confirmar como o app trainer resolve acesso e onde herdar a org (P1.1), mesmo com gestor web-first.
- **PRD §8.4** — regras `open`/`restricted` citadas nas actions **não existem como arquivo** no repo; formalizar num anexo deste doc na P1.2.

---

## Índice de arquivos-chave

**Fundação viva / drift:** `migrations/157_baseline_orphan_tables.sql` · `shared/types/database.ts` (students ~3433, RPCs KPI ~4909, appointment_groups ~2916, organization_members ~2114) · `web/src/lib/studio/get-organization.ts`

**Acesso (org-aware, sem tocar IA):** `web/src/lib/auth/get-trainer.ts` · `web/src/lib/limits/student-cap.ts`

**RLS `coach_id`→org:** `migrations/001` (students RLS), `090_messages.sql`; guards em `web/src/actions/{training-room,appointments,forms}/`

**Shell/nav do gestor:** `web/src/components/layout/{nav-items.ts,sidebar.tsx,app-layout.tsx}` · `web/src/app/dashboard/dashboard-client.tsx` · `web/src/app/estudio/` (a criar)

**Equipe/Treinadores:** `web/src/components/settings/equipe-section.tsx` · `web/src/actions/organizations/{add-coach,update-org-visibility}.ts` · `web/src/app/settings/page.tsx`

**Agenda/turmas:** `migrations/106_agendamentos_tabelas.sql` · `shared/utils/appointments-projection.ts` · `web/src/actions/appointments/{mark-occurrence-status,core,create-recurring-group}.ts`

**Onboarding:** `shared/types/onboarding.ts` · `web/src/stores/onboarding-store.ts` · `web/src/actions/onboarding/update-onboarding-state.ts` · `web/src/components/onboarding/widgets/{welcome-modal,checklist-items}.ts(x)`

**Painel base:** `web/src/lib/dashboard/get-dashboard-data.ts`

**Billing / venda:** `web/src/lib/billing/tiers.ts` · `web/src/app/api/webhooks/stripe/route.ts` · `web/src/components/landing/landing-pricing.tsx`

**IA (Parte 2):** `web/src/lib/auth/get-ai-tier.ts` · `web/src/lib/ai-usage/quota.ts` · mobile `RoleModeContext.tsx`
</content>
