# SPEC · Estúdios P1.1 — Org + Equipe + acesso herdado

Data: 2026-07-01. Source-of-truth executável da fase P1.1. Depende de P1.0 concluída ([`SPEC_FASE_0.md`](./SPEC_FASE_0.md)). Ver desenho em [`PLANO.md`](./PLANO.md).

> **Objetivo:** um treinador vira **coach de um estúdio** e ganha **acesso ao núcleo** (alunos ilimitados, sem read-only lock) **sem assinatura solo e sem tocar na lógica de IA** (`getAiTier`). Inclui criar org, gate de assentos e gestão básica do coach.
>
> **Escopo:** o primitivo `hasOrgCoreAccess` + os 7 gates aditivos + `createOrganization` + seat gate/ciclo de vida do coach. **Nada de RLS de dados / visibilidade cruzada** (isso é P1.2 🔒) nem UI de painel (P1.3).

---

## Contexto herdado da auditoria (2026-07-01)

**Confirmado, não suposto** (via leitura de código):

- **Não existe resolvedor de acesso por org.** `getAiTier`/`getAiTierForTrainer` são solo-only (leem `trainers`+`subscriptions`, nunca `organization_members`). Para manter o solo byte-idêntico, introduzimos **um** primitivo e curto-circuitamos cada gate: solo não tem linha em `organization_members` → primitivo `false` → tudo roda como hoje.
- **Cap de aluno** enforçado em `assertCanCreateStudent` (`web/src/lib/limits/student-cap.ts:52`), chamado por `create-student-core.ts:44` (cobre `createStudent` + `convertLeadToStudentCore`) e pela tool MCP `mcp/tools/students-write.ts:31`.
- **Read-only lock** enforçado em `isStudentManagementLockedForTrainer` (`web/src/lib/limits/student-readonly.ts:55`), consumido por **7 server actions** de mutação (extend/activate/complete/delete program, update-trainer-notes, archive-student, assign-form).
- **`get-trainer.ts:104`** computa `studentsLocked` (hoje sem consumidor no web UI, mas usado no mobile via `/api/trainer/ai-status`).
- **Mobile cria aluno via Edge Function Deno** `supabase/functions/create-student/index.ts:57-94` — **cap reimplementado inline**; não importa o helper web → precisa do check inline próprio.
- **Mobile lê tier/lock** via `GET /api/trainer/ai-status` (`web/src/app/api/trainer/ai-status/route.ts:60`); `RoleModeContext` não bloqueia nada (`isTrainerSubscriptionBlocked` é `return false`).
- **`addCoach` NÃO checa `seat_limit`** (`web/src/actions/organizations/add-coach.ts:88`). Não há helper de contagem de assentos.

### Os 7 pontos de edição (todos aditivos)

| # | Arquivo:linha | Gate hoje | Edição org-aware |
|---|---|---|---|
| 1 | `lib/limits/student-cap.ts:52` (`assertCanCreateStudent`) | conta vs `STUDENT_CAP[tier]` | `if (await hasOrgCoreAccess(admin, trainerId)) return` (cobre core + MCP) |
| 2 | `lib/limits/student-cap.ts:86` (`assertCanDowngradeToFree`) | bloqueia se >1 aluno | `if (await hasOrgCoreAccess(admin, trainerId)) return` |
| 3 | `supabase/functions/create-student/index.ts:76` | cap Free inline | check inline `organization_members`→`organizations.subscription_status` seta `isPaid=true` |
| 4 | `lib/limits/student-readonly.ts:55` (`isStudentManagementLockedForTrainer`) | free & >1 → lock (7 actions) | `if (await hasOrgCoreAccess(...)) return false` |
| 5 | `lib/auth/get-trainer.ts:104` | computa `studentsLocked` | guardar o bloco `if (tier==='free')` com `&& !(await hasOrgCoreAccess(...))` |
| 6 | `app/api/trainer/ai-status/route.ts:60` | `studentsLocked` p/ mobile | `if (await hasOrgCoreAccess(...)) studentsLocked = false` |
| 7 | `actions/organizations/add-coach.ts:88` | sem seat check | novo gate de `seat_limit` (só roda com org) |

---

## Regras da fase (invioláveis)

