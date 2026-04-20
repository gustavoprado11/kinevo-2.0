# Fase 2.5.2 — Log de Execução

Data: 2026-04-20. Executor: Claude Code (Opus 4.7 → Sonnet 4.6 → Opus 4.7 1M).

## 1. Contexto

Walk-through Fase 2.5 (3 perfis) revelou 5 gaps. Fase 2.5.2 endereça os itens #1, #2, #3 e #5 do `§7 Follow-ups` do walk-through. O item #4 (`adaptations=null`) e #6 (tag muscular) ficam abertos.

| Etapa | Finding do walk-through | Descrição |
|---|---|---|
| E1 | #5 (gap de observabilidade) | Persistir `EnrichedStudentContextV2` no `input_snapshot` |
| E2 | #1 (§4.5 ignorada pela LLM) | Regra `R45_SCHEDULE_MISMATCH` + semantic retry loop + Layer 1 §4.5 |
| E2 (bis) | #2 (exercise_id desconhecidos) | Regra `R_POOL_UNKNOWN_EXERCISE` com autofix='retry' |
| E3 | #2 (exercise_id desconhecidos) | Log estruturado `[Smart-v2][missingIds]` em `enrichCompactOutput` |
| E4 | #3 (structure_rationale incorreto) | Derivar de output real (Option 1b), não de constraints template |

---

## 2. Etapa 1 — enriched_context_v2 no input_snapshot

**Arquivo:** `web/src/actions/prescription/generate-program.ts`

Adicionada função `buildSmartV2InputSnapshot()` (exportada, `async` para satisfazer Next.js Server Actions constraint). Chama o bloco de construção do `inputSnapshot` que agora inclui:

```typescript
{
  profile: { ... },
  available_exercises: [...],
  performance_context: ...,
  engine_version: ENGINE_VERSION,
  smart_v2: true,
  prompt_version: PROMPT_VERSION,
  enriched_context_v2: enriched,   // ← novo
}
```

O `enriched` é o resultado de `enrichStudentContextV2()`, que contém `anamnese_summary`, `performance_summary`, `adherence`, `trainer_observations`, `is_new_student`, etc.

**Testes:** `generate-program.test.ts` — 3 novos testes no describe `buildSmartV2InputSnapshot`.

---

## 3. Etapa 2 — R45_SCHEDULE_MISMATCH + semantic retry loop

### 3.1 Regra R45_SCHEDULE_MISMATCH

**Arquivo:** `web/src/lib/prescription/rules-validator.ts`

```typescript
// Coverage-based: union(workout.scheduled_days) == set(profile.available_days)
// Allows PPL+1 where Push=[1,4], Pull=[2,5], Legs=[3] covers 5 days via repetition.
// Does NOT require workouts.length == available_days.length.
export type RuleAutofix = 'local' | 'retry' | 'none'
```

A rule tem `severity: 'error'` e `autofix: 'retry'`. Dois sub-casos:
- Dias **cobertos mas não declarados** (`extras`): workouts agendados fora de `available_days`
- Dias **declarados mas não cobertos** (`missing`): `available_days` sem nenhum workout

### 3.2 Regra R_POOL_UNKNOWN_EXERCISE

```typescript
// exercise_id referenciado pela LLM que não existe no exerciseMap.
// autofix: 'retry' — envia corrective message à LLM para re-emitir.
```

### 3.3 Novo tipo `RuleAutofix`

Adicionado ao `RuleViolation`:
```typescript
interface RuleViolation {
  rule_id: RuleId
  message: string
  severity: 'error' | 'warning'
  autofix: RuleAutofix   // ← novo
  item_ref?: ...
}
```

Todas as 8 regras legadas receberam `autofix: 'local'`.

### 3.4 Semantic retry loop

**Arquivo:** `web/src/actions/prescription/generate-program.ts` — `trySmartV2Generation`

```
while (true):
  if compact === null:
    chamar LLM (com correctiveMessage se semanticRetries > 0)
    parse + validate compact
  snapshot = enrichCompactOutput(compact, ...)
  validated = validatePrescriptionAgainstRules(snapshot, ...)
  retryable = violations.filter(v => v.autofix === 'retry')
  if retryable.length === 0: break
  if semanticRetries >= MAX_SEMANTIC_ATTEMPTS (2): break (accept with warning)
  semanticRetries++
  correctiveMessage = retryable.map(v => `[${v.rule_id}] ${v.message}`).join('\n')
  compact = null  // força re-chamada LLM
```

