# Milestone 6 — Status: COMPLETED

> Data: 2026-05-08 — Templates de sistema seedados + onboarding (web + mobile).
> Esta é a última peça da Fase 1 antes do M5 (PDF).

---

## Sumário

M6 entrega 5 templates de avaliação presencial seedados no banco como
"system templates" (`trainer_id IS NULL`) + um tour web auto-disparado na
primeira visita à aba *Avaliações Presenciais* + um card inline no mobile
com a mesma função, persistido em MMKV.

Resolve o atrito identificado em M4: trainer abria a aba e encontrava
estado vazio sem entender que precisava criar template antes de iniciar
sessão. Agora os 5 templates aparecem prontos e o tour explica o fluxo
ponta-a-ponta.

---

## Entregáveis

### B1 — Migration SQL com 5 templates seedados

**Arquivo:** `supabase/migrations/123_assessment_seed_templates.sql`
(aplicado em prod via `apply_migration` MCP).

Cinco INSERTs em `form_templates` com idempotência via
`ON CONFLICT (system_key) DO NOTHING`. Todos com `trainer_id = NULL`,
`category = 'assessment'`, `delivery_mode = 'trainer_in_person'`,
`created_source = 'system'`, `is_active = true`,
`is_default_for_new_students = false`.

| `system_key` | Title | Sections | Tests | Min |
|---|---|---|---|---|
| `assessment_anthropometry_basic` | Antropometria mínima | 3 | 6 | 5 |
| `assessment_jackson_pollock_3` | Composição corporal — Jackson & Pollock 3 dobras | 3 | 4 | 10 |
| `assessment_jackson_pollock_7` | Composição corporal — Jackson & Pollock 7 dobras | 3 | 4 | 15 |
| `assessment_petroski_4` | Composição corporal — Petroski 4 dobras (BR) | 3 | 4 | 10 |
| `assessment_initial_complete` | Avaliação Inicial Presencial | 4 | 7 | 15 |

Validação em prod: `SELECT system_key, jsonb_array_length(schema_json->'sections')
FROM form_templates WHERE trainer_id IS NULL AND category='assessment'`
retornou 5 linhas conformes.

### B2 — Tour onboarding web

**Arquivos alterados:**
- `web/src/components/onboarding/tours/tour-definitions.ts` (+40 linhas)
- `web/src/app/forms/forms-dashboard-client.tsx` (+18 / -1 linha)

Adicionado `TOUR_STEPS.assessments_first_time` com 4 steps. Targets:
1. Tab "Avaliações Presenciais" (welcome)
2. Botão "+ Novo template de avaliação" (templates de sistema)
3. Botão "+ Nova avaliação" (criar sessão)
4. Tab "Avaliações Presenciais" (mobile capture explainer)

Trigger: `<TourRunner tourId="assessments_first_time" autoStart />` montado
**condicional** a `activeTab === 'assessments'`. Não conflita com o tour
`forms` pré-existente (que aponta para targets na aba Respostas).

Persistência: store Zustand já sincroniza `tours_completed[]` ao DB via
`updateOnboardingState` (debounce 800ms). Sem nova action.

### B3 — Card onboarding mobile

**Arquivos:**
- `mobile/stores/assessmentOnboardingStore.ts` (NOVO, 47 linhas)
- `mobile/app/(trainer-tabs)/forms.tsx` (+62 / -7 linhas)

Sem infra de tour no mobile (confirmado por grep). Implementado como
card inline persistente no empty state da aba "Presenciais":

- Aparece quando: `activeTab === "assessments"` E `sectionsArray.length === 0`
  E `tourSeen === false`
- Estilo: card violet (`colors.status.presencialBg` + borda violet 18% alpha),
  ícone Activity, título "Use templates do Kinevo", texto explicativo,
  botão "Entendi"
- "Entendi" → `Haptics.selectionAsync()` + `markTourSeen()` → grava em
  MMKV (`kinevo-assessment-onboarding`, key `kinevo-assessment-tour-seen`)
- Não reaparece em refresh (Zustand persist via createJSONStorage)
- Não aparece quando há sessões na lista (não é mais empty state)

Pattern MMKV alinhado com `assessmentDraftStore.ts` e
`training-room-store.ts` (try/catch para fallback in-memory em Expo Go).

---

## Decisões registradas

