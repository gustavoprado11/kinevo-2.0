# Prompt para Claude Code — Fase 2.5.4 (reconciliar contrato `programs/assign` mobile↔handler)

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia, nesta ordem:

1. `docs/specs/logs/fase-2.5.3-execucao.md` — §4.2 (validação E2E do mobile funnel) e a descoberta cascata: mobile envia `{ studentId, generationId, outputSnapshot, startDate }`, handler espera `{ studentId, templateId, … }`.
2. `docs/specs/logs/auditoria-middleware-mobile.md` — §3 (rotas A fora da whitelist, status atual).
3. `web/src/app/api/programs/assign/route.ts` — handler atual (322 linhas). Contrato único hoje: `templateId` obrigatório.
4. `mobile/` — grep por `programs/assign` para ver exatamente o body que o app manda (provavelmente em `mobile/src/` ou `mobile/services/`).
5. `web/src/app/students/[id]/actions/assign-program.ts` — server action web equivalente. É o fallback de segurança: se mexer em algo compartilhado (helper, util), conferir que essa path não regride.
6. `docs/specs/06-fase-2.5-prescricao-inteligente.md` — §3.4 e §5.7 (shape do `output_snapshot` em `prescription_generations`).

## Contexto

A Fase 2.5.3 fechou a parte do middleware: whitelist + `notify-student` + 329 testes verdes + E2E Bearer 200 OK no `POST /api/prescription/generate`. No mesmo walk-through, ficou evidente que o funil do mobile tem **mais um elo quebrado a jusante** do `generate`: quando o trainer aprova o programa na tela de revisão do app, o mobile dispara `POST /api/programs/assign` com o contrato errado pra esse handler, e cai em **400 "studentId and templateId are required"**.

Resumo do mismatch:

- **Web (cookies)**: trainer escolhe um `program_template` na UI do desktop, clica "atribuir ao aluno", handler copia workouts/items do template.
- **Mobile (Bearer)**: trainer revisa uma **geração da IA** (`prescription_generations` row), aprova, e o mobile manda `generationId` + um snapshot local — **nunca passa por `program_templates`**.

A saída aprovada pelo Gustavo (resumida em termos de produto):

- **Jeito A — contrato backward-compatível.** O handler passa a aceitar **dois shapes**: o antigo com `templateId` (web continua funcionando igual) e o novo com `generationId` (mobile funciona sem mexer no app).
- **Jeito Seguro — strict DB fetch.** Quando o caminho `generationId` é acionado, o handler **ignora qualquer `outputSnapshot` no body** e busca fresco em `prescription_generations.output_snapshot` por id, validando ownership do trainer. Não confia em nada que o cliente manda além do id.

Esta fase **fecha o funil completo da IA no mobile**: `generate → review → approve → assigned_programs`. É o último elo antes de considerar rollout pra outros trainers via `smart_v2_enabled`.

## Escopo

1. Adicionar branch `generationId` em `web/src/app/api/programs/assign/route.ts`, preservando o branch `templateId` intacto.
2. Implementar `buildAssignmentFromSnapshot(supabase, { generationId, trainerId, studentId, startDate, isScheduled, workoutSchedule })` como helper em `web/src/lib/ai-prescription/assign-from-snapshot.ts` (arquivo novo). Esse helper é quem materializa `assigned_programs` + `assigned_workouts` + `assigned_workout_items` a partir do `output_snapshot`.
3. Unit tests do helper + unit tests do novo branch da route (mockando supabase como os testes existentes de `/api/prescription/generate` fazem).
4. Validação E2E Bearer: reutilizar a generation mais recente do Alysson (`bbe3c04a-72cd-437e-8faa-46615b2ff9e2`) criada na Fase 2.5 walk-through ou, se todas já estiverem `status='approved'`, disparar uma nova via `/api/prescription/generate` antes. Depois, curl no `/api/programs/assign` com `{ studentId, generationId, startDate }` e esperar 200 + row em `assigned_programs` com `ai_generated=true` e `prescription_generation_id` preenchido.
5. Atualizar `docs/specs/logs/auditoria-middleware-mobile.md` §3 marcando `/api/programs/assign` como "contrato reconciliado — mobile funnel fechado".
6. Criar `docs/specs/logs/fase-2.5.4-execucao.md`.
7. Fechar follow-up #17 da Fase 2.5 (funil mobile end-to-end).

