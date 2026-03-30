# Prompts 12 a 18 — Otimização da Prescrição com IA

---

## PROMPT 12 — Narrativa do aluno alimenta o builder heurístico

O builder heurístico (`program-builder.ts`) gera ~80% dos programas mas **nunca recebe** os dados dos formulários do aluno. A `studentNarrative` só chega no optimizer e no agent. Se o aluno disse "não posso fazer mesa flexora", o builder inclui mesa flexora mesmo assim.

### Mudanças necessárias:

**1. `web/src/lib/prescription/program-builder.ts`**

a) Adicionar parâmetro `studentNarrative?: string | null` às funções `buildSlotBasedProgram` e `buildWithSlots`:

```typescript
// buildSlotBasedProgram (~linha 98): adicionar parâmetro
export async function buildSlotBasedProgram(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
    constraints: PrescriptionConstraints,
    enrichedContext: EnrichedStudentContext,
    programIndex: number = 0,
    studentNarrative?: string | null,  // NOVO
): Promise<PrescriptionOutputSnapshot> {
    // ...passar para buildWithSlots:
    const result = await buildWithSlots(profile, exercises, constraints, enrichedContext, studentNarrative)
```

```typescript
// buildWithSlots (~linha 374): adicionar parâmetro
async function buildWithSlots(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
    constraints: PrescriptionConstraints,
    enrichedContext: EnrichedStudentContext,
    studentNarrative?: string | null,  // NOVO
): Promise<PrescriptionOutputSnapshot> {
```

b) Criar função `parseNarrativeRestrictions` que extrai exercícios restritos da narrativa:

```typescript
// Adicionar ANTES de filterExercises (~linha 175)

/**
 * Parses the student narrative for exercise restrictions.
 * Looks for patterns like "não pode fazer X", "dor em X", "desconforto em X"
 * Returns a Set of exercise names (lowercase) that should be excluded.
 */
function parseNarrativeRestrictions(narrative: string | null | undefined): Set<string> {
    if (!narrative) return new Set()
    const restrictions = new Set<string>()
    const lower = narrative.toLowerCase()

    // Patterns that indicate restriction
    const patterns = [
        /não\s+(?:pode|consigo|consegue)\s+fazer\s+([^,.;\n]+)/gi,
        /(?:dor|desconforto|incômodo|lesão)\s+(?:no|na|em|ao fazer|durante)\s+([^,.;\n]+)/gi,
        /(?:evitar|evite|proibido|contraindicado)\s+([^,.;\n]+)/gi,
        /não\s+(?:faço|faz|fazer)\s+([^,.;\n]+)/gi,
        /(?:médico|fisio|ortopedista)\s+(?:proibiu|restringiu|pediu para não fazer)\s+([^,.;\n]+)/gi,
    ]

    for (const pattern of patterns) {
        let match
        while ((match = pattern.exec(lower)) !== null) {
            const term = match[1].trim()
            if (term.length > 2 && term.length < 60) {
                restrictions.add(term)
            }
        }
    }

    return restrictions
}

/**
 * Checks if an exercise name fuzzy-matches any restriction from the narrative.
 * Uses substring matching to handle variations like "mesa flexora" matching "mesa flex".
 */
function isNarrativeRestricted(exerciseName: string, restrictions: Set<string>): boolean {
    if (restrictions.size === 0) return false
    const lower = exerciseName.toLowerCase()
    for (const restriction of restrictions) {
        // Check if restriction is a substring of exercise name or vice versa
        if (lower.includes(restriction) || restriction.includes(lower)) return true
        // Check word overlap (at least 2 words matching)
        const restrictionWords = restriction.split(/\s+/)
        const nameWords = lower.split(/\s+/)
        const overlap = restrictionWords.filter(w => nameWords.some(n => n.includes(w) || w.includes(n)))
        if (overlap.length >= 2) return true
    }
    return false
}
```

c) Modificar `filterExercises` para aceitar e usar as restrições da narrativa:

```typescript
function filterExercises(
    exercises: PrescriptionExerciseRef[],
    profile: StudentPrescriptionProfile,
    narrativeRestrictions?: Set<string>,  // NOVO
): PrescriptionExerciseRef[] {
    const restrictedIds = new Set(
        profile.medical_restrictions.flatMap(r => r.restricted_exercise_ids),
    )
    const dislikedIds = new Set(profile.disliked_exercise_ids)

    return exercises.filter(e => {
        if (restrictedIds.has(e.id)) return false
        if (dislikedIds.has(e.id)) return false
        // NOVO: check narrative restrictions
        if (narrativeRestrictions && isNarrativeRestricted(e.name, narrativeRestrictions)) {
            console.log(`[SlotBuilder] Excluded by narrative: "${e.name}"`)
            return false
        }
        return true
    })
}
```

d) No início de `buildWithSlots`, parsear a narrativa e passar para filterExercises:

```typescript
// Dentro de buildWithSlots, logo antes da linha "const available = filterExercises(exercises, profile)"
const narrativeRestrictions = parseNarrativeRestrictions(studentNarrative)
if (narrativeRestrictions.size > 0) {
    console.log(`[SlotBuilder] Narrative restrictions found: ${[...narrativeRestrictions].join(', ')}`)
}
const available = filterExercises(exercises, profile, narrativeRestrictions)
```

**2. `web/src/actions/prescription/generate-program.ts`**

Passar `combinedNarrative` para `buildSlotBasedProgram` em TODAS as chamadas (são 3):

```typescript
// Linha ~372:
outputSnapshot = await buildSlotBasedProgram(typedProfile, agentExercises, constraints, enrichedContext, 0, combinedNarrative)

// Linha ~408:
outputSnapshot = await buildSlotBasedProgram(typedProfile, agentExercises, constraints, enrichedContext, 0, combinedNarrative)

// Linha ~518 (se existir):
outputSnapshot = await buildSlotBasedProgram(typedProfile, agentExercises, constraints, enrichedContext, 0, combinedNarrative)
```

### Verificação:
- `npx tsc --noEmit` deve passar sem erros
- Buscar por `buildSlotBasedProgram(` para confirmar que TODAS as chamadas passam a narrativa

---

## PROMPT 13 — Optimizer habilitado para TODOS os alunos

O optimizer (GPT-4.1-mini) é pulado para iniciantes, alunos com <8 sessões, e aderência <60%. Isso significa que os alunos que MAIS precisam de personalização recebem 100% heurística.

### Mudanças necessárias:

**Arquivo: `web/src/lib/prescription/ai-optimizer.ts`**

a) Substituir a função `shouldOptimize` (~linha 97-121) por uma versão que SEMPRE permite quando há narrativa ou observação do treinador:

```typescript
export function shouldOptimize(
    profile: StudentPrescriptionProfile,
    enrichedContext: EnrichedStudentContext,
    studentNarrative?: string | null,
): boolean {
    // SEMPRE otimizar se há contexto do aluno (formulário respondido)
    if (studentNarrative && studentNarrative.trim().length > 0) {
        console.log('[Optimizer] Running: student narrative present')
        return true
    }

    // SEMPRE otimizar se há observação do treinador
    if (profile.cycle_observation && profile.cycle_observation.trim().length > 0) {
        console.log('[Optimizer] Running: trainer observation present')
        return true
    }

    // Para alunos sem contexto extra: manter critérios de história mínima
    // (mas relaxar — reduzir de 8 para 4 sessões)
    const completedSessions = enrichedContext.session_patterns.completed_sessions_4w ?? 0
    const totalFromPrograms = enrichedContext.previous_programs.reduce(
        (sum, p) => sum + (p.workouts?.length ?? 0), 0,
    )
    if (completedSessions + totalFromPrograms < 4) return false

    return true
}
```

b) Atualizar a chamada de `shouldOptimize` dentro de `optimizeWithAI` (~linha 475):