### 1. Naming canônico de `metric_key`
Usado `weight_kg`, `height_m`, `waist_cm`, `hip_cm` (alinhado com
`AnthropometricInput` e `CircumferenceInput` em
`shared/lib/assessment-protocols/types.ts`) em vez dos nomes
genéricos `weight`/`height` da spec original. Garante interop com a
engine M2 sem mapeamento adicional.

### 2. Petroski 4 puro
Template `assessment_petroski_4` segue a decisão de M2 (versão pura sem
peso/estatura na seção dobras — peso e altura ficam em `Antropometria`
para BMI, mas não entram na fórmula de densidade). Documentado em
`shared/lib/assessment-protocols/protocols.ts` linha 57.

### 3. Avaliação Inicial sem anamnese textual
A spec original (3.5) pedia uma section "Anamnese rápida" com 3-5
perguntas `single_choice`/`short_text`. **Não implementado**: o schema
`AssessmentTemplateSchema` (em `shared/types/assessments.ts`) só aceita
tipos `numeric_unit`, `bilateral_numeric`, `multi_attempt_numeric`,
`computed`, `protocol`. Anamnese textual não cabe nesse formato sem
estender M1/M2/M3/M4 — fora do escopo de M6.

Solução: o template `assessment_initial_complete` ficou como versão
"completa" presencial (antropo + circ + Petroski 4 + computed). A
description orienta o trainer a usar o template `initial_assessment`
(category `anamnese`, criado em migration 065) para coleta de PAR-Q,
histórico de saúde e objetivos.

### 4. Idempotência via `ON CONFLICT (system_key)`
A coluna `system_key` ganhou UNIQUE em migration 062. Pattern
consagrado em 066 — re-runs da migration 123 são no-op.

### 5. Tour web reutiliza TourRunner existente
Sem nova lib, sem nova action. `TourRunner` já cobre auto-skip mobile
<768px, auto-skip step se target não encontra em 2s, persistência via
Zustand+server. Apenas 1 entrada nova em `TOUR_STEPS` e 3 selectors
`data-onboarding`.

### 6. Tour mobile inline (sem infra de tour)
Decisão por simplicidade: introduzir uma lib de tour no mobile (Joyride,
react-native-walkthrough-tooltip, etc) seria escopo desproporcional ao
ganho. O card inline cobre o caso de uso (educar primeira visita) e o
pattern persistente em MMKV é trivial e consistente com stores
existentes do app.

### 7. Card mobile aparece apenas no empty state
Lógica `sectionsArray.length === 0`. Justificativa: o card é
educativo. Se o trainer já tem sessões, ele já entendeu o fluxo —
mostrar o card seria ruído. Para re-exibir manualmente, basta limpar
MMKV (raramente necessário).

---

## Limitações conhecidas

1. **Sem reset visual de "tour visto"** — para re-disparar o tour web,
   é preciso editar `trainer.onboarding_state.tours_completed` via SQL.
   Para re-disparar o card mobile, limpar MMKV via dev menu ou reset
   completo. Considerado aceitável por ser raramente útil.

2. **Tour web pode "competir" com tour `forms`** se o trainer entrar
   em `/forms` pela primeira vez e clicar diretamente em "Avaliações
   Presenciais" antes do tour `forms` iniciar/completar. O TourRunner
   evita 2 tours simultâneos via `activeTourId !== null` check, então
   um deles vai aguardar — ordem indeterminada mas não há crash.

3. **Card mobile não tem animação de entrada** — exibido estaticamente.
   Pode ser melhorado em iteração futura (Reanimated fade-in) sem
   afetar lógica.

4. **Imagem/screencast de demonstração não anexados** ao status doc
   (validação foi via teste manual local).

---

## Pré-requisitos para release

- [x] Migration 123 aplicada em prod (validada por SELECT)
- [x] Web TypeScript clean nos arquivos alterados
- [x] Mobile TypeScript clean nos arquivos alterados
- [x] Tour web aparece na primeira visita à aba Avaliações Presenciais
- [x] Tour web não reaparece após completar/skipar (validado pelo user)
- [x] Botões Pular/Próximo do tour funcionam (validado pelo user)
- [x] Card mobile aparece em empty state quando `tourSeen=false`
- [x] Card mobile desaparece após "Entendi" e não reaparece em refresh
- [x] Card mobile não aparece quando há sessões na lista

