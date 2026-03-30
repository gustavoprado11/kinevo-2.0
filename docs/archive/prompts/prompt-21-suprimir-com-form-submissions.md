# Prompt 21 — Suprimir perguntas redundantes quando formulários avulsos estão selecionados

## Problema
O Prompt 20 suprime perguntas quando o **Questionário de Prescrição** (system_key `prescription_questionnaire`) foi respondido. Mas na prática, o treinador usa formulários avulsos como "Avaliação Inicial" que cobrem os mesmos tópicos. Esses formulários são selecionados na tela de prescrição (selectedFormIds), mas o `analyzeStudentContext` não sabe que eles existem — então as perguntas redundantes continuam aparecendo.

## Solução
Passar `selectedFormIds` do client para `analyzeStudentContext`, e usar a presença de formulários selecionados como sinal adicional para suprimir perguntas que já estão cobertas pelo contexto dos formulários.

---

## Alterações

### Arquivo 1: `web/src/app/students/[id]/prescribe/prescribe-client.tsx`

**Passo 1** — Passar `selectedFormIds` para `analyzeStudentContext`.

Na linha 130 onde `analyzeStudentContext` é chamado:

**ANTES:**
```tsx
const analysisResult = await analyzeStudentContext(student.id)
```

**DEPOIS:**
```tsx
const analysisResult = await analyzeStudentContext(student.id, selectedFormIds)
```

Também adicionar `selectedFormIds` nas dependências do `handleGenerate` useCallback (linha 155):

**ANTES:**
```tsx
}, [student.id, executeGeneration])
```

**DEPOIS:**
```tsx
}, [student.id, selectedFormIds, executeGeneration])
```

---

### Arquivo 2: `web/src/actions/prescription/analyze-context.ts`

**Passo 2** — Aceitar `selectedFormIds` como parâmetro.

Alterar a assinatura da função `analyzeStudentContext` (linha 38-39):

**ANTES:**
```typescript
export async function analyzeStudentContext(
    studentId: string,
): Promise<AnalyzeContextResult> {
```

**DEPOIS:**
```typescript
export async function analyzeStudentContext(
    studentId: string,
    selectedFormIds: string[] = [],
): Promise<AnalyzeContextResult> {
```

**Passo 3** — Calcular `hasFormContext` e passá-lo para `selectConditionalQuestions`.

Após a linha 136 (depois do bloco de `detectVolumeTradeoff`), adicionar:

```typescript
// ── 5.7. Check if form submissions provide context ──
const hasFormContext = selectedFormIds.length > 0
if (hasFormContext) {
    console.log(`[analyzeStudentContext] ${selectedFormIds.length} form submissions selected — will suppress redundant questions`)
}
```

**Passo 4** — Passar `hasFormContext` para `selectConditionalQuestions`.

Na linha 138 onde `selectConditionalQuestions` é chamado:

**ANTES:**
```typescript
const serverQuestions = selectConditionalQuestions(typedProfile, enrichedContext, tradeoff, questionnaireData)
```

**DEPOIS:**
```typescript
const serverQuestions = selectConditionalQuestions(typedProfile, enrichedContext, tradeoff, questionnaireData, hasFormContext)
```

---

### Arquivo 3: `web/src/lib/prescription/question-engine.ts`

**Passo 5** — Aceitar `hasFormContext` na interface `ConditionalQuestion`.

Alterar a interface `ConditionalQuestion` (linhas 21-40):

**ANTES:**
```typescript
interface ConditionalQuestion {
    id: string
    priority: number
    condition: (
        profile: StudentPrescriptionProfile,
        context: EnrichedStudentContext,
        tradeoff?: VolumeTradeoffInfo,
        questionnaire?: QuestionnaireData | null,
    ) => boolean
    build: (
        profile: StudentPrescriptionProfile,
        context: EnrichedStudentContext,
        tradeoff?: VolumeTradeoffInfo,
        questionnaire?: QuestionnaireData | null,
    ) => PrescriptionAgentQuestion
}
```

**DEPOIS:**
```typescript
interface ConditionalQuestion {
    id: string
    priority: number
    condition: (
        profile: StudentPrescriptionProfile,
        context: EnrichedStudentContext,
        tradeoff?: VolumeTradeoffInfo,
        questionnaire?: QuestionnaireData | null,
        hasFormContext?: boolean,
    ) => boolean
    build: (
        profile: StudentPrescriptionProfile,
        context: EnrichedStudentContext,
        tradeoff?: VolumeTradeoffInfo,
        questionnaire?: QuestionnaireData | null,
    ) => PrescriptionAgentQuestion
}
```

Nota: só `condition` precisa do `hasFormContext`, o `build` não precisa.

**Passo 6** — Atualizar `selectConditionalQuestions` para aceitar e passar `hasFormContext`.

