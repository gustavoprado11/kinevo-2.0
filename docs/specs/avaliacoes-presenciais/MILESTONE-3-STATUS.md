# Milestone 3 — Mobile Capture Flow: status final

## Estado: pronto para commit

Cobertura completa do flow trainer-side de avaliações presenciais no mobile, dividida em 4 sub-blocos (B1 infra, B2 inputs/wizard, B3 telas/integração, B4 polish/sex-age/cleanup). Todos os bugs encontrados durante smoke tests foram corrigidos e revalidados.

- TypeScript: zero novos erros em `mobile/`. Baseline pré-existente de 10 erros únicos (todos em `useLiveActivity.ts`, `useTrainerChat.ts`, `useTrainerChatRoom.ts`, `useWorkoutSession.ts` — herdados de antes do M1).
- Pre-existing failing test: `lib/prescription/__tests__/set-type-labels.test.ts` (Drop ≠ DROP) — registrado para próxima limpeza, fora do escopo M3.
- Migration 122 (M1) já aplicada em prod. Engine M2 já em main.
- Sem nova dep adicionada.

## Arquivos criados/modificados

### Store
- `mobile/stores/assessmentDraftStore.ts` (novo, ~400 linhas) — Zustand + MMKV persist, `Record<sessionId, AssessmentDraft>`, GC automático em drafts antigos, helpers de mutação por test_id.

### Hooks (mobile/hooks/)
- `useAssessmentSessionDraft.ts` (novo) — accessor memoizado por sessionId (callbacks bound ao draft do Zustand)
- `useAssessmentSessionLifecycle.ts` (novo) — orquestra create + syncBatch (com `_synced` filter) + finalize com engine M2
- `useAssessmentMeasurementForm.ts` (novo) — state local de input numérico com validação eager
- `useStudentMetricsTimeline.ts` (novo) — série temporal por métrica
- `useAssessmentResultComparison.ts` (novo) — busca sessão anterior + computa deltas
- `useAssessmentTemplates.ts` (novo) — lista templates `category='assessment'`
- `useAssessmentSession.ts` (estendido) — placeholder M1 → fetch + saveMeasurements + finalize + orphan detection
- `useAssessmentSessions.ts` (estendido) — placeholder M1 → +filter, +inProgressDrafts, +counts, +badge

### Helpers (mobile/lib/)
- `assessmentComputed.ts` (novo) — `evaluateComputed`, `isComputedReady`, `buildComputedMetricsFromSchema`, `pickNumeric`, `readSubjectContext` + constantes `SUBJECT_SEX_KEY`/`SUBJECT_AGE_KEY`

### Componentes (mobile/components/trainer/assessments/)
- `inputs/NumericUnitInput.tsx` (novo)
- `inputs/BilateralNumericInput.tsx` (novo)
- `inputs/MultiAttemptInput.tsx` (novo)
- `inputs/ComputedDisplay.tsx` (novo)
- `inputs/ProtocolWizard.tsx` (novo)
- `MeasurementWizard.tsx` (novo) — chrome com header/progress/footer/range warning modal
- `AnatomyDiagram.tsx` (novo) — silhueta única + 9 markers + toggle frente/costas
- `SessionListItem.tsx` (novo)
- `SessionStatusBadge.tsx` (novo)
- `CreateSessionModal.tsx` (novo) — 3 steps: aluno → template → confirmar (com sex/age + quando + notas)
- `TestChecklistItem.tsx` (novo) — agora inclui `value_summary` inline
- `ResultStatsCard.tsx` (novo)
- `ResultComparisonRow.tsx` (novo)
- `HistoryMiniChart.tsx` (novo) — sparkline SVG inline

### Telas (mobile/app/)
- `assessments/[sessionId].tsx` (novo) — checklist + finalize
- `assessments/[sessionId]/measure/[testId].tsx` (novo) — wizard
- `assessments/[sessionId]/result.tsx` (novo) — stats + comparativo + sparklines
- `(trainer-tabs)/forms.tsx` (estendido) — terceira aba "Presenciais" com badge, FilterChips, SectionList drafts pinned + sessões, FAB

