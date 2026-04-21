# Fase 3 — Ajustar com IA (conversa iterativa pós-geração)

**Esta spec é de alto nível.** Ela define intenção, contratos principais e princípios. Quando o time estiver pronto para executar, a Fase 3 vira sua própria spec detalhada (siga o formato das Fases 1 e 2). O objetivo deste arquivo é **não perder a visão de produto** entre fases e já capturar as decisões estruturais.

**Depende de:** Fase 1 e Fase 1.5 em produção e estáveis.

## 1. Objetivo de produto

Depois que a IA gera o programa (ou depois que o treinador começa a editar), o treinador deve poder **pedir ajustes em linguagem natural** sem refazer a anamnese. Exemplos:

- "Adicione um dia de cardio de 20 minutos."
- "Troca supino reto por supino inclinado em todos os treinos."
- "Este treino tá muito longo, corta pra 45 minutos."
- "Aumenta volume de pernas na semana 2."
- "O aluno reportou dor no ombro; substitua exercícios com impacto no ombro."

A IA aplica a mudança **no estado atual do construtor** (não gera do zero) e justifica o que fez.

## 2. Princípios

1. **Diff, não regeneração.** A IA deve produzir uma *patch* (add/remove/update de items e workouts), não um programa inteiro. Isso protege edições manuais do treinador e torna as mudanças reviewáveis.
2. **Transparência.** Toda mudança vem com um *summary humano* ("Troquei supino reto por inclinado em Treino A e Treino B; mantive séries e repetições") e é reversível por um botão "Desfazer" que reverte o patch.
3. **Preview opt-in.** Mudanças grandes (ex: "corta 30% do volume") mostram um preview lado a lado antes de aplicar. Mudanças pequenas (ex: "troca um exercício") aplicam direto com toast + undo.
4. **Contexto compacto.** A IA recebe o *estado atual* do construtor (não a anamnese inteira de novo) — para reduzir custo e latência. Anamnese é só carregada se a instrução menciona algo relevante (ex: "considere a lesão do aluno" → a IA pede contexto).

## 3. Contratos principais

### 3.1 Shape do patch

```ts
export type ProgramPatch = {
  summary: string            // "Troquei supino reto por supino inclinado em Treino A e Treino B"
  reasoning?: string         // mais detalhado, opcional
  operations: PatchOperation[]
}

export type PatchOperation =
  | { type: 'add_workout'; workout: Omit<Workout, 'id'>; after_order_index?: number }
  | { type: 'remove_workout'; workout_id: string }
  | { type: 'rename_workout'; workout_id: string; name: string }
  | { type: 'set_workout_days'; workout_id: string; scheduled_days: number[] }
  | { type: 'add_item'; workout_id: string; item: Omit<WorkoutItem, 'id'>; after_order_index?: number }
  | { type: 'remove_item'; workout_id: string; item_id: string }
  | { type: 'replace_item'; workout_id: string; item_id: string; item: Omit<WorkoutItem, 'id'> }
  | { type: 'update_item_fields'; workout_id: string; item_id: string; fields: Partial<Pick<WorkoutItem, 'sets' | 'reps' | 'rest_seconds' | 'notes'>> }
```

Esse shape cobre as intenções comuns sem ser Turing-completo. Se o LLM precisa de algo fora disso (ex: "reorganizar semana inteira"), quebra em operações primitivas.

### 3.2 Server Action

```ts
export async function proposeProgramPatch(input: {
  studentId: string
  currentProgram: BuilderProgramData       // estado atual do builder
  instruction: string                      // texto do treinador
  generationId?: string                    // se houver, para referência do contexto original
}): Promise<ProgramPatch>
```

- Usa a mesma LLM default da geração, prompt específico de "você é um editor de programas, retorne um patch".
- Salva o patch em uma nova tabela `program_patches` (id, generation_id, trainer_id, instruction, patch_json, applied, created_at) para auditabilidade e undo persistente.

### 3.3 Aplicação do patch no cliente

Função pura `applyPatch(state: BuilderProgramData, patch: ProgramPatch): BuilderProgramData`. Sem side effects, totalmente testável.

Fluxo:
1. Treinador digita instrução.
2. Cliente chama `proposeProgramPatch` → recebe patch.
3. Se `preview_recommended(patch)` (heurística: mais de 3 operations ou muda mais de 50% dos items), mostra preview modal. Senão, aplica direto.
4. Ao aplicar, salva o `Id` do patch e o estado anterior num stack de undo (in-memory).

## 4. UI

Reaproveita o `AiPrescriptionPanel`. Após a geração (`pageState='done'`), o painel se reduz a uma barra compacta no construtor ("Ajustar com IA") e o painel de IA, quando reaberto, mostra uma aba nova: **"Ajustar"**, contendo:

- Campo de texto grande ("Peça um ajuste...") com enter-para-enviar.
- Histórico das últimas N instruções + seus summaries (tipo chat, mas curto).
- Botão "Desfazer última" (quando há stack).

## 5. O que precisa vir antes

- Fase 1 e 1.5 em produção estável por pelo menos 2 semanas com dados de uso (tempo de geração, taxa de retry, satisfação qualitativa).
- Métrica baseline: % dos treinadores que geram e depois editam manualmente, e que tipo de edição. Sem esses dados, podemos desenhar uma UX de "ajustar com IA" que não cobre os ajustes reais.

## 6. Riscos

- **LLM alucina IDs de item/workout.** Mitigação: validação rigorosa em `applyPatch` — se algum ID não existe, rejeita o patch inteiro e pede nova tentativa ao LLM com "ID x não existe, use estes: [...]".
- **Operações conflitantes.** Ex: patch diz "remova item X" mas o treinador já removeu X manualmente. Detectar no apply e tratar (pular operação com warning).
- **Undo parcial.** Se o patch for parcialmente aplicado (ex: 5 de 7 ops ok, 2 falharam), undo precisa reverter só as 5 aplicadas.
- **Custo.** Cada "ajuste com IA" é uma chamada LLM. Se treinador ajusta 5 vezes em um programa, aumenta custo considerável. Considerar limite de requisições por programa ou por dia.

## 7. Critério de pronto para começar a detalhar esta fase

Antes de transformar isto num spec executável, confirmar:

- [ ] Fase 1.5 em prod estável, com dados de uso coletados por 2 semanas.
- [ ] Entrevistas qualitativas com 5 treinadores: "o que você mais ajusta depois que a IA gera?"
- [ ] Decisão se vai ter preview modal ou não para mudanças grandes.
- [ ] Decisão sobre persistência da conversa (salva por programa? session?).