**ANTES:**
```typescript
export function selectConditionalQuestions(
    profile: StudentPrescriptionProfile,
    context: EnrichedStudentContext,
    tradeoff?: VolumeTradeoffInfo,
    questionnaire?: QuestionnaireData | null,
): PrescriptionAgentQuestion[] {
```

**DEPOIS:**
```typescript
export function selectConditionalQuestions(
    profile: StudentPrescriptionProfile,
    context: EnrichedStudentContext,
    tradeoff?: VolumeTradeoffInfo,
    questionnaire?: QuestionnaireData | null,
    hasFormContext?: boolean,
): PrescriptionAgentQuestion[] {
```

Na linha que filtra as questões:

**ANTES:**
```typescript
const triggered = pool
    .filter((q) => q.condition(profile, context, tradeoff, questionnaire))
    .sort((a, b) => a.priority - b.priority)
```

**DEPOIS:**
```typescript
const triggered = pool
    .filter((q) => q.condition(profile, context, tradeoff, questionnaire, hasFormContext))
    .sort((a, b) => a.priority - b.priority)
```

**Passo 7** — Atualizar as conditions de P5, P6 e P7 para também verificar `hasFormContext`.

**P5 — `first_program` (linhas 191-205):**

**ANTES:**
```typescript
condition: (_profile, context, _tradeoff, questionnaire) => {
    // If questionnaire was answered, it already covers exercise preferences,
    // disliked exercises, training style, and previous experience
    if (questionnaire && (
        questionnaire.favorite_exercises_text ||
        questionnaire.disliked_exercises_text ||
        questionnaire.previous_experience ||
        questionnaire.training_style_preferences.length > 0
    )) {
        return false
    }
    return (
        !context.previous_programs ||
        context.previous_programs.length === 0
    )
},
```

**DEPOIS:**
```typescript
condition: (_profile, context, _tradeoff, questionnaire, hasFormContext) => {
    // If questionnaire was answered, it already covers exercise preferences
    if (questionnaire && (
        questionnaire.favorite_exercises_text ||
        questionnaire.disliked_exercises_text ||
        questionnaire.previous_experience ||
        questionnaire.training_style_preferences.length > 0
    )) {
        return false
    }
    // If form submissions are selected, they provide context about the student
    if (hasFormContext) {
        return false
    }
    return (
        !context.previous_programs ||
        context.previous_programs.length === 0
    )
},
```

**P6 — `cardio_inclusion` (linhas 210-215):**

**ANTES:**
```typescript
condition: (profile, _context, _tradeoff, questionnaire) => {
    if (questionnaire && questionnaire.training_style_preferences.length > 0) {
        return false
    }
    return profile.goal === 'weight_loss'
},
```

**DEPOIS:**
```typescript
condition: (profile, _context, _tradeoff, questionnaire, hasFormContext) => {
    if (questionnaire && questionnaire.training_style_preferences.length > 0) {
        return false
    }
    // Form submissions likely cover training preferences including cardio
    if (hasFormContext) {
        return false
    }
    return profile.goal === 'weight_loss'
},
```

**P7 — `muscle_emphasis` (linhas 231-237):**

**ANTES:**
```typescript
condition: (_profile, _context, _tradeoff, questionnaire) => {
    if (questionnaire) {
        return false
    }
    return true
},
```

**DEPOIS:**
```typescript
condition: (_profile, _context, _tradeoff, questionnaire, hasFormContext) => {
    if (questionnaire) {
        return false
    }
    // Form submissions provide student context — don't ask redundant questions
    if (hasFormContext) {
        return false
    }
    return true
},
```

---

## Resumo

| Arquivo | Alteração |
|---------|-----------|
| `prescribe-client.tsx` | Passa `selectedFormIds` para `analyzeStudentContext` |
| `analyze-context.ts` | Recebe `selectedFormIds`, calcula `hasFormContext`, passa para `selectConditionalQuestions` |
| `question-engine.ts` | Aceita `hasFormContext` na interface e na função, P5/P6/P7 verificam flag |

## Comportamento esperado

1. **Formulários selecionados (ex: "Avaliação Inicial")**: Perguntas P5 (preferências), P6 (cardio), P7 (ênfase) são suprimidas. Apenas perguntas estruturais (volume trade-off, duração, aderência) aparecem se aplicáveis.
2. **Nenhum formulário selecionado + sem questionário**: Comportamento atual mantido.
3. **Cenário ideal (formulário respondido + perfil completo)**: Pode não ter perguntas → vai direto para geração.

## Lógica

A premissa é simples: se o treinador selecionou formulários para usar como contexto da prescrição, esses formulários já contêm informações sobre o aluno (preferências, restrições, etc.). A IA vai receber essas informações na fase de geração. Perguntar ao treinador coisas que o formulário já respondeu é redundante e faz a IA parecer desatenta.
