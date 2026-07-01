# SPEC · Estúdios P1.0 — Fundação + formalização do drift

Data: 2026-07-01. Source-of-truth executável da fase P1.0. Ver o desenho completo em [`PLANO.md`](./PLANO.md).

> **Objetivo:** preparar schema/tipos/rotas do Estúdios **sem nenhuma mudança visível** e **sem risco à base solo**. É a fundação backward-compat sobre a qual P1.1→P1.5 constroem.
>
> **Escopo:** só DDL aditivo + baseline de drift + tipagem + 1 rota + 1 fix de string. **Nada de UI de produto, billing, acesso herdado ou RLS de dados** (isso é P1.1+).

---

## Contexto herdado da auditoria (2026-07-01)

Puxado do banco de produção (`lylksbtgrihzepbteest`, Kinevo 2.0). **Confirmado, não suposto:**

- **`organizations`** tem hoje: `id, name, logo_url, visibility, seat_limit, subscription_status, grace_until, created_at, updated_at`. **Faltam** `stripe_customer_id`, `stripe_subscription_id`, `plan_tier`.
- **`students.organization_id`** existe em prod mas é **DRIFT** (nenhuma migration local cria) → precisa baseline reset-safe.
- **Os 3 RPCs de KPI existem em prod, já endurecidos** (`SECURITY DEFINER`, `SET search_path TO 'public'`, gate `is_org_member(p_org)` no WHERE, `EXECUTE` para `authenticated`+`service_role`) mas são **DRIFT** (sem migration no repo, sem uso no app). Formalizar = baseline idêntico ao prod (no-op em prod, cria no reset).
- **`trainer_org_id()` NÃO existe** — criar do zero.
- `is_org_member` / `is_org_manager` / `current_trainer_id` já existem (migration 157 / 001).
- Middleware **já contempla `/estudio`** (`web/src/lib/supabase/middleware.ts:52`) — rota é rota protegida, sem mudança de middleware necessária.
- Próxima migration livre = **222** (última é `221_per_subaccount_webhook_token.sql`).

---

## Regras da fase (invioláveis)

1. **Aditivo e backward-compat.** Só `add column if not exists`, `create or replace`, `create ... if not exists`. Zero DROP, zero rename, zero mudança de comportamento.
2. **Sem `git commit`/`push` durante o dev.** Working tree acumula; push só no batch autorizado pelo Gustavo (`mobile/specs/WORKFLOW.md`).
3. **Aplicar migration em prod só com autorização explícita** do Gustavo (via `supabase db push` ou MCP `apply_migration`). As migrations são no-op em prod (drift já lá; colunas novas aditivas), mas mesmo assim gate.
4. **Zero novos erros de TypeScript. Sem `any`.**
5. **Baseline fiel:** os RPCs vão pro repo **exatamente** como estão em prod (gate `is_org_member`). **Não** apertar pra `is_org_manager` aqui — isso é decisão do painel (P1.3), e mudaria comportamento.

---

## Steps atômicos

### Step 1 — Migration `222_estudios_foundation.sql` (colunas + helper + baseline drift)

Criar `supabase/migrations/222_estudios_foundation.sql`:

```sql
-- ============================================================================
-- Migration 222: fundação Estúdios P1.0 (aditivo, backward-compat)
--
-- 1. Baseline de students.organization_id (DRIFT: existe em prod, sem migration
--    local — um db reset geraria schema incompleto e quebraria a 223 que
--    referencia s.organization_id). Mesma classe da 157.
-- 2. Colunas de billing por seat em organizations (novas — usadas só na P1.5).
-- 3. Helper trainer_org_id() (novo) — org do treinador logado, ou null (solo).
--
-- Idempotente: em produção é efetivamente no-op (if not exists / create or replace).
-- ============================================================================

-- 1. Baseline reset-safe de students.organization_id -------------------------
alter table public.students
    add column if not exists organization_id uuid references public.organizations(id);

create index if not exists idx_students_organization_id
    on public.students (organization_id);

-- 2. Billing por seat na org (usado na P1.5) ---------------------------------
alter table public.organizations
    add column if not exists stripe_customer_id text,
    add column if not exists stripe_subscription_id text,
    add column if not exists plan_tier text;

-- 3. Helper: org ativa do treinador logado (uma org por treinador na v1) ------
create or replace function public.trainer_org_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
    select om.organization_id
    from organization_members om
    where om.trainer_id = public.current_trainer_id()
      and om.status = 'active'
    order by om.joined_at nulls last
    limit 1
$$;

revoke execute on function public.trainer_org_id() from anon, public;
grant execute on function public.trainer_org_id() to authenticated, service_role;
```

