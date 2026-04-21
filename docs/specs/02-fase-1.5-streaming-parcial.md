# Fase 1.5 — Reveal progressivo de workouts (streaming percebido)

**Pré-leitura obrigatória:** `00-visao-geral.md` e `01-fase-1-embutir-painel-ia.md`.

## 1. Objetivo

Quando o treinador clica "Gerar programa" no painel de IA, o canvas não deve ficar estático com um spinner por 15–30s. Os treinos (Treino A, B, C, D…) devem **aparecer um a um no canvas**, dando a sensação de que a IA está "montando o programa na frente dele".

Escopo é **só UX de percepção**. O pipeline da LLM (rules-engine → exercise-selector → slot-builder → optimizer) **não muda**. Continuamos gerando o programa completo num passo só. O que muda é **como o client revela o resultado**.

## 2. Decisão de abordagem (e por quê)

Histórico: a versão anterior desta spec propunha commits parciais reais — refatorar o pipeline para gerar um workout por vez e persistir cada um no `prescription_generations.output_snapshot.workouts[]`. Foi reavaliado em 18/abr/2026 e descartado.

Motivo: mexer no core de prescription (rules-engine, optimizer) para torná-lo iterativo é um refactor grande, toca uma invariante do `00-visao-geral.md` §4 ("preservar pipeline da LLM"), e o benefício real é marginal — a geração leva 8–15s no caminho típico, e o que o trainer quer é ver progresso, não necessariamente ver exercícios reais aparecendo no exato momento em que a LLM os gera.

**Decisão: pipeline intacto, reveal progressivo no client.**

Arquitetura:

1. **Backend gera tudo de uma vez** (como hoje): `generateProgram` roda o pipeline completo, escreve `output_snapshot` com todos os workouts, `status='pending_review'`.
2. **Client subscreve via Supabase Realtime** na row do `prescription_generations` enquanto espera.
3. **Quando chega o UPDATE** (geração terminou), o client **não renderiza tudo de uma vez**. Em vez disso, usa um timer que empurra os workouts um a um no state com intervalo de ~450ms entre cada.
4. **Reasoning** aparece por último (ou simultâneo ao último workout).

Trade-offs aceitos:

- Não é streaming real. Se a LLM levar 20s, o trainer espera esses 20s antes de ver qualquer workout (fase "analisando/gerando" no painel IA cobre isso — já existe).
- O delay de 450ms entre workouts é arbitrário. Um programa de 4 treinos vira ~1.8s de animação após a geração terminar. É o suficiente para parecer "a IA está montando" sem atrasar trabalho real.
- Se a LLM terminar super rápido (5s) e a animação adicionar mais 2s, o tempo total percebido é maior do que seria sem animação. É o trade-off consciente: preferimos perceber progresso.

## 3. Arquitetura alvo

### 3.1 Backend — mudanças mínimas

**Route Handler já existe:** `web/src/app/api/prescription/generate/route.ts`. Continua chamando o agente como hoje. **Nenhuma mudança de pipeline.**

**Uma migração só** — adicionar `prescription_generations` à publicação Realtime:

```sql
-- web/supabase/migrations/0XX_prescription_generations_realtime.sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.prescription_generations;
```

Verificar se a RLS atual (`trainer_id = current_trainer_id()`) é respeitada por Realtime quando o client subscreve. Supabase Realtime filtra por RLS desde 2023 — mas adicionar um teste manual no walk-through.

### 3.2 Frontend — novo hook `usePrescriptionGenerationStream`

Arquivo novo: `web/src/hooks/use-prescription-generation-stream.ts`.

Responsabilidade:

- Recebe um `generationId` (pode ser null enquanto ainda não foi criado).
- Subscreve em `postgres_changes` na tabela `prescription_generations` filtrando por `id=eq.${generationId}`.
- Quando chega `status='pending_review'` com `output_snapshot` preenchido, **dispara o reveal**: emite workouts um a um com `setTimeout(..., REVEAL_INTERVAL_MS * i)`.
- Expõe: `{ workouts: Workout[], reasoning: PrescriptionReasoningExtended | null, isStreaming: boolean, isDone: boolean }`.