1. **`getAiTier` é intocável.** P1.1 concede **acesso ao núcleo**, não tier de IA. Nenhuma edição pode alterar a resolução de tier de IA.
2. **Aditivo.** Solo sem org → comportamento byte-idêntico. Cada gate só muda quando `hasOrgCoreAccess` é `true`.
3. **Deploy da Edge Function só com autorização** (como as migrations na P1.0).
4. **Sem `git commit`/`push` durante o dev.**
5. **Zero novos erros de TypeScript. Sem `any`.**

---

## Steps atômicos

### Step 1 — Novo primitivo `hasOrgCoreAccess`

Criar `web/src/lib/studio/org-access.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

type DBClient = SupabaseClient<Database>

/** Status de org que concedem acesso ao núcleo (espelha ACTIVE_STATUSES da IA). */
const ORG_ACTIVE = new Set(['active', 'trialing'])

/**
 * True se o treinador é membro ATIVO de uma org cujo billing está ativo
 * (active/trialing, ou past_due dentro da janela grace_until). É a fonte ÚNICA
 * de "acesso herdado ao núcleo" — NÃO consulta getAiTier.
 *
 * Solo (sem linha em organization_members) → false → gate roda como hoje.
 * Funciona com admin client OU client RLS (policy org_members_member_read
 * permite o membro ler o próprio vínculo + a própria org).
 */
export async function hasOrgCoreAccess(client: DBClient, trainerId: string): Promise<boolean> {
    const { data } = await client
        .from('organization_members')
        .select('organization:organizations(subscription_status, grace_until)')
        .eq('trainer_id', trainerId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

    if (!data) return false
    const rel = (data as { organization: unknown }).organization
    const org = Array.isArray(rel) ? rel[0] : rel
    if (!org) return false

    const { subscription_status: s, grace_until } = org as {
        subscription_status: string
        grace_until: string | null
    }
    if (ORG_ACTIVE.has(s)) return true
    if (s === 'past_due' && grace_until && new Date(grace_until).getTime() > Date.now()) return true
    return false
}
```

### Step 2 — Ligar `hasOrgCoreAccess` nos 5 gates do web-lib (#1, #2, #4, #5, #6)

Editar, com o primitivo curto-circuitando **no topo** de cada gate (antes da lógica solo):

- **#1** `student-cap.ts` — em `assertCanCreateStudent`, antes de ler `cap` (linha ~52):
  ```ts
  if (await hasOrgCoreAccess(admin, trainerId)) return
  ```
- **#2** `student-cap.ts` — em `assertCanDowngradeToFree`, no topo (~87):
  ```ts
  if (await hasOrgCoreAccess(admin, trainerId)) return
  ```
- **#4** `student-readonly.ts` — em `isStudentManagementLockedForTrainer`, no topo (~55): resolver o admin client e `if (await hasOrgCoreAccess(admin, trainerId)) return false`.
- **#5** `get-trainer.ts:104` — guardar o bloco `if (tier === 'free')` para **não** computar `studentsLocked` quando `hasOrgCoreAccess(supabase, trainer.id)` (usa o client RLS já em mãos).
- **#6** `app/api/trainer/ai-status/route.ts:60` — antes do bloco de `studentsLocked`: `if (await hasOrgCoreAccess(supabaseAdmin, trainer.id)) studentsLocked = false`.

**Validação por gate:** `tsc` limpo; para cada um, um treinador solo sem org mantém o resultado idêntico (teste unitário/asserção).

### Step 3 — [AUTORIZAÇÃO] Edge Function `create-student` — check inline (#3)

Em `supabase/functions/create-student/index.ts`, antes do enforcement do cap (~linha 76), adicionar consulta inline (Deno não importa o helper web):

```ts
// Acesso herdado do estúdio: membro ativo de org com billing ativo = ilimitado.
const { data: orgRow } = await supabaseAdmin
    .from('organization_members')
    .select('organization:organizations(subscription_status, grace_until)')
    .eq('trainer_id', trainerId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
const org = Array.isArray(orgRow?.organization) ? orgRow.organization[0] : orgRow?.organization
const orgActive = org && (['active','trialing'].includes(org.subscription_status)
    || (org.subscription_status === 'past_due' && org.grace_until && new Date(org.grace_until) > new Date()))
if (orgActive) { /* pular o cap: tratar como pago (isPaid = true) */ }
```

Deploy via MCP `deploy_edge_function` **com autorização**. Solo: sem membership → comportamento idêntico.

### Step 4 — `createOrganization` action

