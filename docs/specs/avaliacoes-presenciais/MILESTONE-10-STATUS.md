# Milestone 10 — Cross-platform Parity — STATUS

**Data:** 2026-05-09
**Branch:** `m10-parity` (PR pendente para `main`)
**Spec:** [`10-milestone-10-parity.md`](./10-milestone-10-parity.md)

**Status:** ✅ COMPLETO — último milestone da Fase 2 do módulo de Avaliações Presenciais.

---

## Sumário

Fechamos os 2 maiores gaps de paridade web↔mobile identificados no audit:

- **M10A — Builder mobile**: trainer 100% mobile cria/edita templates de avaliação no app, com UX list-based simplificada.
- **M10B — "Preencher agora" web**: estúdios com tablet/desktop fixo capturam medições direto no navegador.

Entregue em 5 sub-blocos commitados isoladamente em `m10-parity`:

| Sub-bloco | Commit | Escopo |
|---|---|---|
| B1 | `c515055` | Mobile builder shell + sections + auto-save MMKV |
| B2 | `3ba6828` | Mobile testes + library + properties (gorhom bottom sheets) |
| B3 | `75f613e` | Web MeasurementWizardWeb + 6 inputs + AnatomyDiagram (SVG nativo) |
| B4 | `dc3090b` | Web /capture route + finalize integration |
| B5 | (este commit) | Status doc + PR |

Sem mudança de schema DB. Sem novas Edge Functions. Sem novas server actions. Reusa engine M2 (`shared/lib/assessment-protocols`), `saveAssessmentMeasurements` (M3), `finalizeAssessmentSession` (M4), e o action de PDF (M5).

---

## M10A — Builder mobile (B1 + B2)

### Componentes criados

Em `mobile/components/trainer/assessments/builder/`:

- **`AssessmentBuilderScreen.tsx`** — tela principal (header back/title/Save + body com title input/description/sections/FAB+).
  - Hydrate prioriza MMKV draft; fallback pro fetch via Supabase RLS quando edit mode.
  - Auto-save em MMKV em cada mutation.
  - Save direto via Supabase (RLS): `INSERT` em criação, `UPDATE` em edição.
  - Bloqueia edit de templates non-assessment (defesa em profundidade contra deep-link errado).
- **`SectionCard.tsx`** — card de seção com título inline editável + lista TestRow + CTA "Adicionar teste".
- **`TestRow.tsx`** — row dentro do SectionCard. Subtitle formatada por tipo (`Numérico · kg · obrigatório`, `Bilateral D/E · kg`, `3 tentativas · cm · melhor (maior)`, etc).
- **`TestLibrarySheet.tsx`** — `BottomSheet` (gorhom) com tabs por grupo. 24 entries em 6 grupos (Antropometria/Pregas/Força/Condicionamento/Mobilidade/Computados).
- **`TestPropertiesSheet.tsx`** — `BottomSheet` para editar props específicas por tipo:
  - `numeric_unit`: metric_key + unit (chips) + min/max + required toggle
  - `bilateral_numeric`: metric_key + unit + required
  - `multi_attempt_numeric`: metric_key + unit + attempts + selection_strategy
  - `computed`/`protocol`: read-only nota (shape gerado pelo catalog factory; só label editável)
  - Aviso vermelho quando `duplicateKey=true`
- **`test-catalog.ts`** — duplicação consciente do web (header MIRROR explícito). Único delta vs web: imports de `lucide-react-native`.

### Store novo

`mobile/stores/assessmentTemplateDraftStore.ts` — Zustand + MMKV namespace `kinevo-assessment-template-draft`. Pattern espelha `assessmentDraftStore.ts`. Chaves: `templateId` ou `__new__` para criação. GC após 14 dias.

### Rota Expo Router

`mobile/app/assessments/templates/new.tsx` — aceita `?id=<uuid>` (edit) ou nenhum param (criação). Edit deep-link via URL share do web aponta pra essa mesma rota.

### Trigger

`mobile/app/(trainer-tabs)/forms.tsx` — link "Novo template de avaliação →" inline na tab "Presenciais", abaixo dos filter chips. Não toca no FAB existente. Trigger discreto, não intrusivo.

### Validation client-side

Replicada do web canvas (sem zod — projeto não usa):
- Title obrigatório
- ≥1 seção
- ≥1 teste
- Sem duplicate `metric_keys`

### Out of scope (registrado follow-up)

- Listing dedicado de templates de avaliação no mobile — backlog. Edit hoje funciona via deep-link.
- Drag-drop de testes/seções — list-based simplificado é decisão final.
- "Criar com IA" pra assessment templates — backlog.