Assinatura aproximada:

```ts
interface UsePrescriptionGenerationStreamArgs {
  generationId: string | null
  studentId: string
  exercises: Exercise[]
  revealIntervalMs?: number // default 450
}

interface UsePrescriptionGenerationStreamReturn {
  workouts: Workout[]           // accumulating as reveal progresses
  reasoning: PrescriptionReasoningExtended | null
  isStreaming: boolean          // true until reveal completes
  isDone: boolean               // true when all workouts revealed
  error: string | null
}
```

Estado interno:

- `pendingSnapshot: PrescriptionOutputSnapshot | null` — o snapshot completo já recebido do DB.
- `revealedCount: number` — quantos workouts já foram empurrados para `workouts`.
- Um timer que incrementa `revealedCount` a cada `revealIntervalMs` até atingir `pendingSnapshot.workouts.length`.

### 3.3 Integração no `ProgramBuilderClient`

**Problema atual (Fase 1 resolveu parcialmente):** hoje o builder depende de SSR — quando `generationId` aparece na URL, o server re-renderiza e passa `program` novo. O fix da Fase 1 (key={generationId}) força remount e funciona, mas é all-or-nothing: ou aparece tudo, ou nada.

**Para a 1.5:** o builder precisa aceitar workouts chegando incrementalmente. Caminho menos invasivo:

- Quando `prescriptionGenerationId` está presente **e** o pipeline ainda não terminou, `ProgramBuilderClient` usa o hook e **ignora a prop `program`** (que estará null nesse momento).
- Quando o reveal completa (`isDone === true`), o state local `workouts` já está populado pelo hook; a navegação via `router.replace` continua funcionando para persistir a URL.

Sinal "pipeline terminou" vem do hook (que vê o UPDATE no DB). Sinal "ainda não começou" é `generationId` presente mas row ainda não existe no DB — o hook faz um fetch inicial; se row não existir, espera insert via Realtime.

Alternativa discutida e rejeitada: fazer o `program/new/page.tsx` aguardar o DB ter a row antes de renderizar. Ruim porque trava o SSR por segundos e o Next dá timeout.

### 3.4 Mudança no painel IA

Hoje o painel IA gerencia `pageState = 'generating'` internamente e chama `onAcceptGeneratedProgram(generationId)` quando termina, o que dispara `router.replace(?generationId=...)`.

Na 1.5, o fluxo muda:

- Assim que o backend cria a row (pode ser `status='generating'` num estado inicial, ou inserir já depois de terminar — simplificar é inserir apenas quando pronto, como hoje), o Route Handler devolve o `generationId` imediatamente.
- O painel chama `onAcceptGeneratedProgram(generationId)` **antes** do pipeline terminar, **se** conseguirmos obter o ID cedo.

Problema: hoje o Route Handler só devolve `generationId` **depois** do pipeline completo (a row é inserida no fim do `generateProgram`). Para a Fase 1.5 dar "sensação de streaming" real, precisamos inserir a row mais cedo.

**Decisão pragmática:** manter como está. O pipeline termina, row é criada, URL atualizada, e o **reveal client-side** dá a sensação de streaming. Não é perfeito, mas é zero-refactor no pipeline.

Se depois quisermos reveal *durante* a geração, precisamos criar row com `status='generating'` no início do pipeline e UPDATE no fim. Fica como follow-up.

## 4. Escopo concreto desta fase

### 4.1 Arquivos a criar

- `web/supabase/migrations/0XX_prescription_generations_realtime.sql` — 1 linha.
- `web/src/hooks/use-prescription-generation-stream.ts` — o hook.
- `web/src/hooks/__tests__/use-prescription-generation-stream.test.ts` — testes com mock de Realtime channel + timers fake (vitest fake timers).

### 4.2 Arquivos a editar

- `web/src/components/programs/program-builder-client.tsx`:
  - Ler do hook quando `prescriptionGenerationId` está presente.
  - Substituir o state `workouts` local pelo combinado (hook fornece até terminar; depois o state interno assume).
  - Remover o `key={generationId}` do `program/new/page.tsx` (se ele ainda for necessário depois que o hook existir) — ou manter, se ajudar. Decidir com `console.log` no walk-through.