## Regras desta sessão

- **Plano primeiro, espera aprovação antes de editar.**
- Strings user-facing em pt-BR; código e comentários em inglês.
- **Não ligue** a flag `smart_v2_enabled` pra outros trainers nesta fase. O funil precisa estar provado antes do rollout.
- **Não mexa** na server action web `web/src/app/students/[id]/actions/assign-program.ts` a menos que dê pra extrair um helper compartilhado **sem regredir o caminho web**. Se parecer arriscado, prefere duplicar lógica mínima e deixa `follow-up` pra unificar depois.
- **Não use git.**
- **Não confie no body do mobile** pra nada além dos ids e das preferências de agendamento (`startDate`, `isScheduled`, `workoutSchedule`). Qualquer `outputSnapshot` que vier no body é ignorado — busca sempre do DB.
- Se durante a investigação descobrir **outro** mismatch de contrato (ex: resposta do handler tem shape que o mobile não consome), pausa e reporta antes de ampliar escopo.

## Antes de editar — produza o plano

O plano deve cobrir as 6 etapas abaixo, cada uma com "arquivo(s) tocado(s)", "o que muda", "como sei que não quebrei o que já funciona".

### Etapa 1 — Mapear o que o mobile manda hoje

Grep no app:

```bash
grep -rn "programs/assign" mobile/ --include='*.ts' --include='*.tsx'
```

Abrir o(s) arquivo(s) encontrado(s) e registrar no plano o **body exato** que o mobile POSTa. Confirmação explícita dos campos: `studentId`, `generationId`, `outputSnapshot` (a ser ignorado), `startDate`, e qualquer outro (ex: `isScheduled`, `workoutSchedule`).

Se o mobile mandar algum campo que o handler **deveria** usar (ex: `workoutSchedule` com a alocação de dias por workout), registrar no plano como parte do contrato. Se mandar algo claramente inútil (ex: campos legados), listar como "ignorado por design".

### Etapa 2 — Decidir branching no handler

No handler, a regra é:

```
se body.templateId presente → branch web existente (não muda nada)
senão se body.generationId presente → branch novo (Jeito A)
senão → 400 "studentId is required plus one of: templateId | generationId"
```

Validar no plano que a regra atual `if (!studentId || !templateId) return 400` vira `if (!studentId || (!templateId && !generationId)) return 400` — e confirmar que isso **não afeta** nenhum teste existente do caminho web (que sempre manda `templateId`).

Descrever exatamente quais linhas vão virar "common prelude" (auth + rate limit + ownership do student) e a partir de qual linha o fluxo se ramifica.

### Etapa 3 — Desenhar o helper `assign-from-snapshot`

Assinatura proposta:

```ts
// web/src/lib/ai-prescription/assign-from-snapshot.ts

export interface AssignFromSnapshotInput {
    generationId: string
    trainerId: string
    studentId: string
    startDate: string | null
    isScheduled: boolean
    workoutSchedule?: Record<number, number[]>
}

export interface AssignFromSnapshotResult {
    programId: string
}

export async function assignFromSnapshot(
    supabase: SupabaseClient,
    input: AssignFromSnapshotInput,
): Promise<AssignFromSnapshotResult>
```

Comportamento obrigatório:

1. Busca `prescription_generations` pelo id, filtrando `trainer_id = input.trainerId` **e** `student_id = input.studentId` (defesa em profundidade contra id roubado).
2. Se não encontrar → lança erro tipado `GenerationNotFoundError`.
3. Se `status === 'approved'` → lança `GenerationAlreadyApprovedError` (evita double-assign).
4. Se `output_snapshot` for null/undefined → lança `GenerationSnapshotMissingError`.
5. Se o aluno já tiver `assigned_programs` com `status='active'` e `isScheduled=false` → marca como `completed` antes de inserir o novo (mesma lógica do branch web).
6. Insere `assigned_programs` com `source_template_id=null`, `ai_generated=true`, `prescription_generation_id=input.generationId`, `name` do snapshot, `description` do snapshot (se existir), `duration_weeks` do snapshot (se existir, senão default 4).
7. Itera `output_snapshot.workouts` (shape documentado em §3.4 da spec 2.5), inserindo cada workout em `assigned_workouts` + cada item em `assigned_workout_items`. **Não** precisa resolver parent/child do mesmo jeito que o branch template — o snapshot da IA v2.5 não usa superset hoje, mas se um dia usar, o mesmo helper deve suportar (plano deve confirmar shape atual antes de escrever código; se superset aparecer no snapshot, implementar).
8. Atualiza `prescription_generations.status='approved'`, `approved_at=now()`, `assigned_program_id=<novo id>`.

