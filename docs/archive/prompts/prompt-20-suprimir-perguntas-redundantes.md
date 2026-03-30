# Prompt 20 — Suprimir perguntas redundantes quando questionário foi respondido

## Problema
Quando o aluno respondeu o Questionário de Prescrição, a tela de "Refinar" ainda mostra perguntas que o questionário já cobriu (ex: preferências de exercícios, ênfase muscular, cardio). Isso faz a IA parecer burra — o treinador pensa "eu acabei de ver o questionário respondido e a IA me pergunta a mesma coisa?".

## Causa raiz
No modo Builder-First (ativo), as perguntas vêm do `question-engine.ts` (server-side). Algumas condições NÃO verificam se o questionário já cobriu o tópico:
- `first_program` (P5): **Nenhum check de questionário** — sempre pergunta se não tem programa anterior
- `muscle_emphasis` (P7): Verifica `emphasized_groups.length > 0`, mas se o aluno marcou "equilibrado" (sem ênfase), `emphasized_groups` fica vazio e a pergunta aparece mesmo assim
- `cardio_inclusion` (P6): **Nenhum check de questionário** — o questionário tem campo `cardio_preference` mas é ignorado

## Arquivo: `web/src/lib/prescription/question-engine.ts`

### Alteração 1 — P5: `first_program` (linhas 187-204)

Adicionar parâmetro `questionnaire` na condition e verificar se o questionário foi respondido:

**ANTES:**
```typescript
{
    id: 'first_program',
    priority: 5,
    condition: (_profile, context) => {
        return (
            !context.previous_programs ||
            context.previous_programs.length === 0
        )
    },
```

**DEPOIS:**
```typescript
{
    id: 'first_program',
    priority: 5,
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

### Alteração 2 — P7: `muscle_emphasis` (linhas 228-235)

Mudar a verificação: se o questionário FOI respondido (independentemente de ter ênfase ou não), o aluno já fez essa escolha.

**ANTES:**
```typescript
condition: (_profile, _context, _tradeoff, questionnaire) => {
    if (questionnaire && questionnaire.emphasized_groups.length > 0) {
        return false // Questionnaire already provided emphasis
    }
    return true // Always eligible otherwise, but only appears if slot available
},
```

**DEPOIS:**
```typescript
condition: (_profile, _context, _tradeoff, questionnaire) => {
    // If questionnaire was answered, the student already responded about muscle emphasis
    // (even if they chose "equilibrado" / no emphasis — that IS the answer)
    if (questionnaire) {
        return false
    }
    return true // Always eligible otherwise, but only appears if slot available
},
```

### Alteração 3 — P6: `cardio_inclusion` (linhas 206-224)

Adicionar check: se o questionário tem resposta de preferência de cardio, não perguntar de novo.

**ANTES:**
```typescript
{
    id: 'cardio_inclusion',
    priority: 6,
    condition: (profile) => {
        return profile.goal === 'weight_loss'
    },
```

**DEPOIS:**
```typescript
{
    id: 'cardio_inclusion',
    priority: 6,
    condition: (profile, _context, _tradeoff, questionnaire) => {
        // If questionnaire was answered, it already includes cardio preference
        if (questionnaire && questionnaire.training_style_preferences.length > 0) {
            return false
        }
        return profile.goal === 'weight_loss'
    },
```

**Nota:** O campo `training_style_preferences` captura as respostas da pergunta de estilo de treino que inclui opções como "Com bastante cardio junto" e "Só musculação, sem cardio". Além disso, o questionário tem a pergunta `cardio_preference` (yes_continuous, yes_hiit, yes_both, no) — se quiser ser mais preciso, podemos verificar diretamente esse campo.

Para verificar o campo `cardio_preference` diretamente, será preciso expor esse valor em `QuestionnaireData`. Como alternativa simples que já funciona, a condição acima usa `training_style_preferences` que já está disponível.

---

## Resumo

| Pergunta | Antes | Depois |
|----------|-------|--------|
| `first_program` (P5) | Sempre aparece se não tem programa | Suprimida se questionário tem preferências/aversões/experiência |
| `muscle_emphasis` (P7) | Só suprime se `emphasized_groups > 0` | Suprimida se questionário foi respondido (qualquer resposta) |
| `cardio_inclusion` (P6) | Sempre aparece se goal = weight_loss | Suprimida se questionário tem preferências de treino |

## Comportamento esperado

1. **Aluno respondeu questionário**: Perguntas P5, P6 e P7 ficam suprimidas. Apenas perguntas sobre divergências (se houver) ou situações estruturais (trade-off de volume, duração desalinhada, aderência crítica) são exibidas.
2. **Aluno NÃO respondeu questionário**: Comportamento atual mantido — perguntas aparecem normalmente.
3. **Caso ideal (questionário respondido + perfil completo + sem divergências)**: Pode não ter NENHUMA pergunta → fluxo vai direto para geração! Isso é o cenário mais inteligente possível.