- `web/src/app/students/[id]/program/new/page.tsx`:
  - Se mantiver `key={generationId}`, ok. Se trocar para a estratégia do hook, remover o `key` e deixar o componente sobreviver entre states.
- `web/src/components/programs/ai-prescription-panel/student-tab.tsx`:
  - O estado `pageState='generating'` pode ficar mais curto (ou sumir) quando o reveal começa. Validar visualmente.

### 4.3 Nada a mexer

- Nenhum arquivo em `web/src/lib/prescription/*` (pipeline da LLM).
- Nenhum arquivo em `web/src/actions/prescription/generate-program.ts`.
- Nenhuma outra migração além da do Realtime.

## 5. Testes

### 5.1 Unitário — `use-prescription-generation-stream`

Mock do `supabase.channel().on('postgres_changes', ...)` usando um event emitter. Cenários:

1. `generationId=null` → hook fica idle, sem workouts.
2. `generationId` válido, row ainda não existe → hook em `isStreaming=false, isDone=false, workouts=[]`.
3. Realtime emite UPDATE com `output_snapshot` contendo 4 workouts → com fake timers, após `revealIntervalMs*1` o `workouts.length === 1`, após `*2` é 2, etc. Após `*4` `isDone === true`.
4. Realtime emite UPDATE com `status='failed'` → hook expõe `error`.
5. Row já existe quando o hook monta (refresh no meio do reveal) → fetch inicial popula `pendingSnapshot`, reveal começa do zero.

### 5.2 Componente — `ProgramBuilderClient` com hook

Teste que:

- Renderiza com `prescriptionGenerationId` e `program=null`.
- Mocka o hook para emitir workouts progressivamente.
- Verifica que abas aparecem uma a uma.

### 5.3 Walk-through manual

1. Gerar programa no painel IA (trainer real, `localhost:3000`).
2. Observar: durante a geração, canvas vazio + painel em `pageState='generating'`.
3. Quando termina: Treino A aparece → pausa ~450ms → Treino B → … → reasoning aparece.
4. Refresh da página durante o reveal: workouts que ainda não foram revelados aparecem imediatamente (sem animação, porque snapshot já completo no DB).
5. Abrir em outra aba: mesma row, mesmo comportamento.

Registrar em `docs/specs/logs/fase-1.5-execucao.md`.

## 6. Checklist de pronto

- [ ] Migração Realtime criada e aplicada.
- [ ] Hook `usePrescriptionGenerationStream` implementado com testes (cobertura dos 5 cenários).
- [ ] `ProgramBuilderClient` consome o hook quando `prescriptionGenerationId` presente.
- [ ] `AiPrescriptionPanel` `pageState` transita corretamente (não fica preso em "generating" depois que reveal começa).
- [ ] Walk-through manual registrado.
- [ ] `npx tsc --noEmit` verde nos arquivos tocados.
- [ ] Testes existentes continuam passando (218 hoje).

## 7. Follow-ups (fora do escopo da 1.5)

- Row criada com `status='generating'` no início do pipeline + UPDATE no fim — habilita reveal durante a geração (não só depois).
- Regeneração de workout individual ("regenerar Treino C") — a arquitetura proposta não tranca, mas requer backend separado.
- Cancelamento durante reveal — trivial (setRevealedCount suficiente).

## 8. Riscos

- **Realtime + RLS**: se RLS quebrar subscribe (o que historicamente acontece quando policy usa função custom tipo `current_trainer_id()`), o hook nunca recebe UPDATE. Mitigação: teste manual no walk-through é bloqueante.
- **Race: URL muda antes do DB ter a row.** Se `router.replace` disparar antes do INSERT ser propagado pelo Realtime, o hook faz fetch inicial; se vier vazio, espera Realtime. Cobrir no teste cenário 2.
- **Trocar `key={generationId}` pode regredir o fix atual.** Se o hook não cobrir 100% dos casos (ex: trainer edita algo e depois abre o painel IA de novo), perdemos a proteção do remount. Decisão em tempo de implementação, com teste manual explícito.
