# Fase 1.5 — Log de Execução

Data: 2026-04-18. Executor: Claude Code (Opus 4.7).

## 1. Entregas

### Arquivos criados

- `supabase/migrations/103_prescription_generations_realtime.sql` — adiciona `public.prescription_generations` à publicação `supabase_realtime`. Idempotente via `EXCEPTION WHEN duplicate_object`.
- `web/src/components/programs/helpers/hydrate-workout.ts` — helper puro `hydrateGeneratedWorkout(gw, exercises): Workout` que converte saída da LLM para o shape do builder. Mora fora de `lib/prescription/` (camada de apresentação), espelha `mapAiOutputToBuilderData` + `initializeWorkouts`.
- `web/src/components/programs/helpers/prescription-animate-flag.ts` — `setPrescriptionAnimateFlag(id)` / `consumePrescriptionAnimateFlag(id)` usando `sessionStorage`. Flag é por-`generationId` (`prescription:animate:{id}`); `consume` lê e remove.
- `web/src/hooks/use-prescription-generation-stream.ts` — hook que subscreve em Realtime + faz fetch inicial, aguarda `output_snapshot` e reveal progressivo controlado por `revealIntervalMs` (0 = tudo de uma vez). Retorna `{ workouts, reasoning, isStreaming, isDone, error, status }`.
- Testes:
  - `web/src/hooks/__tests__/use-prescription-generation-stream.test.ts` — 7 casos cobrindo os 5 cenários do spec §5.1 + reveal instantâneo (revealIntervalMs=0) + output_snapshot=null ignorado.
  - `web/src/components/programs/helpers/__tests__/prescription-animate-flag.test.ts` — 3 casos: ausência de flag, set→consume→re-consume (flag consumida uma vez), isolamento por ID.

### Arquivos editados

- `web/src/components/programs/program-builder-client.tsx`
  - Imports: `usePrescriptionGenerationStream` + `consumePrescriptionAnimateFlag` / `setPrescriptionAnimateFlag`.
  - Novo estado `streamAnimate` (lido do sessionStorage via `useState` initializer — seguro em SSR, `consumePrescriptionAnimateFlag` retorna false quando `window === undefined`).
  - Hook chamado com `generationId: streamAnimate ? prescriptionGenerationId : null` (hook "burro" — só anima quando o consumer pede).
  - `useEffect` de "clear on mount" (flag `streamClearedRef`) — esvazia `workouts` pós-hidratação quando `streamAnimate` está ativo, evitando o flash do conteúdo completo renderizado por SSR.
  - `useEffect` de mirror: espelha `stream.workouts` → `setWorkouts` enquanto anima; ao `isDone`, `streamHandoffDoneRef` marca e o state local vira soberano (o treinador pode editar livremente).
  - `handleAcceptGeneratedProgram` agora chama `setPrescriptionAnimateFlag(generationId)` **antes** de `router.replace` — pre-arma a flag para o próximo mount.
- `supabase/migrations/103_*.sql` — criado; **não aplicado** (Gustavo roda `supabase db push`).

### Arquivos NÃO tocados

- `web/src/lib/prescription/*` — invariante respeitada. O helper novo de hidratação vive em `components/programs/helpers/` e é puro UI.
- `web/src/actions/prescription/generate-program.ts` — pipeline intocado.
- `web/src/app/students/[id]/program/new/page.tsx` — `key={generationId ?? 'blank'}` mantido (decisão 3 do plano aprovado). Zero mudanças.
- `web/src/components/programs/ai-prescription-panel/*` — painel funciona como antes; o único ponto de contato é `onAcceptGeneratedProgram`, cuja implementação no builder foi o lugar certo pra armar a flag.

## 2. Decisões durante execução

Todas alinhadas com o plano aprovado:

1. **Gating via `sessionStorage` (não query param)**. URL limpa, sem re-render do Server Component no fim do reveal. Flag keyed por generationId.
2. **Helper extraído em `components/programs/helpers/hydrate-workout.ts`** — fora de `lib/prescription/` para respeitar a invariante sem necessidade de interpretação. Alternativa aceita no plano.
3. **Hook burro**: a decisão "animar ou não" vive no consumer (builder). `revealIntervalMs=0` é a válvula de escape. O hook sempre faz fetch + subscribe + reveal.
4. **`key={generationId}` preservado**. Não tentei remover preventivamente. Walk-through confirmará se dá para simplificar em follow-up.
5. **Teste de integração do builder degradado**. Conforme autorização do plano: o builder importa 17 deps pesadas (AppLayout, WorkoutPanel, DnD kit, zustand, múltiplos actions) e montar num teste RTL exigiria 5+ mocks não relacionados à streaming logic. Deixei como follow-up para Playwright. Cobertura atual: hook (7 casos) + flag (3 casos) — toda a mecânica está testada isoladamente.

## 3. Verificações automatizadas

- `npx tsc --noEmit` (web) — limpo nos arquivos tocados. Remanescem os mesmos 11 erros pré-existentes em `program-calendar.test.tsx` e `student-insights-card.test.tsx` (não relacionados; já existiam na Fase 1).
- `npx vitest run` — **228/228 passando** (23 arquivos de teste). Partimos de 218, ganhamos 10 novos (7 hook + 3 flag). Nenhuma regressão.

## 4. Walk-through manual — a executar pelo Gustavo

Prerequisite: aplicar a migração (`supabase db push` ou equivalente). Sem ela, o UPDATE no `prescription_generations` não é propagado via Realtime.