**Notas:**
- `organization_id` fica **nullable** (aluno solo não tem org) — não mexe na base solo.
- `plan_tier` sem CHECK de propósito (forward-compat; a validação vive em `tiers.ts` na P1.5).
- `trainer_org_id()` espelha `is_org_member` em posture de segurança e assume "uma org por treinador na v1" (consistente com `get-organization.ts`).

### Step 2 — Migration `223_baseline_org_kpi_rpcs.sql` (formalizar os 3 RPCs drift)

Criar `supabase/migrations/223_baseline_org_kpi_rpcs.sql`. **Definições idênticas às de produção** (extraídas via `pg_get_functiondef` em 2026-07-01):

```sql
-- ============================================================================
-- Migration 223: baseline dos RPCs de KPI de Estúdio (DRIFT → repo)
--
-- get_org_coach_load / get_org_class_overview / get_org_athlete_absences
-- existem em produção (criados por migration cloud-only, sem arquivo local) e
-- NÃO são chamados por nenhum código ainda. São formalizados aqui idênticos ao
-- prod para que um db reset os tenha (dependem de 222: students.organization_id).
--
-- Segurança (já no prod, preservada): SECURITY DEFINER + search_path fixo +
-- gate is_org_member(p_org) no WHERE (quem não é membro recebe zero linhas —
-- sem vazamento cross-org). NÃO apertar para is_org_manager aqui (P1.3 decide).
-- Idempotente: create or replace = no-op em prod.
-- ============================================================================

-- Carga por treinador: nº de turmas e de alunos ativos na org ----------------
create or replace function public.get_org_coach_load(p_org uuid)
returns table(coach_id uuid, coach_name text, classes bigint, athletes bigint)
language sql
stable security definer
set search_path to 'public'
as $$
    select t.id, t.name,
           count(distinct ag.id) as classes,
           count(distinct s.id)  as athletes
    from organization_members om
    join trainers t on t.id = om.trainer_id
    left join appointment_groups ag on ag.coach_id = t.id and ag.organization_id = p_org and ag.status = 'active'
    left join students s on s.coach_id = t.id and s.organization_id = p_org and s.status = 'active'
    where om.organization_id = p_org and om.status = 'active' and om.is_coach = true and public.is_org_member(p_org)
    group by t.id, t.name
    order by athletes desc;
$$;

-- Ocupação por turma/horário: matriculados vs capacidade ---------------------
create or replace function public.get_org_class_overview(p_org uuid)
returns table(class_id uuid, title text, coach_id uuid, coach_name text,
              day_of_week smallint, start_time time without time zone,
              capacity smallint, enrolled bigint, occupancy_pct numeric)
language sql
stable security definer
set search_path to 'public'
as $$
    select ag.id, ag.title, ag.coach_id, t.name,
           ag.day_of_week, ag.start_time, ag.capacity,
           count(ra.id) as enrolled,
           case when ag.capacity is null or ag.capacity = 0 then null
                else round(count(ra.id)::numeric * 100 / ag.capacity, 0) end as occupancy_pct
    from appointment_groups ag
    join trainers t on t.id = ag.coach_id
    left join recurring_appointments ra on ra.appointment_group_id = ag.id and ra.status = 'active'
    where ag.organization_id = p_org and ag.status = 'active' and public.is_org_member(p_org)
    group by ag.id, ag.title, ag.coach_id, t.name, ag.day_of_week, ag.start_time, ag.capacity
    order by ag.day_of_week nulls last, ag.start_time nulls last;
$$;

-- Frequência/faltas por aluno nos últimos p_days dias ------------------------
create or replace function public.get_org_athlete_absences(p_org uuid, p_days integer default 30)
returns table(student_id uuid, student_name text, coach_id uuid, no_shows bigint, completed bigint)
language sql
stable security definer
set search_path to 'public'
as $$
    select s.id, s.name, s.coach_id,
           count(*) filter (where ae.kind = 'no_show')   as no_shows,
           count(*) filter (where ae.kind = 'completed') as completed
    from students s
    join recurring_appointments ra on ra.student_id = s.id
    join appointment_exceptions ae on ae.recurring_appointment_id = ra.id
    where s.organization_id = p_org
      and ae.occurrence_date >= (current_date - p_days)
      and public.is_org_member(p_org)
    group by s.id, s.name, s.coach_id
    having count(*) filter (where ae.kind = 'no_show') > 0
    order by no_shows desc;
$$;

revoke execute on function public.get_org_coach_load(uuid)              from anon, public;
revoke execute on function public.get_org_class_overview(uuid)          from anon, public;
revoke execute on function public.get_org_athlete_absences(uuid, integer) from anon, public;
grant execute on function public.get_org_coach_load(uuid)              to authenticated, service_role;
grant execute on function public.get_org_class_overview(uuid)          to authenticated, service_role;
grant execute on function public.get_org_athlete_absences(uuid, integer) to authenticated, service_role;
```