Tudo dentro de uma sequência serial — sem transação explícita porque Supabase JS não expõe — mas com logging em cada passo pra permitir diagnóstico se algo falhar no meio. Se falhar depois do insert em `assigned_programs`, o handler tenta um cleanup best-effort (delete do program parcialmente criado) e retorna 500.

### Etapa 4 — Testes

Adicionar em `web/src/lib/ai-prescription/__tests__/assign-from-snapshot.test.ts`:

- `happy path`: generation pending com snapshot válido → retorna programId, inserts corretos, generation marcada approved.
- `generation not found`: id inexistente pro trainer → lança `GenerationNotFoundError`.
- `already approved`: status='approved' → lança `GenerationAlreadyApprovedError`.
- `snapshot missing`: output_snapshot=null → lança `GenerationSnapshotMissingError`.
- `student mismatch`: generation existe mas `student_id` não bate → lança `GenerationNotFoundError` (não vaza info).
- `active program replaced`: aluno tem assigned_program active + isScheduled=false → active anterior vira completed.
- `scheduled doesn't replace`: isScheduled=true → active anterior não é tocado.

Adicionar em `web/src/app/api/programs/assign/__tests__/route.test.ts` (criar se não existir — veja padrão dos testes de `/api/prescription/generate`):

- `templateId branch ainda funciona`: shape antigo → 200 + programId (smoke, mocka template).
- `generationId branch 200`: body sem templateId, com generationId → 200 + programId.
- `ambos ausentes`: 400 com mensagem clara.
- `ambos presentes`: preferência por templateId (branch web ganha) — **OU** 400 "escolha apenas um" se preferir falhar explícito; plano deve justificar a escolha.
- `generationId inválido (UUID malformado)`: 400.
- `outputSnapshot no body é ignorado`: mocka generation real no DB com snapshot X; manda body com `outputSnapshot=Y` forjado; espera programId vir baseado em X, não Y. Isto é o teste-chave do **Jeito Seguro**.

Rodar `npm test` e `npx tsc --noEmit`. Tudo verde antes de seguir.

### Etapa 5 — Validação E2E Bearer

Pré-check:

```sql
SELECT id, student_id, status, output_snapshot IS NOT NULL AS has_snapshot, created_at
FROM prescription_generations
WHERE student_id = 'bbe3c04a-72cd-437e-8faa-46615b2ff9e2'
  AND trainer_id = '7aec3555-600c-4e7c-966e-028116921683'
ORDER BY created_at DESC
LIMIT 5;
```

Se existir ao menos uma com `status <> 'approved'` e `has_snapshot=true`, usar. Senão, disparar nova via `/api/prescription/generate` primeiro.

Curl de assign:

```bash
JWT="$(cat /tmp/kvn-trainer-jwt.txt)"
GEN_ID="<gen id escolhido>"
STU_ID="bbe3c04a-72cd-437e-8faa-46615b2ff9e2"

curl -sS -X POST http://localhost:3000/api/programs/assign \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"$STU_ID\",\"generationId\":\"$GEN_ID\"}" \
  -w "\nHTTP %{http_code} — %{time_total}s\n"
```

Esperado: 200 + `{ success: true, programId: "<uuid>" }`.

Confirmação DB:

```sql
SELECT id, student_id, trainer_id, ai_generated, prescription_generation_id,
       source_template_id, status, started_at, name, duration_weeks
FROM assigned_programs
WHERE prescription_generation_id = '<GEN_ID>';

SELECT COUNT(*) AS n_workouts
FROM assigned_workouts
WHERE assigned_program_id = '<programId retornado>';

SELECT COUNT(*) AS n_items
FROM assigned_workout_items awi
JOIN assigned_workouts aw ON aw.id = awi.assigned_workout_id
WHERE aw.assigned_program_id = '<programId retornado>';

SELECT status, approved_at, assigned_program_id
FROM prescription_generations
WHERE id = '<GEN_ID>';
```

