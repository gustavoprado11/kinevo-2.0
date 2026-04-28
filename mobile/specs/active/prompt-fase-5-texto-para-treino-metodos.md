# Prompt Claude Code — Fase 5: Texto para Treino entende métodos avançados

> Cole numa nova sessão do Claude Code. **Workflow:** apenas modificações no working tree. **NÃO faça `git commit` nem `git push`.** Working tree continua acumulando até autorização final do Gustavo.
>
> Releia `mobile/specs/WORKFLOW.md` e `mobile/CLAUDE.md` antes de começar.

---

A frente de "métodos avançados" foi mergeada em main (Fases 4.5d-l). Toda a infra do per-set + rondas + presets está pronta no banco, no shared e nas UIs (web + mobile + execução do aluno). Falta agora a **última peça**: o **Texto para Treino** (parser de IA via Edge Function) precisa aprender a entender quando o trainer cola texto livre descrevendo métodos avançados.

**Cenário hoje:**
- Trainer cola: `"Supino reto pirâmide 12-10-8-6 desc 90s"`
- Parser interpreta: `{ sets: 4, reps: "12-10-8-6", rest_seconds: 90, set_scheme: null, method_key: null }`
- Builder mostra modo simples — perdeu o conceito de pirâmide.

**Cenário alvo:**
- Mesmo texto colado.
- Parser interpreta: `{ sets: 4, reps: "12-10-8-6", rest_seconds: 90, method_key: 'pyramid_down', set_scheme: [4 fases com reps decrescentes], rounds: 1 }`
- Builder abre o card já em modo Avançado, chip "Pirâmide ↓" ativo, 4 fases preenchidas.

Aplica em 6 padrões de texto:
1. **Pirâmide ↓** ("pirâmide 12-10-8-6", "decrescente 12/10/8/6", "10 a 6 reps")
2. **Pirâmide ↑** ("pirâmide crescente 6-8-10-12", "6 a 12 reps")
3. **Drop-set** ("drop-set 3 rondas 10/8/6 com -20%", "10 + drop 8 + drop 6")
4. **Top + Backoff** ("1x5 top + 3x8 a 80%", "top set 5RM, depois 3 backoff")
5. **5×5** ("5x5", "5 séries de 5 reps")
6. **Cluster (rest-pause)** ("rest-pause 8+4+2", "cluster 3 rondas 8/4/2")

## 0. Pré-checagens

```bash
gh auth status
git status        # working tree DEVE estar limpo (após push da feature anterior)
git log --oneline -10
# Confira commits da batch anterior em main (4.5d-l)
```

Se o working tree não estiver limpo, **PARA** e reporta — não começa Fase 5 com lixo de outra fase.

## 1. Ler estado atual

```bash
cat supabase/functions/parse-workout-text/index.ts | head -150
cat web/src/app/api/prescription/parse-text/types.ts
cat web/src/components/programs/ai-prescribe-panel.tsx | grep -A 30 "ParsedExercise\|onAddExerciseToWorkout"
cat mobile/components/trainer/student/TextPrescriptionSheet.tsx | head -100
cat mobile/stores/program-builder-store.ts | grep -A 30 "initFromParsedText"
cat shared/lib/prescription/set-scheme-presets.ts
cat shared/lib/prescription/set-scheme.ts | grep -A 20 "applyPreset\|expandSchemeByRounds"
```

Entende a estrutura: qual o shape atual de `ParsedExercise`, como o builder consome, como os presets do shared estão estruturados.

## 2. Estender tipos compartilhados

`web/src/app/api/prescription/parse-text/types.ts`:

```ts
import type { WorkoutSet, MethodKey } from '@kinevo/shared/types/prescription'

export interface ParsedExercise {
  matched: boolean
  exercise_id: string | null
  catalog_name: string | null
  original_text: string
  sets: number
  reps: string
  rest_seconds: number | null
  notes: string | null
  superset_group: string | null
  // NOVOS campos:
  method_key: MethodKey | null
  set_scheme: WorkoutSet[] | null
  rounds: number | null   // 1 pra linear, 2+ pra compound
}
```