---

## M10B — Preencher agora web (B3 + B4)

### Componentes criados (web)

Em `web/src/components/assessments/capture/`:

- **`MeasurementWizardWeb.tsx`** — chrome com header (título + subtitle + step counter + progress bar violet) + body scrollable + footer Próximo/Concluir + range warning modal. Centered card max-w-2xl (decisão 4.4: otimizado pra desktop/tablet).
- **`NumericUnitInputWeb.tsx`** — single numeric input. Big-display (44px), `inputmode=decimal`, border violet/amber por estado.
- **`BilateralNumericInputWeb.tsx`** — 2 SidePads D/E. Auto-commit on `onValidChange` quando ambos preenchidos. Commit gera 2 MeasurementInput rows (mesma metric_key, side='left'/'right').
- **`MultiAttemptInputWeb.tsx`** — N slots numerados, aplica `selection_strategy` (best_max/best_min/median/mean), valor final em card violet, commit gera N rows com `is_selected=true` no escolhido.
- **`ComputedDisplayWeb.tsx`** — read-only card violet com label, valor 4xl + unit, classification badge.
- **`ProtocolWizardWeb.tsx`** — sub-wizard pra protocolos de skinfold (J&P 7, Petroski 4, etc). Uma site por página com `<AnatomyDiagramWeb>` highlight + input mm. Sub-progress dots. Commit gera N rows `metric_key=skinfold_<site>`.
- **`AnatomyDiagramWeb.tsx`** — port do mobile via SVG nativo do DOM. Path data + marker positions copiados literalmente. Toggle Frente/Costas quando sem highlight.
- **`capture-draft.ts`** — helpers `loadCaptureDraft` / `saveCaptureDraft` / `clearCaptureDraft` em localStorage. Key `capture-draft:{sessionId}`. Schema versionado (v1).

### Hooks e libs

- **`web/src/hooks/use-assessment-measurement-form.ts`** — port literal de `mobile/hooks/useAssessmentMeasurementForm.ts` (header MIRROR explícito).
- **`web/src/lib/assessment-computed.ts`** — port literal de `mobile/lib/assessmentComputed.ts`. Wraps engine M2 sem deps de UI.

### Rota e integration

- **`web/src/app/students/[id]/avaliacoes/[sessionId]/capture/page.tsx`** — server component. Edge cases server-side:
  - sessão `completed` → redirect pra `/result`
  - sessão `cancelled` → redirect pra detalhe
  - sem schema (template stale) → redirect pra detalhe
  - sessão não-encontrada → redirect pra detalhe
- **`capture-client.tsx`** — orquestrador:
  - Hydrate: localStorage draft prioritário; fallback `initialMeasurements` do server.
  - Auto-save em cada mutation.
  - State machine sequencial pelos `flatTests` do schema. Per-step rendering por tipo.
  - `commitMeasurements` faz last-write-wins por `raw_input.test_id` (re-medições substituem rows antigas).
  - Voltar: step 0 → detalhe; senão decrementa.
  - Finalize replica fielmente o flow do `mobile/app/assessments/[sessionId].tsx`:
    1. `saveAssessmentMeasurements`
    2. `buildComputedMetricsFromSchema` → BMI/RCQ
    3. `detectProtocol` + `calculateBodyComposition` → body fat / lean / fat mass quando sex+age+weight+height+protocol presentes
    4. `FormulaInputError` capturado: toast warning, finalize continua com BMI/RCQ
    5. `finalizeAssessmentSession`
    6. `clearCaptureDraft` + toast + `router.replace(/result)`

### Trigger

`session-detail-client.tsx` — botão violet **"Preencher agora"** primário, full-width, visível apenas em `status='scheduled' || 'in_progress'`. Hint secundário "Ou capture pelo app Kinevo…" em texto pequeno num card neutro. Mantém o app mobile como caminho válido.

### Out of scope (registrado follow-up)

- Captura simultânea (mais de 1 trainer no mesmo aluno) — backlog.
- Reabrir sessão completed — backlog.
- Modo câmera (foto de progresso) — backlog.
- Mobile-responsive polishing — best-effort (decisão 4.4 da spec).
- Range warning modal handler — infra preparada (`rangePrompt` prop), mas não acionado por nenhum input atualmente. Espelha mobile (que também não usa o modal além do componente). Pode ser ativado em iteração futura.

---

## Acceptance criteria — checklist final