Valores esperados:

- `ai_generated=true`, `source_template_id IS NULL`, `prescription_generation_id=<GEN_ID>`.
- `n_workouts` bate com `jsonb_array_length(output_snapshot->'workouts')` da generation.
- `n_items` bate com soma dos `jsonb_array_length(wk->'exercises')`.
- Generation agora `status='approved'` com `approved_at` preenchido e `assigned_program_id` apontando pro programa novo.

### Etapa 6 — Logs + follow-ups

`docs/specs/logs/fase-2.5.4-execucao.md` com:

- §1 Escopo entregue (helper novo + branch novo no route + testes + validação E2E).
- §2 Diff resumido dos 3 arquivos tocados (`route.ts`, `assign-from-snapshot.ts` novo, test files novos).
- §3 Mapping do contrato mobile: o que o app manda hoje, o que o handler usa, o que é ignorado.
- §4 Evidências E2E: curl + row em `assigned_programs` + counts dos workouts/items + status da generation.
- §5 Decisões de segurança: por que ignorar `outputSnapshot` do body, por que filtrar por `trainer_id` + `student_id` no fetch da generation.
- §6 Follow-ups: consolidar `web/src/app/students/[id]/actions/assign-program.ts` pra usar helper compartilhado (não fazer agora); verificar outras 11 rotas A da auditoria por mismatches de contrato parecidos; considerar contrato mais estrito "escolha templateId OU generationId, nunca ambos".
- §7 Cascade discoveries se houver (exemplo: resposta do handler tem shape que o mobile não consome direito — reportar, não fixar).

Atualizar `docs/specs/logs/auditoria-middleware-mobile.md` §3: marcar `/api/programs/assign` como ✅ "Contrato reconciliado — mobile funnel fechado (Fase 2.5.4)".

Atualizar `docs/specs/logs/fase-2.5-execucao.md` §6 follow-up #17: **Concluído** com link pro log 2.5.4.

## Se algo falhar

- **400 no curl com branch generationId**: provavelmente `body.templateId` veio falsy-pero-truthy ou validation fora de ordem. Logar o body recebido, diagnosticar, corrigir, re-rodar. Não abrir escopo.
- **500 no insert de assigned_workouts**: provavelmente shape do `output_snapshot` diverge do que o helper espera. Abrir a row da generation, ver o shape real, ajustar helper. **Se for mismatch estrutural grande** (ex: snapshot usa chaves snake_case mas helper espera camelCase ou vice-versa), pausa e reporta antes de cascatear fixes.
- **RLS block no insert de assigned_programs**: confirmar policies de `assigned_programs` — devem permitir insert quando `trainer_id = auth.jwt.coach_id` ou equivalente. Se RLS estiver mais restritivo do que a lógica web, reportar.
- **Test suite quebra em algum teste não relacionado**: ver se já era um dos 11 pré-existentes listados como follow-up #10. Se sim, ok. Se for novo, reporta e pausa.

## Definição de "pronto"

- `web/src/app/api/programs/assign/route.ts` aceita ambos os shapes, branching limpo, 400 claro quando nenhum dos dois.
- `web/src/lib/ai-prescription/assign-from-snapshot.ts` novo, com helper + erros tipados + docs inline.
- Suíte de testes completa do helper (7 casos) e do novo branch da route (6 casos) — todos verdes.
- `npm test` verde (329+13 = 342+ testes), `npx tsc --noEmit` zero erros.
- Curl E2E Bearer retorna 200 com programId válido.
- Rows no DB confirmam shape correto, counts batem, generation marcada approved.
- `docs/specs/logs/fase-2.5.4-execucao.md` criado com §1–§7.
- `docs/specs/logs/auditoria-middleware-mobile.md` §3 atualizado.
- `docs/specs/logs/fase-2.5-execucao.md` §6 follow-up #17 marcado concluído.
- Funil do mobile end-to-end funcional: **generate → review → approve → assigned_programs**, tudo passando por Bearer JWT sem intervenção manual.

Comece produzindo o plano. Aguarde aprovação antes de editar qualquer arquivo de código.
