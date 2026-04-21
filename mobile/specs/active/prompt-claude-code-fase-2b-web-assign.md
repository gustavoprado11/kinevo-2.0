# Prompt — Fase 2b: Web (assign com snapshot editado)

> Copie e cole o bloco abaixo em uma sessão nova do Claude Code, a partir da raiz do monorepo `kinevo`.

---

## ⚠️ AVISO DE SEGURANÇA — LEIA ANTES DE ESCREVER QUALQUER CÓDIGO

Essa fase **muda uma decisão de segurança documentada em `web/src/actions/prescription/assign-from-snapshot.ts` (Fase 2.5.4 §5)**. O comentário lá explicita que o endpoint ignora qualquer `outputSnapshot` vindo do cliente e sempre re-fetcha do banco a partir do `generationId`. A razão é impedir um cliente malicioso de injetar exercícios/volume arbitrário.

**Antes de escrever qualquer linha de código:**

1. Abra `web/src/actions/prescription/assign-from-snapshot.ts` e leia **o arquivo inteiro**. Localize o bloco/comentário marcado como Fase 2.5.4 §5.
2. Abra `web/src/app/api/programs/assign/route.ts` e leia o route inteiro.
3. Leia a seção "Posture de segurança existente" e "Restrições Técnicas → Fase 2b" da spec: `mobile/specs/active/unificacao-prescricao-ia-mobile.md`.
4. Confirme que entendeu a propriedade que precisa ser preservada: **um cliente só pode persistir um snapshot editado se (a) é dono da geração, (b) o shape do snapshot é válido, (c) todos os `exercise_id` referenciam exercícios que o trainer pode usar**.

Se em algum momento você achar que uma das três validações "não é necessária" ou "o cliente já valida", **pare e releia** — a postura atual existe porque o cliente **não é confiável**.

---

Essa é a **Fase 2b de 4** da unificação da prescrição IA no mobile. É um PR pequeno, cirúrgico, dedicado a essa mudança de postura de segurança.

## Prerequisito

- **Fase 1 precisa estar mergeada** (para os tipos `PrescriptionOutputSnapshot` e helpers).
- Fase 2a pode ser independente — essa fase só toca `assign`.

## Spec

Leia por inteiro: `mobile/specs/active/unificacao-prescricao-ia-mobile.md`. Essa fase corresponde à seção "Estratégia de execução → Fase 2b" e às entradas "(Fase 2b)" em "Arquivos Afetados" + "Critérios de Aceite".

## Contexto

- O endpoint `POST /api/programs/assign` hoje aceita `{ studentId, generationId }` e delega para `assign-from-snapshot.ts`, que **re-fetcha o `output_snapshot` do banco** a partir do `generationId` e persiste em `assigned_program`. Qualquer `outputSnapshot` no body é ignorado.
- A nova necessidade (vinda do mobile — Fase 3) é permitir que o treinador edite o snapshot no builder e salve a versão editada. Ou seja: aceitar `outputSnapshot` + `isEdited: true` no body.
- Isso **só é seguro** se adicionarmos validações server-side rigorosas. A meta é: um cliente malicioso não pode inflar volume, trocar exercícios por IDs que não existem, etc.

## Trabalho

### 1. Estender `POST /api/programs/assign`

- Arquivo: `web/src/app/api/programs/assign/route.ts`.
- Aceitar no body (**backward compat obrigatória**):
  - `outputSnapshot?: PrescriptionOutputSnapshot` — opcional.
  - `isEdited?: boolean` — opcional, default `false`.
- Fluxo:
  1. Auth: Bearer JWT, `getUser`, trainer lookup, feature flag (igual hoje).
  2. Parse do body. Se `isEdited === true`, `outputSnapshot` é **obrigatório** — se ausente, 400.
  3. Validação de ownership: busque `prescription_generations` por `id = generationId`. Confirme que `trainer_id === user.trainer.id` E `student_id === studentId`. Se não bater, 403.
  4. **Somente** se `isEdited === true && outputSnapshot`:
     - Valide shape de `outputSnapshot` com Zod (ou equivalente) contra o tipo compartilhado. Se inválido, 400 com mensagem "Snapshot inválido".
     - Extraia todos os `exercise_id` únicos do `outputSnapshot.workouts[].exercises[]`.
     - Busque em `exercises` (ou `exercise_templates`, conforme o catálogo usado) todos os IDs. Se algum não existir, ou não estiver acessível ao trainer (ownership do exercício), 400 com mensagem "Exercício fora do catálogo: <id>".
     - Repasse `outputSnapshot` para `assignFromSnapshot(...)` via novo parâmetro `editedSnapshot` (ver próximo passo).
  5. Caso `isEdited === false` ou ausente: comportamento atual idêntico (re-fetcha do banco).