---

## Smoke test scenarios validados

### Web

1. `/forms` → aba Respostas — tour `forms` aparece (comportamento pré-M6).
2. `/forms` → aba Avaliações Presenciais (primeira vez) — tour
   `assessments_first_time` aparece com 4 steps.
3. Skip ou Concluir — `tours_completed` recebe `'assessments_first_time'`.
4. Refresh `/forms?tab=assessments` — tour não reaparece.
5. `/forms/templates` — 5 templates de sistema visíveis a qualquer
   trainer.
6. `+ Nova avaliação` → escolher template "Antropometria mínima" + aluno
   + sex M + age 30 → Criar — sessão aparece em "Em andamento".

### Mobile

1. Aba Forms → "Presenciais" sem sessões — card violet aparece com
   título, texto e botão "Entendi".
2. "Entendi" → Haptics + card desaparece.
3. Reload do app → card não reaparece.
4. Criar sessão (FAB) → empty state desaparece — card também já
   estava off (lista não vazia).

### End-to-end (Petroski 4 sistema)

5. Web cria sessão usando template `assessment_petroski_4` → aluno
   abre app mobile → captura peso/altura/dobras → finalize →
   `computed_metrics` retorna `body_fat_percent`, `body_density`,
   `fat_mass_kg`, `lean_mass_kg`, `bmi` corretamente (engine M2).
6. Web vê resultado em `/students/[id]/avaliacoes/[sessionId]/result`.

---

## Reflexões estratégicas para Fase 2

Durante o smoke test do M6, o user identificou dois eixos que requerem
trabalho substancial e ficam endereçados na Fase 2 (não bloqueiam fechamento
da Fase 1).

### Paridade web/mobile

Estado atual: web é o "centro de comando" (builder, view, gerenciamento),
mobile é o "campo" (captura). Decisão deliberada de M3/M4 baseada em
ergonomia. Mas trainer 100% mobile fica trancado em algumas tarefas.

Gaps identificados:
- Builder de template assessment NÃO existe no mobile (drag-drop é UX
  inferior em tela pequena, mas ter NADA é pior)
- "Criar com IA" só web (feature avançada — possivelmente OK assim)
- "Modo preencher agora" só mobile (web seria útil para estúdios com
  tablet/desktop fixo)

Direções para Fase 2:
- Builder mobile simplificado (versão list-based em vez de drag-drop;
  reusa estrutura do FormBuilderModal estendido)
- Web: opção de modo de captura para estúdios com tablet
- "Criar com IA" mobile (low-priority, depende de demanda)

### Integração da aba Formulários

Estado atual: Respostas (anamnese/checkin/survey) e Avaliações Presenciais
são silos visuais e funcionais, mesmo coexistindo na mesma rota /forms.

Desconexões:
1. Visual desigual: Respostas tem seções ricas ("Aguardando Feedback",
   "Enviados pendentes"), Presenciais só filter chips + lista
2. Sem timeline cronológica unificada por aluno (anamnese + checkin +
   avaliação aparecem em lugares diferentes)
3. Flow "primeira sessão completa" é manual: enviar Anamnese + criar
   Avaliação Presencial em duas ações separadas

Direções para Fase 2:
- Padronizar visual entre tabs com mesmo nível de hierarquia (seções
  "Aguardando Feedback" também em Presenciais quando aplicável)
- Timeline de aluno em /students/[id]/timeline mostrando todas as
  interações cronologicamente
- Flow "Onboarding completo" guiado: anamnese → primeira avaliação
  presencial → primeira prescrição (3 cliques contextualmente)

### Recomendação imediata

Fase 1 fecha com M5 (PDF). Após M5, antes de iniciar Fase 2, fazer
uma sessão estratégica para:
- Priorizar entre os 6 itens acima (paridade + integração)
- Definir 2-3 que entram na Fase 2
- Outros viram backlog/refinamento contínuo

---

## Próximos milestones

**M5 (PDF) — único restante da Fase 1.** Geração de laudo em PDF a
partir do `computed_metrics + measurements + template_snapshot` via
Edge Function. Tracking em
`docs/specs/avaliacoes-presenciais/04-milestone-5-pdf-laudo.md`
(quando criado).

Após M5, Fase 1 do módulo de Avaliações Presenciais fica completa.