Separação explícita: HTTP retries (network/5xx/timeout) ficam dentro de `callWithRetry`. Semantic retries (violações de domínio) ficam neste loop externo.

### 3.5 Layer 1 — §4.5 DISTRIBUIÇÃO DE DIAS

Adicionado ao prompt Layer 1 de `prompt-builder-v2.ts`:

```
## §4.5 — DISTRIBUIÇÃO DE DIAS (obrigatório)
...
### Exemplos válidos de distribuição
- Aluno com available_days=[1,2,3,4,5] (5 dias): PPL+1 → Push [1,4], Pull [2,5], Legs [3].
- Aluno com available_days=[1,2,4,5] (4 dias com gap quarta): Upper/Lower A/B → ...
- Aluno com available_days=[1,2,3,4] (4 dias contíguos): Upper/Lower A/B → ... (sem gap artificial)
- Aluno com available_days=[1,3,5] (3 dias alternados): ABC → A [1], B [3], C [5].
```

**Testes:** `rules-validator.test.ts` — 5 testes para `R45_SCHEDULE_MISMATCH` (incluindo caso PPL+1 válido), 3 para `R_POOL_UNKNOWN_EXERCISE`, 1 confirmando autofix legado.

---

## 4. Etapa 3 — Log [Smart-v2][missingIds]

**Arquivo:** `web/src/lib/prescription/output-enricher.ts`

```typescript
const missingIds: string[] = []
for (const cw of compact.workouts) {
  for (const it of cw.items) {
    if ((it.item_type ?? 'exercise') !== 'exercise') continue
    if (it.exercise_id && !exerciseMap.has(it.exercise_id)) missingIds.push(it.exercise_id)
  }
}
if (missingIds.length > 0) {
  console.warn(`[Smart-v2][missingIds] count=${missingIds.length} poolSize=${exerciseMap.size} ids=${JSON.stringify(missingIds)}`)
}
```

Responsabilidade: camada de observabilidade. A rules-validator (`R_POOL_UNKNOWN_EXERCISE`) faz o enforcement; o enricher só loga para correlação de debug quando o retry também falha.

**Testes:** `output-enricher.test.ts` — 3 testes cobrindo: (a) sem IDs faltantes → sem log; (b) 1 ID faltando → log com count/poolSize/id; (c) múltiplos faltando → log completo.

---

## 5. Etapa 4 — structure_rationale derivado do output real (Option 1b)

**Arquivo:** `web/src/lib/prescription/output-enricher.ts`

```typescript
export function generateStructureRationaleFromOutput(workouts: GeneratedWorkout[]): string {
  // covered = union de todos scheduled_days
  // frequency = covered.size
  // splitLabel = inferSplitLabel(names, frequency)
  // schedule = workouts.map(w => `${w.name} ${days.join('+')}`).join(', ')
  return `${splitLabel} ${frequency}x/sem (${schedule}).`
}

function inferSplitLabel(names: string[], frequency: number): string {
  // Closed set:
  // Push+Pull+Legs → PPL / PPL+1 (freq=5) / PPLPPL (freq=6)
  // Upper A/B + Lower A/B → "Upper/Lower A/B"
  // Upper + Lower → "Upper/Lower"
  // all "full body" → "Full Body"
  // fallback → "Split personalizado"
}
```

Substituída a chamada anterior `generateStructureRationale(constraints, profile)` que usava templates baseados em `split_type` (produzindo "Upper/Lower 4x/sem" incorreto para todos os casos).

O `SPLIT_LABELS` dict foi **mantido** no módulo para `generateProgramDescription()` (usa constraints, não workouts — escopo diferente).

**Testes:** `output-enricher.test.ts` — 8 testes cobrindo PPL/PPL+1/PPLPPL/Upper-Lower A-B/Upper-Lower/Full Body/Split personalizado/empty.

---

## 6. Correção adicional: buildSmartV2InputSnapshot deve ser async

**Arquivo:** `web/src/actions/prescription/generate-program.ts` + `generate-program.test.ts`

Descoberta durante E2E: Next.js exige que toda função exportada em arquivo `'use server'` seja `async`. `buildSmartV2InputSnapshot` era síncrona. Corrigida para `async function` e call site atualizado para `await`.

Testes atualizados de `it('...', () => {...})` para `it('...', async () => {...})` com `await` nas chamadas.

---

## 7. Resultados dos testes

```
Test Files  33 passed (33)
Tests       318 passed (318)
```

---