Mantém `sets/reps/rest_seconds` agregados pra compat com programas simples — quando `set_scheme` é preenchido, eles ficam como resumo derivado (igual ao padrão do builder web/mobile).

## 3. Edge Function — `supabase/functions/parse-workout-text/index.ts`

### 3.1 Estender o `SYSTEM_PROMPT` (~linhas 24-121)

Adiciona uma seção nova **antes** do "SUPERSETS / BI-SETS / TRI-SETS":

```
MÉTODOS AVANÇADOS DE PRESCRIÇÃO:

Quando o texto descrever séries com reps/cargas/descansos diferentes entre si,
ou usar termos de métodos específicos, identifique o método e preencha os
campos `method_key`, `set_scheme` e `rounds`.

Padrões a reconhecer:

PIRÂMIDE DECRESCENTE (method_key: "pyramid_down"):
- "pirâmide 12-10-8-6" → 4 fases decrescentes, rounds=1
- "decrescente 10/8/6" → 3 fases, rounds=1
- "10 a 6 reps" (com indicação de pirâmide)
- Output: cada fase é set_type "normal", reps escalando pra baixo

PIRÂMIDE CRESCENTE (method_key: "pyramid_up"):
- "pirâmide crescente 6-8-10-12" → 4 fases crescentes, rounds=1
- "6 a 12 reps em pirâmide"
- Output: cada fase set_type "normal", reps escalando pra cima

DROP-SET (method_key: "drop_set", rounds=N≥1):
- "drop-set 3 rondas 10/8/6 com -20%" → rounds=3, scheme=[normal/drop/drop]
- "10 reps + drop 8 + drop 6" → rounds=1, scheme=[normal/drop/drop]
- "drop-set 2 rondas 12-8" → rounds=2, scheme=[normal 12 reps, drop 8 reps]
- Output: 1ª fase set_type "normal", demais "drop". Rest curto (0-15s) entre
  drops, rest longo (60-120s) entre rondas (descanso da ÚLTIMA fase).

TOP + BACKOFF (method_key: "top_backoff"):
- "1x5 top + 3x8 a 80%" → scheme=[top 5 reps, backoff 8, backoff 8, backoff 8]
- "top set 5RM, depois 3 backoff a 75%" → similar
- Output: 1ª fase set_type "top" reps mais baixas, demais "backoff" com
  carga reduzida (geralmente 75-85% do top).

5x5 (method_key: "5x5"):
- "5x5" → 5 fases iguais de 5 reps, set_type "normal"
- "5 séries de 5 reps" → idem
- Output: rounds=1, scheme com 5 fases idênticas

CLUSTER / REST-PAUSE (method_key: "cluster"):
- "cluster 3 rondas 8+4+2" → rounds=3, scheme=[3 fases com pausa curta entre]
- "rest-pause 8+4+2" → rounds=1, scheme=[fase 1 reps "8", fase 2 reps "4",
  fase 3 reps "2"], set_type "cluster" em todas. Rest 15-20s entre clusters.
- "10 reps com 3 mini-pausas até falha" → cluster com reps "10" e set_type
  "cluster"
- Output: set_type "cluster" em todas as fases, rest curto (15-20s) entre
  fases dentro de uma rondada.

REGRAS DE COERÊNCIA:
- Quando `set_scheme` for preenchido, `sets` deve = total de fases × rounds
- `reps` agregado deve refletir resumo do scheme (ex.: "12-10-8-6" pra pirâmide)
- `rest_seconds` agregado = rest da PRIMEIRA fase
- `method_key` deve estar em: pyramid_down, pyramid_up, drop_set, top_backoff,
  5x5, cluster, ou null se for método simples sem padrão
- `rounds` >= 1, default 1 quando linear

Quando o texto NÃO mencionar nenhum método nem variação entre séries, mantém
o comportamento atual: set_scheme=null, method_key=null, rounds=null.
```