1. **Happy path animado.** Trainer com `ai_prescriptions_enabled=true`, `localhost:3000`. Abre `/students/<id>/program/new`, clica "✨ Gerar com IA", preenche anamnese, clica "Gerar programa". Painel vai para `generating`. Quando o pipeline termina, canvas deve popular **um treino por vez** com ~450ms entre cada. Reasoning aparece na última aba.
2. **Refresh durante o reveal.** Enquanto os treinos aparecem, `Cmd+R`. Comportamento esperado: todos os treinos aparecem imediatamente (sem animação) — a flag `sessionStorage` já foi consumida no primeiro mount, e o `key={generationId}` + `initializeWorkouts()` renderizam o programa completo de uma vez.
3. **Outra aba.** Abrir a URL `/program/new?source=prescription&generationId=<id>` em outra aba. Sem flag na `sessionStorage` da nova aba → renderiza tudo imediato.
4. **RLS + Realtime (BLOQUEANTE — Risco 1 do plano).** Durante o cenário 1, abrir DevTools → Network → WS. Deve haver uma conexão para o Realtime Supabase e uma mensagem com o UPDATE trazendo `output_snapshot`. Se nada chegar, a RLS policy `trainer_id = current_trainer_id()` pode estar bloqueando. Sintoma: canvas fica vazio permanentemente. Se acontecer, reportar: arquitetura precisa de polling fallback.
5. **Fallback hoje.** Mesmo se o Realtime não propagar, o fetch inicial (no mount com `generationId` presente) encontra a row já pronta (pipeline terminou antes de navegar) e dispara o reveal. Ou seja: na prática, o caminho atual *não depende* de Realtime — ele cobre o caso de "pipeline terminou depois de navegarmos", que hoje nem ocorre porque o painel só chama `onAcceptGeneratedProgram` *após* o pipeline. Realtime virou "mais certo" do que essencial. Registrado em follow-ups.
6. **Falha de geração.** Se conseguir forçar (p. ex. derrubando a API da LLM), confirmar que o hook expõe `error` e o builder não entra em estado inconsistente. Hoje o painel ainda mostra `error` no seu próprio fluxo (antes de navegar) — esse cenário provavelmente nem chega ao builder.

## 5. Follow-ups sugeridos

Ordem decrescente de prioridade:

1. **Teste de integração do builder via Playwright.** O teste RTL foi degradado por complexidade. Playwright cobriria end-to-end (gerar → animação → refresh mostra tudo).
2. **Fallback de polling se Realtime + RLS não funcionar.** Esqueleto (comentado, não implementado):
   ```ts
   // If after 2s we haven't received a snapshot and row is still missing,
   // start polling: setInterval(() => refetch(generationId), 2000) until
   // we get output_snapshot or status='failed'. Clear on unmount / success.
   ```
   Implementar **só se** walk-through §4 revelar que Realtime bloqueia.
3. **Remover `key={generationId}` no `program/new/page.tsx`.** Com o hook, o remount forçado talvez seja redundante — o builder já trata transições de prop via efeitos. Testar removendo depois do walk-through; se a hidratação continuar funcionando, simplifica.
4. **Streaming *durante* a geração (não só depois).** Requer backend criar row `status='generating'` no início do pipeline + UPDATE final. O hook já trata `output_snapshot=null` (cenário 6 de teste) — ficará pronto. Esta é a "Fase 1.5+".
5. **Auto-fechar o painel IA após `isDone`.** Hoje o treinador precisa clicar "Fechar painel" manualmente. UX minor.
6. **Cancelamento durante reveal.** Trivial com `setRevealedCount` mas não pedido; adicionar se usuários reclamarem.
7. **Consolidar `hydrateGeneratedWorkout` com `mapAiOutputToBuilderData` + `initializeWorkouts`.** Hoje há duas conversões (snapshot → templates → Workout[] via builder; snapshot → Workout[] via helper novo). Drift é possível. Uma única função pura canônica reduziria superfície. Requer mover `Workout` interface para fora do `program-builder-client.tsx`.
8. **Hook trata `output_snapshot=null` em `status='generating'`** (linha ~182 do hook): ignora silenciosamente, como documentado. Quando a Fase 1.5+ inserir row cedo, isso já funciona — mas confirmar com teste adicional na época.

## 6. Checklist da Fase 1.5

- [x] Migração Realtime criada (não aplicada — fica com você). Idempotente.
- [x] Hook `usePrescriptionGenerationStream` com 7 testes verdes, cobrindo os 5 cenários do spec §5.1.
- [x] `ProgramBuilderClient` consome o hook quando `streamAnimate === true` (flag sessionStorage presente).
- [x] `AiPrescriptionPanel.pageState` transita normalmente — sem regressão (painel → `done` → fecha; canvas anima em paralelo).
- [ ] Walk-through manual registrado — **pendente**; passo a passo em §4 acima, bloqueante para fechar a fase (especialmente §4.4 sobre Realtime+RLS).
- [x] `npx tsc --noEmit` verde nos arquivos tocados.
- [x] Testes existentes continuam passando (228 agora; partimos de 218).

## 7. Sequência de trabalho executada

1. ✅ Migração Realtime (idempotente com `WHEN duplicate_object`).
2. ✅ Helper `hydrate-workout.ts` (pure).
3. ✅ Hook `usePrescriptionGenerationStream` (typecheck limpo na primeira tentativa após ajuste de `@ts-expect-error`).
4. ✅ Testes do hook (7 casos; ajuste: `waitFor` + fake timers não combinam — substituído por `advanceTimersByTimeAsync`).
5. ✅ Helper `prescription-animate-flag.ts` + 3 testes.
6. ✅ Integração no `ProgramBuilderClient`: `streamAnimate` via `useState(initializer)` (SSR-safe), duplo `useEffect` (clear + mirror), handler `setPrescriptionAnimateFlag` antes do `router.replace`.
7. ✅ Suite completa: 228/228.
8. ✅ Log.
