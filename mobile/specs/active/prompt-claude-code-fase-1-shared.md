# Prompt — Fase 1: Shared (mapper + snapshot-from-draft)

> Copie e cole o bloco abaixo em uma sessão nova do Claude Code, a partir da raiz do monorepo `kinevo` (com `web/`, `mobile/`, `shared/`, `supabase/`).

---

Essa é a **Fase 1 de 4** da unificação da prescrição IA no mobile. Aqui você só mexe no workspace `shared/`. Sem mudanças em web ou mobile (exceto um re-export trivial). Ao final, `shared/` exporta duas funções puras usadas pelas fases seguintes.

## Spec

Leia por inteiro antes de codar: `mobile/specs/active/unificacao-prescricao-ia-mobile.md`. Essa fase corresponde à seção "Estratégia de execução → Fase 1 — Shared" e às entradas marcadas com "(Fase 1)" em "Arquivos Afetados".

## Contexto

- Monorepo npm workspaces. `shared/` é o lugar de tipos e funções puras usadas por web e mobile.
- O web tem hoje `web/src/lib/prescription/builder-mapper.ts` com a função `mapAiOutputToBuilderData(snapshot: PrescriptionOutputSnapshot): BuilderProgramData`. Essa função é pura (sem I/O, sem `fetch`, sem DB). Vai se mover para `shared/` e o web vira re-export.
- O mobile ainda não usa essa função — mas a Fase 3 vai importar do `shared/` direto.
- O tipo `PrescriptionOutputSnapshot` vive em `shared/types/prescription.ts`. Veja o shape: `workouts[].exercises[]` é **flat** (sem supersets).
- A nova função `buildSnapshotFromDraft(draft: ProgramDraft): PrescriptionOutputSnapshot` faz o caminho inverso: pega o `ProgramDraft` do mobile (`mobile/stores/program-builder-store.ts`) e produz um `PrescriptionOutputSnapshot` que o endpoint `/api/programs/assign` (Fase 2b) vai aceitar como "snapshot editado".

## Trabalho

### 1. Mover `mapAiOutputToBuilderData` para `shared/`

- Crie `shared/lib/prescription/builder-mapper.ts` com o **mesmo conteúdo** do atual `web/src/lib/prescription/builder-mapper.ts`. Ajuste imports se necessário (use paths relativos dentro de `shared/` e importe tipos de `../../types/prescription`).
- No arquivo antigo `web/src/lib/prescription/builder-mapper.ts`, substitua o conteúdo inteiro por:
  ```ts
  export { mapAiOutputToBuilderData } from '@kinevo/shared/lib/prescription/builder-mapper';
  ```
  Confirme que o alias `@kinevo/shared` funciona olhando `web/tsconfig.json` e `web/package.json` — se não houver alias, use o path relativo correto (`../../../../shared/lib/prescription/builder-mapper`).
- Zero mudança de comportamento. Todos os imports existentes no web continuam válidos.

### 2. Criar `buildSnapshotFromDraft`

- Crie `shared/lib/prescription/snapshot-from-draft.ts`.
- Exporte:
  - Classe de erro `SupersetInSnapshotError extends Error` (nome: `'SupersetInSnapshotError'`). Mensagem default: `'Drafts com supersets não podem ser serializados como PrescriptionOutputSnapshot.'`.
  - Função `buildSnapshotFromDraft(draft: ProgramDraft): PrescriptionOutputSnapshot`.
- Tipo `ProgramDraft` vem de `mobile/stores/program-builder-store.ts` — **mas não importe do mobile**. Copie só as partes estruturais relevantes (workouts, exercises, flags) para um tipo local em `shared/`, ou reuse tipos já existentes em `shared/types/program.ts` se houver sobreposição. Se for necessário, crie um novo tipo `ProgramDraftLike` em `shared/types/prescription.ts` que capture apenas o que `buildSnapshotFromDraft` precisa (nome, duração, workouts com exercises, campos relevantes de cada exercício). Isso evita acoplamento com MMKV/Zustand do mobile.
- Comportamento:
  - Itera `draft.workouts[]` e para cada um produz `{ name, description?, day_of_week?, exercises: [] }` seguindo o shape de `PrescriptionOutputSnapshot.workouts[]`.
  - Se algum exercício tem `parent_item_id != null` (indicador de superset filho no mobile), **lança `SupersetInSnapshotError`** imediatamente. Não achata. Não ignora. Não suprime.
  - Preserva `sets`, `reps`, `rest_seconds`, `notes`, `exercise_id`, `order` de cada exercício.
  - Preserva `duration_weeks` e `name` do draft.
  - `workouts[].days` deve sair como `[]` se `frequency` não estiver definida no draft (não use `null`).
- Função 100% pura. Sem `fetch`. Sem acesso ao catálogo. Sem DB. Sem side effects.

### 3. Atualizar `shared/index.ts`

- Adicione exports para `./lib/prescription/builder-mapper` e `./lib/prescription/snapshot-from-draft` (incluindo `SupersetInSnapshotError`).
- Se `shared/` tiver um build step próprio (dist), rode `npm run build` no `shared/` e verifique que os novos arquivos saem no dist.

### 4. Testes (Vitest no `shared/`)

Adicione `shared/lib/prescription/__tests__/builder-mapper.test.ts` (ou mova o teste existente do web se houver) cobrindo:
- Output com 1 workout.
- Output com 3 workouts.
- Snapshot com `reasoning` ausente.
- Snapshot com `duration_weeks: null`.
- IDs gerados têm prefixo `temp_`.

Adicione `shared/lib/prescription/__tests__/snapshot-from-draft.test.ts` cobrindo:
- Draft com exercícios regulares vira `outputSnapshot` correto (shape exato).
- Draft com **qualquer** exercício contendo `parent_item_id` lança `SupersetInSnapshotError`.
- Workout sem `frequency` preenche `days: []`.
- **Roundtrip sem supersets**: crie um `PrescriptionOutputSnapshot` fixture, aplique `mapAiOutputToBuilderData`, depois aplique `buildSnapshotFromDraft` no resultado convertido para `ProgramDraft`-like, e assert que o snapshot final é estruturalmente equivalente (mesmos exercícios, sets, reps, rest_seconds). IDs `temp_` podem ser diferentes — compare por `exercise_id` e ordem.

### 5. Verificação final

- `cd shared && npx tsc --noEmit` → limpo.
- `cd shared && npm run test` (ou `npx vitest run`) → verde.
- `cd web && npx tsc --noEmit` → sem novos erros vs `main` (o re-export não deve quebrar nada).
- Revise o diff: só arquivos em `shared/` e um arquivo de 1 linha em `web/src/lib/prescription/builder-mapper.ts`.

## Restrições

- **Não toque em `mobile/`.** Fase 3 faz isso.
- **Não crie rotas HTTP, hooks, UI.** Só funções puras + tipos + testes.
- **Não use `any`.** Use os tipos compartilhados.
- **Não "achate" supersets.** O design é explicitamente jogar o erro e deixar o caller decidir (mobile vai mostrar Alert na Fase 3).

## Entregáveis finais

1. `shared/lib/prescription/builder-mapper.ts` (movido) + `shared/lib/prescription/snapshot-from-draft.ts` (novo).
2. `web/src/lib/prescription/builder-mapper.ts` como re-export de 1 linha.
3. `shared/index.ts` atualizado.
4. Testes verdes em `shared/`.
5. `tsc --noEmit` limpo em `shared/` e `web/`.
6. Resumo final em bullets com arquivos tocados e comandos rodados.

Quando terminar, **não crie PR ou commit** — deixe as mudanças locais para o dev revisar.