Estende o exemplo de output no prompt pra incluir um caso com `set_scheme`:

```json
{
  "matched": true,
  "exercise_id": "uuid",
  "catalog_name": "Supino Reto com Barra",
  "original_text": "supino reto pirâmide 12-10-8-6 desc 90s",
  "sets": 4,
  "reps": "12-10-8-6",
  "rest_seconds": 90,
  "notes": null,
  "superset_group": null,
  "method_key": "pyramid_down",
  "rounds": 1,
  "set_scheme": [
    {"set_number":1,"set_type":"normal","reps":"12","rest_seconds":90},
    {"set_number":2,"set_type":"normal","reps":"10","rest_seconds":90},
    {"set_number":3,"set_type":"normal","reps":"8","rest_seconds":90},
    {"set_number":4,"set_type":"normal","reps":"6","rest_seconds":90}
  ]
}
```

### 3.2 Atualizar interface `ParsedExercise` na própria Edge Function

```ts
interface ParsedExercise {
  matched: boolean;
  exercise_id: string | null;
  catalog_name: string | null;
  original_text: string;
  sets: number;
  reps: string;
  rest_seconds: number | null;
  notes: string | null;
  superset_group: string | null;
  // NOVOS:
  method_key: string | null;
  rounds: number | null;
  set_scheme: WorkoutSet[] | null;
}

interface WorkoutSet {
  set_number: number;
  set_type: string;
  reps: string;
  rest_seconds: number;
  weight_kg?: number | null;
  weight_pct1rm?: number | null;
  rir?: number | null;
  tempo?: string | null;
  notes?: string | null;
}
```

### 3.3 Estender `validateAndFixResponse` (~linha 384)

Adiciona validações coerência pra os campos novos:

```ts
function validateAndFixResponse(parsed: unknown, exerciseIds: Set<string>): ParseTextResponse | null {
  // ... validação existente

  for (const workout of response.workouts) {
    if (!Array.isArray(workout.exercises)) continue
    for (const ex of workout.exercises) {
      // ... validações existentes (matched, exercise_id)

      // VALIDAÇÕES NOVAS:

      // method_key tem que estar no enum válido ou ser null
      const VALID_METHODS = ['pyramid_down', 'pyramid_up', 'drop_set', 'top_backoff', '5x5', 'cluster', 'standard', 'custom']
      if (ex.method_key && !VALID_METHODS.includes(ex.method_key)) {
        ex.method_key = null
      }

      // rounds tem que ser >= 1 ou null
      if (ex.rounds !== null && ex.rounds !== undefined) {
        if (typeof ex.rounds !== 'number' || ex.rounds < 1 || ex.rounds > 20) {
          ex.rounds = 1
        }
      }

      // set_scheme tem que ser array válido ou null
      if (ex.set_scheme !== null && ex.set_scheme !== undefined) {
        if (!Array.isArray(ex.set_scheme) || ex.set_scheme.length === 0) {
          ex.set_scheme = null
          ex.method_key = null
          ex.rounds = null
        } else {
          // Valida cada fase
          const VALID_SET_TYPES = ['warmup', 'normal', 'top', 'backoff', 'drop', 'failure', 'cluster', 'amrap']
          let valid = true
          for (let i = 0; i < ex.set_scheme.length; i++) {
            const phase = ex.set_scheme[i]
            if (typeof phase !== 'object' || !phase) { valid = false; break }
            // set_number sequencial 1..N
            phase.set_number = i + 1
            // set_type no enum
            if (!VALID_SET_TYPES.includes(phase.set_type)) phase.set_type = 'normal'
            // reps obrigatório
            if (!phase.reps) phase.reps = '10'
            // rest_seconds default 0 se ausente
            if (typeof phase.rest_seconds !== 'number') phase.rest_seconds = 0
          }
          if (!valid) {
            ex.set_scheme = null
            ex.method_key = null
            ex.rounds = null
          }
        }
      }

      // Coerência: se set_scheme está preenchido, ajusta agregados
      if (ex.set_scheme && ex.set_scheme.length > 0) {
        const rounds = ex.rounds ?? 1
        ex.sets = ex.set_scheme.length * rounds
        ex.reps = ex.set_scheme.map((p: any) => p.reps).join('-')
        ex.rest_seconds = ex.set_scheme[0].rest_seconds
      }
    }
  }

  return response
}
```

