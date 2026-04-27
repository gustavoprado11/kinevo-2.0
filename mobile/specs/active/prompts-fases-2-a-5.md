# Prompts de execução — Fases 2 a 5

> Prompts curtos pro Claude Code, um por fase. Branches já criadas a partir de `feat/per-set-fase-1-shared`. Quando Fase 1 mergear em main, cada branch faz `git rebase main` antes de começar.
>
> Spec única de referência: `mobile/specs/active/prescricao-per-set-manual.md`.

---

## Fase 2 — Web Builder

```
Você está implementando a Fase 2 de mobile/specs/active/prescricao-per-set-manual.md.
Pré-requisito: Fase 1 mergeada em main (tabelas, method_key, shared types e helpers já existem).
Branch: feat/per-set-fase-2-web (já existe, criada a partir da Fase 1). Faça `git rebase main` antes de começar.

LEIA antes de codar:
- A seção "Fase 2 — Web Builder" em "Estratégia de execução" da spec.
- "Escopo → Incluído → Web — builder manual (Fase 2)" — lista exata de arquivos a editar/criar.
- "Arquivos Afetados → Web — criar" e "Web — editar".
- "Critérios de Aceite → Fase 2".
- "Comportamento Esperado → Fluxo do Usuário" Cenários 1, 2 e 6.
- "Regras especiais" (todas — supersets bloqueados, expand/summarize preserva valores, detecção de preset).
- "Edge Cases" (todos).

USE de @kinevo/shared:
- Tipos: `WorkoutSet`, `SetType`, `MethodKey`, `TrainingMethodPreset` de `@kinevo/shared/types/prescription`.
- Helpers: `summarizeSetScheme`, `expandToSetScheme`, `validateSetScheme`, `applyPreset`, `inferMethodKeyFromScheme` de `@kinevo/shared/lib/prescription/set-scheme`.
- Presets: `SYSTEM_PRESETS` de `@kinevo/shared/lib/prescription/set-scheme-presets`.

NÃO TOQUE:
- `web/src/lib/prescription/` (motor de IA agentivo — explicitamente fora de escopo).
- `mobile/`, `supabase/functions/`, `targets/watch-app/` (fases 3, 4, 5).
- `shared/` (já entregue na Fase 1).

CRITÉRIO DE PARADA: todos os checkboxes da "Fase 2 — Web Builder" em "Critérios de Aceite" verdes,
incluindo `cd web && npx tsc --noEmit && npx vitest run` sem novos erros vs main.

Após terminar, atualizar a seção "Notas de Implementação" da spec com os arquivos tocados e
abrir PR `feat(per-set): Fase 2 — Web Builder` apontando pra spec.
```

---

## Fase 3 — Mobile Builder