Criar `web/src/actions/organizations/create-organization.ts` (`'use server'`):
- Autentica (`getUser`), resolve o `trainers.id` do usuário.
- Cria `organizations` (name; `subscription_status='trialing'` default; `seat_limit` — ver nota) e `organization_members` (o criador como `role='owner'`, `is_coach=true`, `status='active'`, `joined_at=now`).
- Retorna `{ success, organizationId }`.
- Usa `supabaseAdmin` (cria linhas que a RLS do próprio criador ainda não enxergaria antes do vínculo existir).

**Nota de escopo (§7 do PLANO):** a **exposição self-serve** dessa action (entrada pública "criar estúdio") fica **pendente da decisão de onboarding** — na P1.1 a action existe e pode ser disparada por provisionamento manual/piloto; o fluxo self-serve polido entra na P1.5 junto do billing. `seat_limit` inicial: `null` (ilimitado) no piloto, ou o valor do plano quando o billing existir.

### Step 5 — `addCoach`: seat gate + ciclo de vida do coach

**5a. Seat gate** em `add-coach.ts`, após `getOrganizationContext` (~linha 31) e só no caminho de **novo** membro (antes do insert ~88):
```ts
if (!existingMember && ctx.organization.seat_limit != null) {
    const { count } = await supabaseAdmin
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', ctx.organization.id)
        .eq('status', 'active')
    if ((count ?? 0) >= ctx.organization.seat_limit) {
        return { success: false, error: 'Limite de assentos da academia atingido.' }
    }
}
```
(`seat_limit == null` = ilimitado; conta `status='active'` = exatamente quem recebe acesso via `hasOrgCoreAccess`.)

**5b. Ciclo de vida** — nova action `web/src/actions/organizations/update-coach-status.ts` (gestor only, via `ctx.isManager`):
- **Desativar:** `organization_members.status='inactive'` (revoga o acesso herdado — `hasOrgCoreAccess` passa a `false` para o coach; dados preservados).
- **Reativar:** `status='active'` (respeitando seat gate).
- **Trocar role:** `role ∈ {coach, admin}` (nunca rebaixar/remover o único `owner`).
- Não deletar o `trainers`/auth do coach (só o vínculo).
- UI: estender `equipe-section.tsx` com as ações por linha (a lista de coaches já existe lá).

### Step 6 — Validação final

- `cd web && npx tsc --noEmit` limpo; `npm run lint` sem novos erros.
- Testes unitários do `hasOrgCoreAccess` (solo=false; org active/trialing=true; past_due dentro/fora da graça).
- Regressão solo: um treinador sem org tem cap/lock/tier idênticos ao main (asserção nos 5 gates web).
- (Com autorização) smoke test da Edge Function após deploy: coach de org cria aluno além do cap Free → sucesso; solo Free no 2º aluno → `student_cap_reached`.

---

## Critérios de aceite (gate da fase)

- [ ] `hasOrgCoreAccess` existe e é a **única** fonte do acesso herdado; **não** referencia `getAiTier`.
- [ ] Os 7 pontos ligados; cada um curto-circuita só quando há org ativa.
- [ ] Coach de org ativa: cria alunos **ilimitados** (web + mobile/edge) e **não** cai em read-only lock.
- [ ] **Solo intocado:** cap=1 no Free, downgrade bloqueado, read-only lock, tier de IA — todos idênticos ao main.
- [ ] `createOrganization` cria org `trialing` + owner ativo.
- [ ] `addCoach` respeita `seat_limit`; desativar coach revoga o acesso herdado.
- [ ] Edge Function deployada e testada (com autorização).
- [ ] `tsc` + `lint` limpos.

---

## Commits sugeridos (documentados — NÃO executar no dev)

1. `feat(estudios): hasOrgCoreAccess + acesso herdado ao núcleo nos 6 gates web (aditivo, getAiTier intocado)`
2. `feat(estudios): create-student edge function respeita acesso herdado do estúdio`
3. `feat(estudios): createOrganization + seat gate + ciclo de vida do coach (desativar/reativar/role)`

---

## Fora de escopo (próximas fases)

- `coach_id` como responsável + RLS org-aware nas tabelas de dados / visibilidade cruzada → **P1.2** 🔒
- Shell do gestor, aba Treinadores, painel → **P1.3**
- Turmas + matrícula + ocupação → **P1.4**
- Billing por seat (liga o `seat_limit`/`subscription_status` reais) + onboarding self-serve do estúdio → **P1.5**
- Tier de IA + créditos por seat → **Parte 2**