### 3.4 Mensagem de commit (sugerida — não execute agora)

```
feat(per-set): teach parse-workout-text edge function to recognize advanced methods

- System prompt extended with 6 method patterns (pyramid_up/down, drop_set,
  top_backoff, 5x5, cluster) and coherence rules
- ParsedExercise type extended with method_key, rounds, set_scheme
- validateAndFixResponse coerces invalid fields and enforces aggregate
  coherence with set_scheme
```

## 4. Bridge web — `ai-prescribe-panel.tsx`

Localiza onde o painel chama `onAddExerciseToWorkout` (linha ~82-102 segundo a spec original):

```ts
// ANTES
onAddExerciseToWorkout(targetWorkoutId, exerciseObj, {
  sets: parsedEx.sets,
  reps: parsedEx.reps,
  rest_seconds: parsedEx.rest_seconds,
  notes: parsedEx.notes,
})

// DEPOIS
onAddExerciseToWorkout(targetWorkoutId, exerciseObj, {
  sets: parsedEx.sets,
  reps: parsedEx.reps,
  rest_seconds: parsedEx.rest_seconds,
  notes: parsedEx.notes,
  method_key: parsedEx.method_key,
  set_scheme: parsedEx.set_scheme,
  rounds: parsedEx.rounds ?? 1,
})
```

E `addExerciseFromLibrary` ou similar em `program-builder-client.tsx` precisa aceitar esses campos no payload (provavelmente já aceita após Fase 4.4).

### Mensagem de commit (sugerida)

```
feat(per-set): web ai-prescribe-panel propagates set_scheme/method_key/rounds to builder
```

## 5. Bridge mobile — `TextPrescriptionSheet.tsx` + `program-builder-store.ts`

### 5.1 Atualiza interface `ParsedExercise` local em `TextPrescriptionSheet.tsx`

Adiciona os 3 campos novos. Repassa pro callback `onParsed`.

### 5.2 `mobile/stores/program-builder-store.ts → initFromParsedText`

Localiza a função (linha ~239 segundo spec). No mapping de cada `ParsedExercise` pra `WorkoutItem`:

```ts
const item: WorkoutItem = {
  // ... campos existentes
  sets: parsedEx.sets,
  reps: parsedEx.reps,
  rest_seconds: parsedEx.rest_seconds ?? 60,
  notes: parsedEx.notes,
  // NOVOS:
  method_key: parsedEx.method_key,
  set_scheme: parsedEx.set_scheme,
  rounds: parsedEx.rounds ?? 1,
  // ...
}
```

### Mensagem de commit (sugerida)

```
feat(per-set): mobile TextPrescriptionSheet + initFromParsedText propagate set_scheme
```

## 6. Validações locais

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..

# Edge Function (Deno)
cd supabase/functions/parse-workout-text && deno check index.ts && cd ../../..
```

Mantém baselines.

## 7. Deploy da Edge Function (REQUER AUTORIZAÇÃO DO GUSTAVO)

A Edge Function só funciona em produção depois de deployada. **NÃO faça deploy automático** — pede autorização explícita ao Gustavo no chat:

> "Pronto pra deployar a versão atualizada da Edge Function `parse-workout-text` no Supabase via MCP. Isso vai imediatamente ativar a detecção de métodos avançados no Texto para Treino. Posso deployar?"

Espera o "ok" antes de chamar `mcp__claude_ai_Supabase__deploy_edge_function`.

Quando deployar, valida com um teste rápido: pede pro Gustavo colar um texto tipo "supino reto pirâmide 12-10-8-6" e confirma que o resultado tem `method_key: "pyramid_down"` e `set_scheme` com 4 fases.

## 8. NÃO commita, NÃO empurra (per WORKFLOW.md)

Atualize a spec `mobile/specs/active/prescricao-per-set-manual.md` adicionando notas dessa fase no working tree, rode `git status` final, e pare.

## 9. Reporte final

```
FASE 5 — Texto para Treino entende métodos avançados (working tree, sem commit)