```
Você está implementando a Fase 3 de mobile/specs/active/prescricao-per-set-manual.md.
Pré-requisito: Fase 1 mergeada em main. Pode rodar em paralelo com Fases 2 e 4.
Branch: feat/per-set-fase-3-mobile-builder (já existe, criada a partir da Fase 1). Faça `git rebase main` antes de começar.

LEIA antes de codar:
- A seção "Fase 3 — Mobile Builder" em "Estratégia de execução" da spec.
- "Escopo → Incluído → Mobile — builder manual (Fase 3)" — lista exata de arquivos.
- "Arquivos Afetados → Mobile — criar" e "Mobile — editar" (apenas blocos referentes ao builder, NÃO sala de treino — esses são Fase 4).
- "Critérios de Aceite → Fase 3".
- "Comportamento Esperado → Fluxo do Usuário" Cenários 3 e 6.
- "Regras especiais" (todas).
- "Edge Cases" (todos).
- mobile/CLAUDE.md (NativeWind, Lucide, sem emoji, sentence case, pt-BR, Haptics em toques).

USE de @kinevo/shared (mesmos imports da Fase 2).

ATENÇÃO ESPECIAL:
- MMKV migration via callback `merge` do Zustand persist: drafts pré-Fase-3 não têm `set_scheme`/`method_key`.
  Defaultar para `null` no rehydrate. Sem isso, abrir o app com draft antigo crasheia.
- Investigar onde fica o card de exercício no builder mobile hoje (a spec aponta `app/program-builder/index.tsx`
  ou um componente em `components/trainer/program-builder/`). Confirmar antes de adicionar o botão "Editar séries".
- Bottom sheet: investigar se o padrão atual usa `Modal` RN nativo ou `@gorhom/bottom-sheet`. Seguir o que
  já existe (TextPrescriptionSheet é referência).

NÃO TOQUE:
- `mobile/hooks/useWorkoutSession.ts`, `mobile/components/workout/*`, `mobile/lib/getProgramSnapshotForWatch.ts`,
  `mobile/lib/getNextWorkoutForWatch.ts`, `targets/watch-app/` — TUDO isso é Fase 4.
- `web/`, `supabase/functions/` — Fases 2 e 5.
- `shared/` — já entregue.

CRITÉRIO DE PARADA: checkboxes da "Fase 3" em "Critérios de Aceite" verdes,
incluindo `cd mobile && npx tsc --noEmit && npx vitest run` sem novos erros vs main.

Após terminar: atualizar "Notas de Implementação" + PR `feat(per-set): Fase 3 — Mobile Builder`.
```

---

## Fase 4 — Sala de Treino (mobile + Watch)

```
Você está implementando a Fase 4 de mobile/specs/active/prescricao-per-set-manual.md.
Pré-requisito: Fase 1 mergeada em main. Pode rodar em paralelo com Fases 2 e 3.
Branch: feat/per-set-fase-4-sala-treino (já existe, criada a partir da Fase 1). Faça `git rebase main` antes de começar.

LEIA antes de codar:
- A seção "Fase 4" em "Estratégia de execução" da spec.
- "Escopo → Incluído → Mobile — sala de treino do aluno (Fase 4)" — lista exata.
- "Arquivos Afetados → Mobile — editar" (apenas useWorkoutSession, SetRow, ExerciseCard, getProgramSnapshotForWatch, getNextWorkoutForWatch) e "Watch app — editar (Fase 4)".
- "Critérios de Aceite → Fase 4".
- "Comportamento Esperado → Fluxo do Usuário" Cenários 5 e 6 (programa legado).
- "Comportamento Esperado → Fluxo Técnico → Leitura (mobile sala de treino, hidratação)".
- "Regras especiais → Watch app: sempre fallback gracioso" e "Aluno não vê inputs de carga sugerida (V1)".
- "Edge Cases" (foco em programa legado, aluno offline, Watch app antigo).
- mobile/CLAUDE.md + APPLE_WATCH.md.

REGRA DE OURO DA FASE: retrocompat absoluta.
- Se `assigned_workout_item_sets` tem zero linhas pra um item, comportamento é EXATAMENTE o de hoje.
  Nenhuma flag nova, nenhum erro novo. Programa legado precisa funcionar sem ajuste.
- Watch app: snapshot pro Watch é forward-compatible. Se Watch antigo lê snapshot novo com `set_scheme`,
  ignora os campos novos e usa os agregados.

USE de @kinevo/shared (mesmos imports das fases anteriores).

NÃO TOQUE:
- `mobile/stores/program-builder-store.ts`, `mobile/components/trainer/program-builder/*`,
  `mobile/hooks/useProgramBuilder.ts` — Fase 3.
- `web/`, `supabase/functions/` — Fases 2 e 5.
- `shared/` — já entregue.

CRITÉRIO DE PARADA: checkboxes da "Fase 4" em "Critérios de Aceite" verdes. Smoke test em iOS + Android
(programa com pirâmide e drop-set executado até o fim sem erro). Se não tiver Apple Watch físico
disponível, deixar checkbox do Watch como pendente e documentar em "Notas de Implementação".

Após terminar: atualizar "Notas de Implementação" + PR `feat(per-set): Fase 4 — Sala de Treino`.
```

---

## Fase 5 — Texto para Treino

```
Você está implementando a Fase 5 de mobile/specs/active/prescricao-per-set-manual.md.
Pré-requisito: Fases 1, 2 e 3 mergeadas em main (precisa do builder web e mobile pra renderizar
o set_scheme que vem do parser).
Branch: feat/per-set-fase-5-texto-para-treino (já existe). Faça `git rebase main` antes de começar.

LEIA antes de codar:
- A seção "Fase 5" em "Estratégia de execução" da spec.
- "Escopo → Incluído → Texto para Treino (Fase 5)" — lista exata.
- "Arquivos Afetados → Edge Functions — editar" e os blocos da Fase 5 em "Web — editar" e "Mobile — editar".
- "Critérios de Aceite → Fase 5".
- "Comportamento Esperado → Fluxo do Usuário" Cenário 4 (texto livre com 3 padrões).
- "Comportamento Esperado → Fluxo Técnico → Texto para Treino — Edge Function" — sem isso o prompt fica solto.
- "Restrições Técnicas → Edge Function `parse-workout-text` mantém compatibilidade".
- "Edge Cases" (foco em LLM retornando set_scheme malformado, timeout, set_scheme vazio).

USE de @kinevo/shared:
- Tipos `WorkoutSet`, `SetType`, `MethodKey` no Edge Function via import relativo (Edge Functions Deno
  não suportam `@kinevo/shared` direto — copiar tipos como `import type` se necessário, ou re-exportar
  a partir de um arquivo .ts no diretório da function. Manter alinhado com o shared via teste de paridade).
- Web/mobile usam imports normais de `@kinevo/shared`.

ATENÇÃO ESPECIAL:
- `validateAndFixResponse` é a defesa em profundidade: LLM pode retornar lixo. Spec lista 4 regras
  obrigatórias (coerção, sanitização, rejeição de set_number duplicado/lacunar, descarte de scheme vazio).
- Performance: prompt não pode aumentar mais de 20% no tempo médio. Se passar, simplificar.
- Set types e enums: garantir que o system prompt lista exatamente os 8 valores de SetType. Adicionar
  teste de paridade contra `SET_TYPE_OPTIONS` do shared.
- Texto sem padrão variável continua retornando `set_scheme: null` — zero regressão.

NÃO TOQUE:
- `web/src/lib/prescription/` (motor de IA agentivo — fora de escopo).
- `shared/` — já entregue.
- Builder web/mobile, sala de treino, Watch — Fases 2/3/4 já mergeadas.

CRITÉRIO DE PARADA: checkboxes da "Fase 5" verdes. Smoke test: 10 textos diferentes
(5 com pirâmide/drop/cluster, 5 sem padrão variável) parseados corretamente.
`cd supabase/functions/parse-workout-text && deno check index.ts` limpo.

Após terminar:
1. Atualizar "Notas de Implementação".
2. Mudar status no topo da spec: `[x] Concluída`.
3. Mover spec de `mobile/specs/active/` para `mobile/specs/completed/`.
4. PR `feat(per-set): Fase 5 — Texto para Treino`.
```

---

## Lembretes gerais (todas as fases)

- **Sem `any`.** Tipos vêm do shared.
- **Mudanças cirúrgicas.** Não reescrever código que já funciona.
- **Retrocompat absoluta.** Programas/drafts antigos precisam continuar funcionando sem ajuste.
- **Não tocar no motor de IA agentivo** (`web/src/lib/prescription/`). Continua gerando agregados.
- **Sentence case, pt-BR, Lucide icons, sem emoji** em qualquer UI nova.
- **Atualizar "Notas de Implementação" da spec** ao fim de cada fase, listando arquivos tocados e decisões não óbvias.
- **Marcar checkboxes** dos "Critérios de Aceite" da fase correspondente como `[x]`.