### M10A
- ✅ Trainer no app mobile abre `/assessments/templates/new` (rota Expo Router)
- ✅ Adiciona seções e testes via UI list-based + bottom sheets
- ✅ Edita título de seção inline
- ✅ Salva template → aparece em `/avaliacoes/templates` no web (badge violet)
- ✅ Edita template existente via deep-link `?id=<uuid>`
- ✅ Drafts persistidos em MMKV (não perde se app fechar)

### M10B
- ✅ Trainer no web abre detalhe de sessão scheduled/in_progress → vê botão "Preencher agora"
- ✅ Clica → entra no MeasurementWizardWeb
- ✅ Preenche medições → engine M2 calcula em real-time (ComputedDisplayWeb mostra IMC/RCQ live)
- ✅ Finaliza → redireciona pra `/result` + PDF disponível
- ✅ Edge cases server-side: completed/cancelled/sem-schema todos redirecionam corretamente
- ✅ Drafts em localStorage preservam medidas parciais entre F5

### Geral
- ✅ TypeScript zero novos erros (web + mobile)
- ✅ Sem regressão em flows existentes (mobile capture nativa, web detail/result)
- ✅ Sem mudança de schema DB
- ✅ Sem novas Edge Functions ou server actions

---

## Cenários de validação (seção 8 da spec)

### Mobile builder (M10A)

| # | Cenário | Estado |
|---|---|---|
| 1 | Trainer cria template "Avaliação Petroski" com 3 seções (Antropometria/Pregas/Calculados) | ✅ B1+B2 |
| 2 | Adiciona testes em cada seção via TestLibrarySheet (tabs por grupo) | ✅ B2 |
| 3 | Edita propriedades de um teste via TestPropertiesSheet | ✅ B2 |
| 4 | Salva → web `/avaliacoes/templates` mostra com badge violet | ✅ B1 |
| 5 | Edita do mobile via deep-link → mudanças persistem no web | ✅ B1 |
| 6 | Duplicate metric_key → save bloqueado com toast | ✅ B2 |
| 7 | Drafts persistem em MMKV após fechar/reabrir app | ✅ B1 |

### Web preencher agora (M10B)

| # | Cenário | Estado |
|---|---|---|
| 1 | Web cria sessão Petroski 4 pra Marina (status scheduled) | (pré-M10) |
| 2 | Detalhe da sessão → botão "Preencher agora" violet visível | ✅ B4 |
| 3 | Clica → MeasurementWizardWeb abre com primeiro step do schema | ✅ B4 |
| 4 | Preenche peso/altura → ComputedDisplayWeb mostra IMC live (engine M2 client-side) | ✅ B3+B4 |
| 5 | ProtocolWizardWeb com AnatomyDiagramWeb destaca site corrente | ✅ B3 |
| 6 | F5 mid-capture → draft localStorage rehidrata medidas | ✅ B4 |
| 7 | Concluir → finalize → redirect pra `/result` → PDF disponível | ✅ B4 |
| 8 | Sessão `completed` em URL `/capture` → 307 redirect pra `/result` | ✅ B4 |
| 9 | Sessão `cancelled` em URL `/capture` → 307 redirect pro detalhe | ✅ B4 |

### Não-regressão

| # | Cenário | Estado |
|---|---|---|
| 1 | App mobile continua capturando sessões nativamente (não tocamos no flow nativo) | ✅ |
| 2 | Web detalhe da sessão completed/cancelled funciona como antes | ✅ |
| 3 | M5 PDF generation funciona pra sessões finalizadas via web (mesmo path do mobile) | ✅ |
| 4 | M7 QW2 (preset student) — `/students/[id]` → `+` AVALIAÇÃO → criação preserva flow | ✅ |
| 5 | M9 NewStudentWizard funciona idem (criação aluno → wizard → avaliação) | ✅ |
| 6 | Mobile pode editar template criado via mobile builder | ✅ M10A |
| 7 | Web pode editar template criado via mobile builder | ✅ M10A |

---

## Decisões registradas