```typescript
// Mudar de:
if (!shouldOptimize(profile, enrichedContext)) {
// Para:
if (!shouldOptimize(profile, enrichedContext, studentNarrative)) {
```

c) Aumentar o budget de trocas (~linha 90-91):

```typescript
const MAX_SWAPS = 8           // era 4
const MAX_SET_ADJUSTMENTS = 5  // era 3
```

### Verificação:
- `npx tsc --noEmit` deve passar sem erros
- Verificar que `shouldOptimize` agora aceita 3 parâmetros

---

## PROMPT 14 — Ênfase propaga para seleção de exercícios

Quando o treinador pede ênfase em Glúteos, o sistema só aumenta o volume mínimo. A seleção de exercícios não muda. Precisamos que a ênfase influencie QUAIS exercícios são escolhidos.

### Mudanças necessárias:

**Arquivo: `web/src/lib/prescription/program-builder.ts`**

a) Na função `computeSlotScore` (~linha 783-839), aumentar o bônus de ênfase de +10 para +20 e adicionar bônus extra para exercícios que têm o grupo enfatizado como grupo PRIMÁRIO:

```typescript
// Substituir o bloco de emphasis (~linha 812-813):
// DE:
// Emphasis bonus (+10 if group is emphasized by trainer)
if (ctx.emphasizedGroups.has(slot.target_group)) score += 10

// PARA:
// Emphasis bonus — stronger when group is emphasized
if (ctx.emphasizedGroups.has(slot.target_group)) {
    score += 20  // era +10
    // Extra bonus if exercise's PRIMARY group matches emphasis
    if (exercise.muscle_group_names[0] === slot.target_group) {
        score += 10  // total +30 para exercícios primários do grupo enfatizado
    }
}
```

**Arquivo: `web/src/lib/prescription/ai-optimizer.ts`**

b) No prompt do optimizer (`buildOptimizerSystemPrompt` ou `buildOptimizerUserPrompt`), adicionar instrução de ênfase. Localizar onde os emphasized_groups são mencionados no context_summary e adicionar ao prompt do sistema:

Encontrar a seção de RULES no prompt do sistema e adicionar:

```
- EMPHASIS: If emphasized_groups is provided, PRIORITIZE swapping generic exercises for ones that specifically target the emphasized group. For example: if "Glúteos" is emphasized, prefer hip thrust, glute bridge, bulgarian split squat over generic squats.
```

c) No `buildContextSummary`, garantir que `emphasized_groups` está presente no ContextSummary. Se não estiver, adicionar:

```typescript
// No ContextSummary type, verificar se emphasized_groups existe.
// Se não existir, adicionar ao type e ao buildContextSummary:
emphasized_groups: constraints.emphasized_groups || [],
```

### Verificação:
- `npx tsc --noEmit` deve passar sem erros
- Verificar que `computeSlotScore` agora dá +20/+30 para ênfase (não +10)

---

## PROMPT 15 — Resolver 5 camadas de variedade

O programa gerado é sempre muito similar ao anterior. 5 camadas de determinismo se acumulam.

### Mudanças necessárias:

**1. programIndex usa contagem real de programas anteriores**

Arquivo: `web/src/actions/prescription/generate-program.ts`

Em TODAS as chamadas a `buildSlotBasedProgram`, substituir `0` por `enrichedContext.previous_programs.length`:

```typescript
// Exemplo (~linha 372):
const programIndex = enrichedContext.previous_programs.length
outputSnapshot = await buildSlotBasedProgram(typedProfile, agentExercises, constraints, enrichedContext, programIndex, combinedNarrative)
```

**2. Slot templates com variações**

Arquivo: `web/src/lib/prescription/slot-templates.ts`

Para cada tipo de treino (PUSH, PULL, LEGS, UPPER, LOWER), criar uma variação alternativa que inverte a ordem de prioridade ou troca o padrão de movimento principal:

```typescript
// Exemplo para PUSH — adicionar PUSH_SLOTS_ALT:
const PUSH_SLOTS_ALT: WorkoutSlot[] = [
    { movement_pattern: 'push_vertical', target_group: 'Ombros', function: 'main', min_sets: 3, max_sets: 4, priority: 1, optional: false, prefer_compound: true },  // Era push_h primeiro
    { movement_pattern: 'push_horizontal', target_group: 'Peito', function: 'main', min_sets: 3, max_sets: 4, priority: 2, optional: false, prefer_compound: true },
    { movement_pattern: 'isolation', target_group: 'Tríceps', function: 'accessory', min_sets: 2, max_sets: 3, priority: 3, optional: false, prefer_compound: false },  // Tríceps antes de acessório peito
    { movement_pattern: ['push_horizontal', 'isolation'], target_group: 'Peito', function: 'accessory', min_sets: 2, max_sets: 3, priority: 4, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Ombros', function: 'accessory', min_sets: 2, max_sets: 3, priority: 5, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Tríceps', function: 'accessory', min_sets: 2, max_sets: 3, priority: 6, optional: true, prefer_compound: false },
]
```

Fazer o mesmo para PULL_SLOTS_ALT (pull_horizontal primeiro), LEGS_SLOTS_ALT (hinge primeiro ao invés de squat), UPPER_SLOTS_ALT, LOWER_SLOTS_ALT.

No `SLOT_TEMPLATES`, duplicar cada entrada com a variação:

```typescript
export const SLOT_TEMPLATES: Record<string, Record<string, WorkoutSlot[]>> = {
    upper_lower: {
        upper_a: UPPER_SLOTS,
        lower_a: LOWER_SLOTS,
        upper_b: UPPER_SLOTS_ALT,   // Variação na segunda instância
        lower_b: LOWER_SLOTS_ALT,   // Variação na segunda instância
    },
    // Aplicar mesma lógica para ppl, ppl_plus, etc.
}
```

**3. Banda de seleção mais larga**

Arquivo: `web/src/lib/prescription/program-builder.ts`

Na função `fillSlot` (~linha 617):

```typescript
// DE:
const topCandidates = scored.filter(s => s.score >= bestScore - 12)
// PARA:
const topCandidates = scored.filter(s => s.score >= bestScore - 20)
```

**4. Penalidade de repetição mais forte**

No `computeSlotScore` (~linhas 796-797):

```typescript
// DE:
if (ctx.previousIds.has(exercise.id)) score -= 15
// PARA:
if (ctx.previousIds.has(exercise.id)) score -= 35
```

### Verificação:
- `npx tsc --noEmit` deve passar sem erros
- Verificar que slot templates ALT existem para todos os tipos de treino
- Verificar que a banda de seleção é 20 e a penalidade é -35

---

## PROMPT 16 — Padrões do treinador alimentam o builder

O sistema já aprende preferências do treinador (trainer-patterns.ts), mas esses padrões só vão para o optimizer. O builder heurístico ignora.

### Mudanças necessárias:

**1. `web/src/lib/prescription/program-builder.ts`**

a) Adicionar parâmetro `trainerPatterns` a `buildSlotBasedProgram` e `buildWithSlots`:

```typescript
export async function buildSlotBasedProgram(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
    constraints: PrescriptionConstraints,
    enrichedContext: EnrichedStudentContext,
    programIndex: number = 0,
    studentNarrative?: string | null,
    trainerPatterns?: TrainerPatterns | null,  // NOVO
): Promise<PrescriptionOutputSnapshot> {
```

b) Criar função que converte padrões em ajustes de score:

```typescript
interface TrainerScoreAdjustments {
    /** exercise IDs the trainer always removes → exclude entirely */
    excludedIds: Set<string>
    /** exercise IDs the trainer prefers (substitutes TO) → +20 score */
    preferredIds: Set<string>
    /** exercise IDs the trainer always replaces (substitutes FROM) → -20 score */
    deprioritizedIds: Set<string>
}

function buildTrainerAdjustments(patterns: TrainerPatterns | null | undefined): TrainerScoreAdjustments {
    const result: TrainerScoreAdjustments = {
        excludedIds: new Set(),
        preferredIds: new Set(),
        deprioritizedIds: new Set(),
    }
    if (!patterns) return result

    // Exercise removals with high frequency → exclude
    if (patterns.exercise_removals) {
        for (const removal of patterns.exercise_removals) {
            if (removal.frequency >= 0.6) {
                result.excludedIds.add(removal.exercise_id)
            }
        }
    }

    // Exercise substitutions → prefer target, deprioritize source
    if (patterns.exercise_substitutions) {
        for (const sub of patterns.exercise_substitutions) {
            if (sub.frequency >= 0.5) {
                result.preferredIds.add(sub.to_exercise_id)
                result.deprioritizedIds.add(sub.from_exercise_id)
            }
        }
    }

    return result
}
```

c) Integrar no `filterExercises` (exclusões) e no `computeSlotScore` (preferências):

No filterExercises, adicionar:
```typescript
if (trainerAdjustments?.excludedIds.has(e.id)) {
    console.log(`[SlotBuilder] Excluded by trainer pattern: "${e.name}"`)
    return false
}
```

No computeSlotScore, adicionar ao SlotScoringContext e usar:
```typescript
// Trainer preference bonus
if (ctx.trainerPreferredIds?.has(exercise.id)) score += 20
if (ctx.trainerDeprioritizedIds?.has(exercise.id)) score -= 20
```

**2. `web/src/actions/prescription/generate-program.ts`**

Passar `trainerPatterns` para `buildSlotBasedProgram` em todas as chamadas:

```typescript
outputSnapshot = await buildSlotBasedProgram(typedProfile, agentExercises, constraints, enrichedContext, programIndex, combinedNarrative, trainerPatterns)
```

### Verificação:
- `npx tsc --noEmit` deve passar sem erros
- Verificar importação de `TrainerPatterns` no program-builder.ts
- Verificar que `buildSlotBasedProgram` aceita 8 parâmetros

---

## PROMPT 17 — Dados de performance como contexto para IA

O sistema coleta RPE, taxa de conclusão, dropout por treino, e load progression. Quase nada disso é usado na geração.

### Mudanças necessárias:

**Arquivo: `web/src/lib/prescription/ai-optimizer.ts`**

a) Expandir o `ContextSummary` type para incluir performance data:

```typescript
// Adicionar ao ContextSummary interface:
performance_insights?: {
    avg_rpe_last_4w: number | null
    adherence_percentage: number
    dropout_workouts: string[]  // nomes dos treinos com dropout > 40%
    stalled_count: number
    regressing_count: number
}
```

b) No `buildContextSummary`, popular os insights de performance:

```typescript
// Dentro de buildContextSummary, ANTES do return:

const avgRpe = enrichedContext.session_patterns.avg_session_duration_minutes
    ? null  // TODO: usar RPE real quando disponível via query
    : null

const dropoutWorkouts: string[] = []
if (enrichedContext.session_patterns.dropout_rate_by_workout) {
    for (const [name, rate] of Object.entries(enrichedContext.session_patterns.dropout_rate_by_workout)) {
        if (rate > 0.4) dropoutWorkouts.push(name)
    }
}

const stalledCount = enrichedContext.load_progression.filter(lp => lp.trend === 'stalled').length
const regressingCount = enrichedContext.load_progression.filter(lp => lp.trend === 'regressing').length

// Adicionar ao objeto retornado:
performance_insights: {
    avg_rpe_last_4w: avgRpe,
    adherence_percentage: constraints.adherence_percentage,
    dropout_workouts: dropoutWorkouts,
    stalled_count: stalledCount,
    regressing_count: regressingCount,
},
```

c) No prompt do sistema do optimizer, adicionar regras de performance:

Adicionar à seção de RULES no `buildOptimizerSystemPrompt`:

```
- PERFORMANCE CONTEXT: If performance_insights is present:
  * If stalled_count > 3: prioritize swapping stalled exercises for variations
  * If dropout_workouts has entries: those workouts need simplification (fewer exercises, shorter)
  * If adherence_percentage < 70: prefer simpler exercises and shorter sessions
  * If regressing_count > 0: flag regression exercises in attention_flags
```

**Arquivo: `web/src/lib/prescription/prompt-builder.ts`**

d) No `buildAgentContextMessage` e `buildUserPrompt`, adicionar seção de performance quando disponível:

Dentro do payload (onde já existem `aluno`, `historico`, etc.), adicionar:

```typescript
if (enrichedContext.load_progression.length > 0) {
    payload.performance = {
        exercicios_estagnados: enrichedContext.load_progression
            .filter(l => l.trend === 'stalled')
            .map(l => ({ nome: l.exercise_name, semanas_estagnado: l.weeks_at_current })),
        exercicios_regredindo: enrichedContext.load_progression
            .filter(l => l.trend === 'regressing')
            .map(l => l.exercise_name),
        instrucao: 'Exercícios estagnados devem ser substituídos por variações. Exercícios em regressão precisam de atenção — reduzir carga ou trocar.',
    }
}
```

### Verificação:
- `npx tsc --noEmit` deve passar sem erros
- Verificar que ContextSummary agora tem performance_insights

---

## PROMPT 18 — Reasoning transparente para o treinador

O programa gerado tem um campo "reasoning" com justificativa geral, mas não explica decisões específicas.

### Mudanças necessárias:

**Arquivo: `web/src/lib/prescription/prompt-builder.ts`**

a) Na seção de formato de saída (`buildSection4_OutputFormat`, ~linha 266), melhorar a especificação do reasoning:

Encontrar a definição do campo `reasoning` no JSON schema e substituir por:

```
"reasoning": {
    "overview": "string — resumo geral da estratégia do programa (2-3 frases)",
    "exercise_choices": "string — justificativa das escolhas de exercícios principais. Mencione: por que cada composto foi escolhido, como as restrições do aluno influenciaram, quais exercícios foram evitados e por quê",
    "form_data_used": "string — quais informações dos formulários do aluno foram consideradas e como influenciaram o programa. Se nenhum formulário, escreva 'Sem formulários respondidos'",
    "adaptations": "string — ajustes feitos baseado em performance passada, aderência, ou observações do treinador. Se nenhum, escreva 'Primeiro programa — sem dados de performance'",
    "evidence_references": ["string — referências científicas opcionais"]
}
```

b) No prompt do sistema (buildSection1_Role ou onde define o papel da IA), adicionar instrução sobre reasoning:

```
O campo "reasoning" é FUNDAMENTAL. O treinador lê esse campo para decidir se confia no programa.
Seja específico: nomeie exercícios, cite dados dos formulários, mencione restrições que respeitou.
NUNCA use frases genéricas como "programa baseado no perfil do aluno". Diga EXATAMENTE o que considerou.
```

**Arquivo: `web/src/lib/prescription/ai-optimizer.ts`**

c) Após o optimizer aplicar as mudanças, enriquecer o reasoning do output com as justificativas do optimizer:

Encontrar onde `optimizerResult.output.reasoning` é definido e adicionar:

```typescript
// Após aplicar swaps, enriquecer reasoning
if (optimizerResponse.swaps.length > 0 || optimizerResponse.set_adjustments.length > 0) {
    const optimizerNotes = [
        ...optimizerResponse.swaps.map(s => s.reason),
        ...optimizerResponse.set_adjustments.map(s => s.reason),
        ...optimizerResponse.attention_flags,
    ].filter(Boolean)

    if (optimizerNotes.length > 0) {
        result.reasoning.adaptations = (result.reasoning.adaptations || '') +
            '\n\nAjustes do optimizer: ' + optimizerNotes.join('. ')
    }
}
```

### Verificação:
- `npx tsc --noEmit` deve passar sem erros
- Verificar que o schema de reasoning agora tem 4 campos (overview, exercise_choices, form_data_used, adaptations)
