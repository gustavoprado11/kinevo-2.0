# Preferências de prescrição — Limitações conhecidas v1

Documento que acompanha [`PRD_preferencias_prescricao.md`](./PRD_preferencias_prescricao.md). Lista as decisões em que a entrega v1 divergiu da spec original e o motivo.

Última atualização: 2026-05-05.

---

## 1. Quick fields dinâmicos não implementados

**Spec:** `set_defaults.visible_fields`, `set_defaults.load_method` e `set_defaults.tempo` controlam quais campos aparecem ao adicionar exercício (Carga em kg ou %1RM, RIR, RPE, Cadência) e qual método de carga é o padrão.

**v1:** [`web/src/components/programs/workout-card/ExerciseQuickFields.tsx`](../../web/src/components/programs/workout-card/ExerciseQuickFields.tsx) é grid fixo de 3 colunas (Séries / Reps / Descanso). As prefs continuam persistindo no DB e são editáveis pelo drawer, mas **não têm efeito visual** ao adicionar exercício.

**Motivo:** reescrever o quick-fields para colunas dinâmicas (com slots condicionais para load/load-type/tempo/RIR/RPE) foi avaliado fora do escopo desta entrega. O escopo seria considerável: novo sistema de colunas + ajuste do `WorkoutItem` (que hoje só tem `sets`/`reps`/`rest_seconds`) + UI compacta vs full mode.

**Sugestão v2:** sistema de colunas dinâmicas em `ExerciseQuickFields` que lê de `visible_fields`. Quando `'load'` está visível, o `load_method` define se o input é kg, %1RM, RIR ou RPE.

---

## 2. `aerobic_template` popula `item_config.notes`

**Spec (seção 6.2.4):** ao clicar "Aeróbio" no builder, o template configurado pré-preenche o card.

**v1:** o template entra em `item.item_config.notes` — campo bindado ao componente `<TechnicalNote>` ("Adicionar nota técnica...") do `CardioItemCard`. `CardioConfig` não tem um campo `description` dedicado (diferente do `WarmupConfig.description`).

**Motivo:** adicionar `description` ao `CardioConfig` exigiria mudar tipos compartilhados em [`shared/types/workout-items.ts`](../../shared/types/workout-items.ts) — o que afeta também o app mobile e o pipeline de prescrição. Decisão Q2 = opção (b): usar o slot natural existente (`item_config.notes`) em vez de criar campo novo.

**Sugestão v2:** adicionar `description?: string` ao `CardioConfig` em `@kinevo/shared/types/workout-items` e renderizar como campo dedicado no `CardioItemCard`, separando "descrição do bloco" (template) de "nota técnica" (observação ad-hoc).

---

## 3. AI `focus` / `variation` sem consumo

**Spec (seção 7):** `ai.focus` e `ai.variation` pré-selecionam parâmetros do prompt no `ai-prescribe-panel.tsx`.

**v1:** o drawer persiste `ai.focus` e `ai.variation` no DB, mas **nenhum painel de IA do builder consome esses valores**:
- [`ai-prescribe-panel.tsx`](../../web/src/components/programs/ai-prescribe-panel.tsx) só faz parse de texto livre via `/api/prescription/parse-text` — não tem prompt parametrizável por foco/variação.
- [`ai-prescription-panel.tsx`](../../web/src/components/programs/ai-prescription-panel.tsx) é o agente de prescrição que consome anamnese — também não expõe slots para esses parâmetros.

**Motivo:** aplicar `focus`/`variation` exigiria mudança do prompt server-side e do contrato do endpoint, fora do escopo dessa entrega.

**Sugestão v2:** integrar com `lib/prescription/prompt-builder*` e adicionar slots no `ai-prescription-panel.tsx` para repassar `focus`/`variation` ao agente quando o backend for parametrizável.

---

## 4. `rest_isolation_seconds` não aplicado no client

**Spec (seção 6.2.2):** descanso diferenciado para exercícios isolados vs compostos.

**v1:** o modelo `WorkoutItem` no client tem um único campo `rest_seconds`. Tanto `addExerciseFromLibrary` quanto `addExerciseToWorkout` usam apenas `set_defaults.rest_compound_seconds`. `rest_isolation_seconds` continua sendo persistido no DB para coerência da spec, mas não é consumido em nenhum lugar do builder.

**Motivo:** distinguir composto/isolado exigiria classificação por exercício (campo novo no `Exercise` ou heurística por grupo muscular) + ramificação de defaults nas funções de adição. Avaliado fora do escopo.

**Sugestão v2:** classificar exercícios como composto/isolado (via tag explícita ou inferência por grupo muscular) e selecionar o rest default apropriado em `addExerciseFromLibrary` / `addExerciseToWorkout`.

---

## Resumo

| # | Pref | Persistido? | Consumido? | Notas |
|---|---|---|---|---|
| 1 | `set_defaults.visible_fields` / `load_method` / `tempo` | ✅ | ❌ | Quick fields fixos |
| 2 | `quick_blocks.aerobic_template` | ✅ | ✅ | Em `item_config.notes` (slot existente, não dedicado) |
| 3 | `ai.focus` / `ai.variation` | ✅ | ❌ | Sem slot client-side |
| 4 | `set_defaults.rest_isolation_seconds` | ✅ | ❌ | Modelo client tem rest único |

Todas as outras prefs da spec (visualização, sets/reps/rest_compound, open_mode, auto_warmup, warmup_template, note_template, default_weeks, default_workout_count, naming_convention) **estão consumidas** na v1.