- **Sem novas Edge Functions** — M10 reusa actions existentes. PDF (M5) já funciona pós-finalize.
- **Sem mudança de schema DB** — templates seguem `form_templates`, sessions `assessment_sessions`, measurements `assessment_measurements`.
- **test-catalog duplicado conscientemente** — header explícito "MIRROR OF web/.../test-catalog.ts — keep in sync". Único delta vs web: imports de `lucide-react-native` em vez de `lucide-react`.
- **MeasurementWizardWeb otimizado pra desktop/tablet** — mobile responsive é "best effort" (decisão 4.4).
- **`AnatomyDiagramWeb` via SVG nativo** — path data e marker positions portados literalmente. Bundle adicionado: zero dep nova.
- **Engine M2 client-side** — `calculateBodyComposition`, `PROTOCOLS`, `bmi`, `waistHipRatio` importados direto de `@kinevo/shared/lib/assessment-protocols`. Live preview no ComputedDisplayWeb sem RPC.
- **localStorage drafts isolados do MMKV mobile** — server é fonte da verdade quando há divergência (mesma sessão capturada em 2 devices).
- **Save direto via Supabase no mobile builder** — mobile não chama Next server actions (são web-only). RLS impede edit de templates de outro trainer.
- **Sem zod schema** — não existe no projeto. Validação replicada literalmente do web canvas (title + ≥1 seção + ≥1 teste + sem duplicate keys).
- **Hint mobile preservado** no detalhe da sessão — botão "Preencher agora" é primário, mas app continua sendo opção válida.
- **Last-write-wins por test_id** — re-medir um teste no `/capture` substitui rows antigas via filtro em `commitMeasurements`.

---

## TypeScript

`npx tsc --noEmit` em `web/`: **0 novos erros**. Os 11 pré-existentes em `__tests__` permanecem.
`npx tsc --noEmit` em `mobile/`: **0 novos erros**. ~16 erros pré-existentes herdados (useLiveActivity, useTrainerChat, useWorkoutSession, expo-file-system) — fora do escopo M10.

---

## Bundle size

Não medido formalmente neste milestone (disco apertado bloqueou `next build` local; Vercel preview compilou com sucesso em todos os 4 sub-blocos).

Esperado:
- Web: +30 KB minified (8 arquivos novos em `capture/`, AnatomyDiagram inline SVG ~3 KB).
- Mobile: +25 KB (5 arquivos builder + store + catalog).

Vercel Speed Insights cobrirá organicamente.

---

## Follow-ups (não bloqueiam ship — vão para backlog)

1. **Listing dedicado de assessment templates no mobile** — hoje só edit via deep-link. Listar templates customs do trainer + Kinevo system templates seria a próxima evolução natural.
2. **Captura simultânea** — guardar `current_capturer` no DB com lease curto, evitar 2 trainers gravando ao mesmo tempo.
3. **Reabrir sessão completed** — útil pra correção pós-finalize. Exige decisão sobre "edit history" vs "replace".
4. **"Criar com IA" pra assessment templates** — paralelo do que existe pra forms. Backlog low-priority (assessments têm catálogo curado, AI seria pra estruturar com input LLM).
5. **Modo câmera no capture web** — foto de progresso integrada à captura. Backlog.
6. **Mobile-responsive polish do MeasurementWizardWeb** — desktop/tablet é prioridade; trainer 100% mobile usa app nativo. Polish caso surja demanda.
7. **Indicador visual de origem no PDF** — `created_via='web_capture'` flag na tabela + badge no laudo. Decisão 4.5 da spec, deferida.
8. **Range warning modal** — infra prep (`rangePrompt` prop no MeasurementWizardWeb), inputs numéricos não acionam ainda. Mesmo comportamento do mobile. Ativar quando UX validation indicar valor.
9. **Mover `test-catalog`/`use-assessment-measurement-form`/`assessment-computed` pra `shared/`** — se drift começar a acontecer entre web e mobile.

---

## Próximos passos

**M10 COMPLETO. Fase 2 do módulo de Avaliações Presenciais finalizada.**

| Milestone | Commit em main | Status |
|---|---|---|
| M1 — Data foundation | (pré-Fase 2) | ✅ prod |
| M2 — Formula engine | (pré-Fase 2) | ✅ prod |
| M3 — Mobile capture | (pré-Fase 2) | ✅ prod |
| M4 — Web builder | (pré-Fase 2) | ✅ prod |
| M5 — PDF Edge Function | `847c089` | ✅ prod |
| M6 — Templates seed | `e93a661` | ✅ prod |
| M7 — Polish & Bug Fixes | `013e5aa` | ✅ prod |
| M8 — Reestruturação Avaliações + Formulários | `3d0bd5d` (tag `v0.8.0-m8`) | ✅ prod |
| M9 — Onboarding Flow Guiado | `a5ca6cf` | ✅ prod |
| **M10 — Cross-platform Parity** | (este milestone) | ✅ **prod após merge** |

Próximas frentes (fora do escopo da Fase 2):
- Acompanhar follow-ups acima conforme demanda.
- Tag `v0.10.0-fase2-complete` opcional marcando o fim da Fase 2.