### 2. Estender `assign-from-snapshot.ts`

- Arquivo: `web/src/actions/prescription/assign-from-snapshot.ts` (ou equivalente).
- Adicionar parâmetro opcional `editedSnapshot?: PrescriptionOutputSnapshot`.
  - Se presente, usar `editedSnapshot` como fonte do que será persistido em `assigned_program` (ao invés do re-fetch do `output_snapshot` do banco).
  - Se ausente, comportamento atual.
- Registrar em `prescription_generations` (ou tabela de auditoria apropriada) que a geração foi persistida com edições. Se houver um campo `was_edited` ou `edited_at`, atualize. Se não, documente no comentário que a edição não é auditada (e deixe um TODO).
- **Atualize o comentário de Fase 2.5.4 §5** para refletir a nova postura. Algo como:
  ```
  // Fase 2.5.4 §5 (revisado em Fase 3.x — unificação mobile):
  // Aceitamos `editedSnapshot` vindo do cliente desde que o caller tenha validado:
  //   1. Ownership do generationId (trainer + student);
  //   2. Shape do snapshot (Zod contra PrescriptionOutputSnapshot);
  //   3. Que todo exercise_id pertence ao catálogo acessível ao trainer.
  // Sem essas três validações, NÃO aceite editedSnapshot — re-fetche do banco.
  ```
  (Ajuste o wording ao estilo do codebase.)

### 3. Tests

Adicione testes unitários (Vitest) para o route em `web/src/app/api/programs/__tests__/assign.test.ts`:
- Happy path edited: `isEdited: true` com snapshot válido e ownership correto persiste o snapshot enviado.
- `isEdited: true` com `generationId` de outro trainer → 403. **Crie fixtures de dois trainers diferentes para este caso.**
- `isEdited: true` com exercício fora do catálogo → 400 com mensagem descritiva.
- `isEdited: true` com `outputSnapshot` de shape inválido (ex: faltando `workouts[]`) → 400.
- `isEdited: true` sem `outputSnapshot` no body → 400.
- `isEdited: false` ou ausente mantém comportamento atual (mock do re-fetch do banco).

### 4. Verificação final

- `cd web && npx tsc --noEmit` → zero novos erros vs `main`.
- `cd web && npm run test` → verde.
- Revise o diff inteiro e confirme que **não mudou nada além do route, da server action, e dos testes**. Sem alterações em UI, outros endpoints, ou migrações.
- Revalide manualmente o comentário de Fase 2.5.4 §5 no arquivo após a edição — confirme que está factualmente correto pro novo comportamento.

## Restrições

- **Backward compat no `/api/programs/assign` é inegociável.** O mobile de hoje e o web builder que já chama esse endpoint sem `outputSnapshot` devem continuar funcionando sem mudanças.
- **Não confie em dado do cliente.** Toda validação acontece server-side.
- **Não faça "fast path" ignorando validações.** Se parecer muita validação, é exatamente o ponto.
- **Se você adicionar logs de audit**, não logue o snapshot inteiro (pode conter PII) — logue só `generationId`, `trainer_id`, `student_id`, `was_edited`.
- **Não toque em `shared/`, `mobile/`, `supabase/functions/`.**
- **Não refatore o route inteiro.** Cirurgia.

## Entregáveis finais

1. `web/src/app/api/programs/assign/route.ts` estendido com validações.
2. `web/src/actions/prescription/assign-from-snapshot.ts` aceitando `editedSnapshot` + comentário de segurança atualizado.
3. Testes cobrindo todos os casos da seção 3.
4. `tsc --noEmit` limpo em `web/`.
5. Resumo em bullets com:
   - Exatamente quais validações foram adicionadas e por quê.
   - Link (linha) para o comentário de segurança atualizado.
   - Casos de teste criados.
   - Qualquer decisão não-óbvia (ex: como checou ownership do exercício — se é por trainer, se inclui templates globais).

Quando terminar, **não crie PR ou commit** — deixe as mudanças locais para o dev revisar com atenção extra nessa fase.