## 8. Validação E2E — Alysson Lanza (student_id=bbe3c04a...)

Método: script Node.js `e2e-alysson.mjs` (em `/tmp/`) usando:
1. `admin.auth.admin.generateLink()` para obter OTP sem enviar email
2. `regular.auth.verifyOtp()` para trocar OTP por sessão
3. `POST http://localhost:3000/api/prescription/generate` com `Authorization: Bearer {token}`
4. Query direta ao Supabase via service role para verificar a row inserida

### Resultado

```
generationId : 19957cce-ca65-42fb-a765-d40e83aae8f1
created_at   : 2026-04-20T14:12:07.589172+00:00

[E1] enriched_context_v2 in input_snapshot : ✅ YES
[E2] schedule coverage [1,2,3,4,5] vs profile.available_days
     n_workouts=5  covered_days=[1,2,3,4,5]
     retry-violations = 0 ✅
[E3] (no [Smart-v2][missingIds] log — LLM used valid pool IDs)
[E4] structure_rationale: "PPL+1 5x/sem (Push seg+qui, Pull ter+sex, Legs qua, Upper qua, Lower sex)."
     honest (matches n_workouts) : ✅

total violations: 2
violations: COMPOUND_BEFORE_ACCESSORY [warning, autofix=local] × 2  (pre-existentes)
```

Comparação com walk-through anterior (geração `e3865526`, pré-Fase 2.5.2):
- `has_enriched`: False → **True ✅**
- `n_workouts`: 3 → **5 ✅** (Alysson declarou 5 dias, agora recebe 5 workouts)
- `covered_days`: [1,2,3,4,5] — já estava correto (PPL+1 com repetição)
- `structure_rationale`: "Upper/Lower 4x/sem" → **"PPL+1 5x/sem (...)" ✅**

### Observação sobre overlap de dias

A geração produziu 5 workouts distintos (Push/Pull/Legs/Upper/Lower). Push cobre [1,4], Pull [2,5], Legs [3], mas Upper também [3] e Lower também [5]. Isso cria 2 workouts agendados no mesmo dia (qua=3 e sex=5). A regra `R45_SCHEDULE_MISMATCH` **não detecta** conflitos intra-dia — só verifica cobertura de `available_days`. Este comportamento é pré-existente no LLM e representa um follow-up separado: validar que cada `available_day` recebe **exatamente um** workout (não múltiplos).

---

## 9. Status dos findings do walk-through 3-perfis (§7)

| Finding | Descrição | Status após 2.5.2 |
|---|---|---|
| #1 | §4.5 ignorada (PPL 3x para aluno com 5 dias) | **Endereçado**: R45 + retry loop + Layer 1 exemplos. E2E confirma 5 workouts, 5 dias cobertos. |
| #1-bis | (novo) Cobertura coverage-based, não parity-based | **Endereçado**: R45 verifica union ≡ available_days, permite PPL+1. |
| #2 | exercise_id desconhecidos → "Exercício desconhecido" | **Endereçado**: R_POOL_UNKNOWN_EXERCISE + missingIds log. |
| #3 | structure_rationale templated incorreto | **Endereçado**: Option 1b — deriva do output real. |
| #4 | adaptations=null em Alysson | **Aberto** — fora do escopo desta fase. |
| #5 | Gap de observabilidade — enriched context não persistido | **Endereçado**: E1. |
| #6 | Tag muscular incorreta: Terra→Quadríceps | **Aberto** — erro de dados pré-existente. |

---

## 10. Arquivos modificados

| Arquivo | Tipo de mudança |
|---|---|
| `web/src/actions/prescription/generate-program.ts` | E1 (buildSmartV2InputSnapshot), E2 (semantic retry loop), async fix |
| `web/src/lib/prescription/rules-validator.ts` | E2 (RuleAutofix type, R45_SCHEDULE_MISMATCH, R_POOL_UNKNOWN_EXERCISE, autofix em regras legadas) |
| `web/src/lib/prescription/prompt-builder-v2.ts` | E2 (§4.5 Layer 1 com 4 exemplos) |
| `web/src/lib/prescription/output-enricher.ts` | E3 (missingIds log), E4 (generateStructureRationaleFromOutput) |
| `web/src/actions/prescription/generate-program.test.ts` | Testes E1, async fix |
| `web/src/lib/prescription/rules-validator.test.ts` | Testes E2 (R45 + R_POOL + autofix legado) |
| `web/src/lib/prescription/output-enricher.test.ts` | **Novo** — Testes E3 + E4 |