Mudanças aplicadas:

1. Tipos compartilhados:
   - ParsedExercise estendido com method_key, rounds, set_scheme

2. Edge Function parse-workout-text:
   - SYSTEM_PROMPT estendido com 6 padrões de método + regras de coerência
   - Interface ParsedExercise + WorkoutSet declaradas
   - validateAndFixResponse com coerção e validação dos campos novos
   - Status de deploy: <DEPLOYED via MCP / PENDENTE autorização>

3. Bridge web (ai-prescribe-panel.tsx):
   - Propaga method_key, set_scheme, rounds pro builder

4. Bridge mobile (TextPrescriptionSheet.tsx + initFromParsedText):
   - Propaga method_key, set_scheme, rounds pra program-builder-store

Mensagens de commit sugeridas (não execute agora — aguarda autorização do batch):
  - feat(per-set): teach parse-workout-text edge function to recognize advanced methods
  - feat(per-set): web ai-prescribe-panel propagates set_scheme/method_key/rounds to builder
  - feat(per-set): mobile TextPrescriptionSheet + initFromParsedText propagate set_scheme

Arquivos modificados (working tree):
  supabase/functions/parse-workout-text/index.ts
  web/src/app/api/prescription/parse-text/types.ts
  web/src/components/programs/ai-prescribe-panel.tsx
  web/src/components/programs/program-builder-client.tsx (se precisar ajuste no payload)
  mobile/components/trainer/student/TextPrescriptionSheet.tsx
  mobile/stores/program-builder-store.ts
  mobile/specs/active/prescricao-per-set-manual.md (notas Fase 5)

Validações:
  shared: 142/142
  web TS: 11 erros baseline (idêntico)
  web vitest: <X>/<X>
  mobile TS: 10 erros baseline
  mobile vitest: 255/255
  Edge function deno check: limpo

Próximos passos do Gustavo:
1. Web local (npm run dev): builder → "Texto para treino" → cola
   "Supino reto pirâmide 12-10-8-6 desc 90s" → conferir que builder
   abre o card em modo Avançado com chip "Pirâmide ↓" e 4 fases.
2. Testar outros padrões: "5x5", "drop-set 3 rondas 10/8/6 com -20%",
   "rest-pause 8+4+2", "1x5 top + 3x8 a 80%".
3. Mobile (simulador): TextPrescriptionSheet → mesmo teste.
4. Quando satisfeito visualmente, autoriza o batch da Fase 5.

Estado: working tree acumulando Fase 5. SEM commits, SEM push.
```

## 10. Edge cases

- **LLM retorna `method_key` inválido** (ex.: "drop set" com espaço): `validateAndFixResponse` coerce pra `null`. set_scheme também é descartado se inconsistente.
- **`set_scheme` com `set_number` duplicado**: `validateAndFixResponse` força sequencial 1..N.
- **Texto ambíguo** (ex.: "supino 4x10 piramide"): LLM decide. Se retornar set_scheme válido, aceita. Se confuso, retorna agregado simples.
- **Texto sem método** (ex.: "supino 3x10"): comportamento atual mantido. set_scheme=null.
- **Cluster sem rounds explícito**: assume rounds=1 (LLM deve preencher).

## 11. Iterar / desfazer

- Working tree: edita arquivos in-place.
- Voltar arquivo: `git checkout -- <arquivo>`.
- NÃO `git reset --hard origin/main`.

Tudo claro? Confirme com "Fase 5 — começando" e parta da pré-checagem.