> ⚠️ **Antes de aplicar:** rodar um `diff` mental/real contra `pg_get_functiondef` atual (comando abaixo) — se prod divergir do que está aqui, a fonte de verdade é o prod. Reconferir na hora de aplicar.

### Step 3 — [AUTORIZAÇÃO] Aplicar migrations + regenerar tipos

Só após "pode aplicar" do Gustavo (as migrations são no-op/aditivas, mas é gate):
- Aplicar `222` e `223` (via `supabase db push` ou MCP `apply_migration`).
- `npm run gen:types` → regenera `shared/types/database.ts` incluindo `students.organization_id`, as 3 colunas novas de `organizations`, e as **assinaturas tipadas dos 3 RPCs** (necessárias para chamá-los type-safe na P1.3).

> Nota: como os RPCs + `students.organization_id` + tabelas de org **já existem em prod**, um `gen:types` mesmo antes de aplicar já os tiparia; as 3 colunas de billing é que exigem a `222` aplicada. Aplicar-e-regenerar de uma vez é o caminho limpo.

### Step 4 — Remover `@ts-ignore` agora redundantes

Após regen, remover os `@ts-ignore` que só existiam por falta de tipos, rodando `tsc` a cada arquivo:
- `web/src/actions/organizations/update-org-visibility.ts:25`
- `web/src/lib/studio/get-organization.ts:49, 51, 53`
- `web/src/actions/organizations/add-coach.ts:61, 77, 87, 93`

**Regra:** remover um por um e validar. Se algum `@ts-ignore` seguir necessário por quirk de tipagem de embed do PostgREST (ex.: o `organization:organizations(...)` aninhado em `get-organization.ts`), **mantê-lo com comentário preciso** do motivo — nunca supressão cega. Meta: reduzir ao mínimo, não forçar zero.

### Step 5 — Criar a rota `/estudio/blocked`

Criar `web/src/app/estudio/blocked/page.tsx` (mata o 404 do `settings/page.tsx:133`). Espelhar o padrão existente de `web/src/app/subscription/blocked/` (`page.tsx` + `blocked-client.tsx`), adaptando o copy para org bloqueada por billing ("A assinatura do estúdio está suspensa. Fale com o responsável / regularize o pagamento."). Sem lógica de billing ainda — só a tela (a P1.5 liga o fluxo real).

### Step 6 — Corrigir `revalidatePath('/studio')` → `/estudio`

Em `web/src/actions/organizations/add-coach.ts:109`, trocar `revalidatePath('/studio')` por `revalidatePath('/estudio')` (rota real; a `/studio` nunca existiu).

### Step 7 — Validação final

- `cd web && npx tsc --noEmit` → limpo.
- `cd web && npm run lint` → sem novos erros.
- (Com autorização, opcional) smoke test dos RPCs no banco:
  ```sql
  select pg_get_functiondef(oid) from pg_proc
   where proname in ('get_org_coach_load','get_org_class_overview','get_org_athlete_absences','trainer_org_id');
  ```
- Checklist de aceite abaixo.

---

## Critérios de aceite (gate da fase)

- [ ] `222` e `223` escritas, idempotentes, aditivas; `223` depende de `222` (ordem numérica garante no reset).
- [ ] `trainer_org_id()` existe e devolve a org do treinador logado, ou `null` para solo.
- [ ] Os 3 RPCs no repo são **byte-idênticos** em comportamento ao prod (gate `is_org_member` preservado).
- [ ] `students.organization_id` baselineada (reset-safe) + índice.
- [ ] 3 colunas de billing em `organizations` (nullable).
- [ ] `@ts-ignore` reduzidos ao mínimo; `tsc --noEmit` limpo.
- [ ] `/estudio/blocked` renderiza (sem mais 404 no `settings`).
- [ ] `revalidatePath` aponta pra `/estudio`.
- [ ] **Base solo intocada:** nenhum treinador sem org muda de comportamento (org_id null em toda parte; RPCs não chamados por ninguém ainda).

---

## Commits sugeridos (documentados — NÃO executar no dev)

1. `feat(estudios): fundação P1.0 — baseline drift (students.organization_id, KPI RPCs) + trainer_org_id() + billing cols`
2. `chore(estudios): tipar tabelas de estúdio + remover @ts-ignore redundantes`
3. `fix(estudios): cria rota /estudio/blocked + corrige revalidatePath('/studio'→'/estudio')`

---

## Fora de escopo (próximas fases)

- Acesso herdado / cap de alunos por org → **P1.1**
- `coach_id` como responsável + RLS org-aware nas tabelas de dados → **P1.2** 🔒
- Shell do gestor, aba Treinadores, painel consumindo os RPCs → **P1.3**
- Turmas + matrícula + KPI de ocupação com dado real → **P1.4**
- Billing por seat (usa as colunas criadas aqui) + branding + venda → **P1.5**
</content>