### Documentação
- `docs/specs/avaliacoes-presenciais/03-milestone-3-mobile-capture.md` (spec, criada antes do M3)
- `docs/specs/avaliacoes-presenciais/PROMPT-MILESTONE-3.md` (prompt do M3)
- `docs/specs/avaliacoes-presenciais/MILESTONE-3-STATUS.md` (este arquivo)

**Total: ~5400 linhas de código novo, ~140 linhas modificadas (extensão dos placeholders M1 + integração em forms.tsx).**

## Decisões de produto e técnicas

### 1. Multi-draft simultâneo via `Record<sessionId, draft>`
Modelado como mapa em vez de single-active porque o trainer real atende vários alunos no mesmo turno e alterna entre eles. Custos: estado um pouco maior. Benefício: zero perda de captura mid-flow ao trocar de aluno.

GC automático no mount do app: drafts com `last_synced_at` (ou `last_touched_at` se nunca sincronizado) > 7 dias são purgados silenciosamente. `__DEV__` log quando GC roda. `draft_schema_version: 1` por draft + `version: 1` no persist middleware permitem migration por linha futura.

### 2. Crash recovery via lista pinned (em vez de popup)
Em vez de `Alert.alert` ao reabrir o app, drafts em progresso aparecem na seção "Em andamento" da aba Presenciais, com badge na tab e ordenação por `last_touched_at`. Visualmente óbvio sem ser intrusivo. Suporta múltiplos drafts naturalmente (decisão #1).

### 3. AnatomyDiagram unificado com toggle frente/costas
1 diagrama, 9 markers (chest, abdomen, thigh, triceps, subscapular, suprailiac, midaxillary, biceps, calf), `highlight_site` prop destaca o ativo. SVG inline ~3KB de payload (arquivo TS é 6KB, acima do gate literal de 5KB; relaxado para "bundle final < 5KB" porque o source carrega imports/JSX/types além do payload SVG real). Decisão validada com usuário.

### 4. ProtocolWizard fullscreen com sub-progress
J&P 7 dobras = 7 sites distintos = sub-jornada própria. Renderiza fullscreen (fora do MeasurementWizard chrome) com sub-progress dots, anatomy highlight por site, navegação interna ChevronLeft / ChevronRight. Mantém ritmo "uma coisa por vez" do resto do flow.

### 5. Sex/age via measurements especiais (zero-migration)
Em vez de adicionar coluna em `students` ou `assessment_sessions`, sex/age são capturados no `CreateSessionModal` step 3 e persistidos como measurements com `metric_key='subject_sex'` (`value_text`) e `metric_key='subject_age_years'` (`value_numeric`). `readSubjectContext()` lê na hora do finalize. `value_unit: null` em age (com `unit_label: 'years'` no `raw_input`) evita poluir o enum `MeasurementUnit`. Refinamento futuro pode introduzir `subject_context` JSONB nativo se isso virar padrão de mais features.

Validação: idade entre 5 e 120 anos. Sexo M/F obrigatórios para confirmar criação.

### 6. Sync tracking via `raw_input._synced` (client-side)
A RPC `save_assessment_measurements` faz INSERT puro (não UPSERT). Para evitar duplicação a cada sync, cada measurement carrega um marker `_synced: boolean` em `raw_input` (JSONB). `syncBatch` filtra `_synced !== true`, envia, marca synced. Helper `stripSyncFlag` remove a marca antes de mandar pra RPC. Hidratação inicial marca measurements vindas do server como `_synced=true`. **Sem migration**.

### 7. Hidratação inicial só para sessões ativas
`[sessionId].tsx` só cria draft local quando `status` é `scheduled` ou `in_progress`. Sessões `completed`/`cancelled` são read-only — abrir o card concluído não popula a seção "Em andamento". Defesa retroativa: se um draft inconsistente já existir para uma sessão completed (legacy ou race), `removeDraft` é chamado.

### 8. Toast em vez de `Alert.alert`
Zero `Alert.alert` no M3. Erros surfacem via `react-native-toast-message` (já no projeto). Mensagens curtas, contextuais: `Verifique os valores: <field>`, `Faltam <N> medições obrigatórias`, `Sem conexão para sincronizar`, `Esta avaliação não existe mais — rascunho descartado`.

### 9. Botões com ≥44×44 hit area efetiva
`hitSlop` adicionado em 7 botões pequenos do M3 (chevrons back, close X, MultiAttempt "Limpar", ProtocolWizard back/reset). Padding visual mantido pequeno; hit area atinge guideline Apple HIG mínimo via `hitSlop`.

### 10. Mapeamento P&W → enum `BodyFatCategory` (do M2)
Decisão herdada do M2 STATUS: P&W lista 6 bandas (Excellent / Good / Above Average / Average / Below Average / Poor); enum tem 6 entradas (`essential` / `athletic` / `fitness` / `average` / `above_average` / `obese`). Consolidação: `Below Average` (P&W) absorvida em `fitness` para preservar interpretação clínica linear (essential → atlético → bom → média → acima da média → obeso). M3 só consome esse mapeamento via `evaluateComputed` + result screen — sem mudanças.

### 11. Closure stale + `getState()` direto
Onde callbacks executam imediatamente após dispatches do Zustand (e o React ainda não re-renderizou), uso `useAssessmentDraftStore.getState().drafts[sessionId]` para ler o snapshot fresh. Pattern aplicado em `[testId].tsx::goToNextOrBack` e `[sessionId].tsx::onFinalize`.

### 12. Computed tests não geram measurement
Tests `type='computed'` (BMI, RCQ) não exigem captura própria — são derivados de outros tests. `completedTestIds` os marca como done quando `isComputedReady()` retorna true (todos os `inputs` têm measurement). Wizard `[testId].tsx` mostra ComputedDisplay com `evaluateComputed()` em modo read-only.

### 13. Engine M2 sempre roda computed metrics no finalize
`buildComputedMetricsFromSchema` varre o schema e calcula todo `computed` test pronto, **incondicionalmente**. Engine de body composition (Petroski/J&P) só entra adicionalmente quando há `protocol` test + sex/age. Antes desse fix, finalize sem protocol enviava `metrics={}` e o resultado ficava vazio.

## Bugs encontrados e resolvidos durante development

| # | Cenário | Causa raiz | Fix |
|---|---|---|---|
| 1 | Range warning não disparava | `MeasurementWizard.canAdvance` hardcoded `false`; commit só via `onSubmitEditing` que decimal-pad iOS não tem | State `pending` no wizard wrapper, `canAdvance` derivado, range modal disparado pelo footer "Próximo" |
| 2 | Botão "Próximo" disabled sem feedback | Mesmo do #1 | Próximo habilita assim que `pending` válido; range warning aparece como modal one-tap |
| 3 | Decimal-pad não aceita vírgula | `parseDecimal` já aceitava ',' → '.', mas trainer não viu hint | Hint default explícito por unit (`Em metros — ex: 1,78 ou 1.78`) |
| 4 | ComputedDisplay 0.00 com 189m | Cálculo cru bypassing engine M2 (`height_m > 3` guard) | `evaluateComputed` usa engine, captura `FormulaInputError`, mostra mensagem UX |
| 5 | Computed não marcam done no checklist | `completedTestIds` só rastreava measurements (não há measurement de computed) | Adiciona IDs de computed prontos via `isComputedReady()` |
| 6 | Resultado vazio após finalize | Finalize só rodava engine quando havia protocol; sem protocol, `metrics={}` | `buildComputedMetricsFromSchema` chama BMI/RCQ incondicionalmente |
| 7 | Banner "Sincronizando..." infinito | Closure stale em `goToNextOrBack` (`is_dirty=false` da render anterior) → `syncBatch` nunca chamava → `is_dirty` ficava true para sempre | `getState()` direto no callback + `_synced` marker em cada row para evitar duplicação no INSERT |
| 8 | Valores não visíveis no checklist | Faltava prop | `value_summary` em `TestChecklistItem` + helper `summarizeTest` por tipo (numeric, bilateral E/D, multi attempt selected, computed, protocol Σ) |
| 9 | Draft órfão re-criado em sessões completed | Hidratação inicial criava draft para qualquer status | Guard `if (isReadOnly) { removeDraft; setActive(null); return; }` no useEffect de hidratação |
| Bug bonus | Orphan draft sem auto-recovery | RPC error "Session not found" não tratado | `useAssessmentSession` detecta marker, chama `removeDraft`, expõe `orphaned: boolean`. Telas reagem com toast + `router.replace('/(trainer-tabs)/forms')` |
| 12 | RPC `finalize_assessment_session` chamado em duplicata → erro "Session already completed" mascarava o sucesso | Sem in-flight guard; React StrictMode/double-tap reentrava no callback | Defesa em profundidade: (a) `finalizingRef` síncrono em `useAssessmentSessionLifecycle`, (b) catch idempotente do erro `'already completed'` (trata como sucesso, faz `removeDraft`), (c) caller distingue `null` benigno (`!result && !finalizeError`) de `null` erro |
| 13 | Tela read-only de sessão completed mostrava "0 de 0 testes obrigatórios" + empty state | Schema/measurements lidos só do draft local, que foi `removeDraft`-ado no finalize | `[sessionId].tsx` agora deriva `schema` e `measurementsForView` do `session.detail` quando `isReadOnlyView` (status terminal). Checklist read-only mostra valores remotos via `summarizeTest` |
| 14 | Engine M2 não calculava `body_fat_percent` em protocolo Petroski (resultado só BMI/RCQ no banco) | Gate falhava porque template usava `metric_key='weight_kg'`/`'height_m'` (não `'weight'`/`'height'`) e/ou template não tinha `protocol` test wrapper | Helpers `pickWeightKg`/`pickHeightM` aceitam ambas variações; `extractSkinfoldsForEngine` mapeia `skinfold_<site>` → `<site>` (nome canônico); `detectProtocol(schema, ms, sex)` faz lookup explícito no schema com fallback de inferência via `PROTOCOLS` registry quando schema não declara `protocol` test |
| 15 | Tap back na tela de resultado voltava para o checklist (2 taps para sair) | `router.back()` empilha rotas | `router.replace('/(trainer-tabs)/forms')` direto |
| 16 | Back da tela de resultado caía na aba Respostas (default) | Sem hint de qual tab abrir | Query param `tab=assessments` em `router.replace` + leitor de `useLocalSearchParams` em `forms.tsx` que sincroniza `setActiveTab` |
| 17 | Sessão recém-finalizada aparecia em "Em andamento" como rascunho | `removeDraft` no finalize OK, mas se algum draft órfão escapasse (race), nada limpava | Defesa reativa em `useAssessmentSessions`: filter síncrono via `terminalIdsKey: string` (primitivo) + cleanup post-fetch via `getState()` dentro do `fetchSessions` |
| 18 | "Maximum update depth exceeded" no `SectionList` de `AssessmentsList` | `sectionsArray = []` literal recriado a cada render → `SectionList` recebia nova ref de `sections` cascateando re-renders | `useMemo([drafts, sessions])` ao redor de `sectionsArray` |
| 18 (regressão) | Mesma cascata após fix de Issue 17 | `useEffect` de cleanup com deps frágeis (`Set` identity nova a cada `useMemo` rerun) + `removeDraft` no effect mutava store mid-render | Removido `useEffect` de cleanup; substituído por purga imperativa **dentro de `fetchSessions`** (fora do render cycle, via `getState()`); `terminalIdsKey: string` como dep primitivo do filter síncrono |

## Limitações conhecidas

1. **Sex/age só editáveis na criação.** Se o trainer errou, precisa cancelar e criar nova sessão. Refinamento futuro: poder editar metadados antes do finalize.
2. **Templates de assessment criados/editados via SQL ou API direta.** UI de builder vem em M4. M3 lista os templates existentes via `useAssessmentTemplates` (filtra `category='assessment'` do RPC `get_trainer_form_templates`).
3. **Comparativo histórico só com sessão anterior do MESMO template.** Quando não há, fallback gracioso "Primeira avaliação". Comparar entre templates diferentes (J&P 7 vs Petroski) fica para refinamento futuro.
4. **`AnatomyDiagram.tsx` source = 6KB** (gate literal era 5KB). Bundle final < 3KB após Metro tree-shake. Decisão de relaxar o gate documentada e validada com usuário (Caminho B).
5. **PDF do laudo é placeholder.** Botão "Compartilhar laudo" mostra toast "PDF disponível em breve". Implementação real em M5.
6. **Wizard deep-link em sessão completed**: rota `/measure/[testId]` para sessão completed renderiza UI sem permitir commit (os `replaceForTest`/`appendMeasurement` no-op quando draft não existe). Edge case fora do flow normal.

## Pré-requisitos para release

- ✅ M2 (engine de fórmulas) já em main
- ✅ Migration 122 aplicada em prod
- ⏳ M4 (web builder) — não-bloqueador, mas trainer só consegue criar templates via API/SQL até M4 chegar
- ⏳ M5 (PDF) — botão "Compartilhar laudo" mostra toast placeholder até M5 entregar

## Pre-existing failing test (não relacionado ao M3)

`lib/prescription/__tests__/set-type-labels.test.ts` — falha desde antes do M1 (`expect 'Drop' to be 'DROP'`). Registrado para limpeza em rodada futura. Não bloqueia release.

## Smoke test scenarios validados

| # | Cenário | Status |
|---|---|---|
| 1 | Happy path — Antropometria mínima (peso/altura/cintura/quadril → IMC + RCQ + classificações) | ✅ Aprovado pelo usuário |
| 2 | Range warning — `189` em campo Estatura (range 1.4-2.2m) → modal "Confirma 189m? Parece muito alto" → cancelar volta ao input | ✅ Aprovado pelo usuário |
| 3 | Orphan recovery — sessão deletada via SQL → reabrir → toast "Esta avaliação não existe mais" + redirect | ✅ Aprovado pelo usuário |
| 4 | Issue 9 — sessão completed não duplica em "Em andamento" ao abrir o card | ✅ Aprovado pelo usuário |
| 5 | Petroski 4 dobras com sex/age (template criado em prod, ID 92791000-7347-48b0-ab98-2b56f2632b3f) — composição corporal completa via engine M2 (`%BG`, `lean_mass_kg`, `fat_mass_kg`, `body_density`, classificação P&W) | ✅ Aprovado pelo usuário |
| 6 | Navegação back da tela de resultado vai direto para `/forms` aba Presenciais (Issues 15+16) | ✅ Aprovado pelo usuário |
| 7 | Sessão recém-finalizada NÃO aparece em "Em andamento" (Issue 17) | ✅ Aprovado pelo usuário |
| 8 | `AssessmentsList` não crasha após esperar alguns segundos (Issue 18 + regressão resolvida) | ✅ Aprovado pelo usuário |

## Próximos milestones

- **M4: web builder + view** (template editing, comparativo avançado, painel estúdio multi-trainer, edição de metadados)
- **M5: PDF generation** (Edge Function + react-pdf, laudo compartilhável)
- **M6: templates de sistema seedados** (Antropometria mínima, J&P 3, J&P 7, Petroski 4, Faulkner 4) + tour onboarding

## Notas de operação

- Engine M2 importada via `@kinevo/shared/lib/assessment-protocols`. Tipos do M1 via `@kinevo/shared/types/assessments`.
- Sync flag `_synced` é puramente cliente — nunca persiste no servidor (stripped antes do RPC payload).
- DEV harness `_dev-assessments.tsx` deletado em B4.2; entry "🔧 DEV" do `more.tsx` removido. `grep -rn "_dev-assessments" mobile/` retorna zero matches.
- Sem mudança em `mobile/app/(trainer-tabs)/_layout.tsx` (tab bar) — badge "Presenciais" é interno ao `forms.tsx`.
- Sem regressão em Respostas/Templates (verificado por inspeção do diff de `forms.tsx`).
