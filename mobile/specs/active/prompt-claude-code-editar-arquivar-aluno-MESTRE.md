# Prompt mestre — Editar e arquivar aluno no menu "..." do mobile

> Copie tudo abaixo desta linha e cole em uma sessão nova do Claude Code, a partir da raiz do monorepo `kinevo`. Não pule seções. Não comece a codar antes de terminar a seção "Leitura obrigatória".

---

Você vai implementar a feature **"Editar e arquivar aluno no menu '...' do mobile"**. Essa feature tem paridade funcional com o menu "..." do web, mas diverge dele em dois pontos intencionais (documentados abaixo). A execução é dividida em **2 fases sequenciais**.

## Leitura obrigatória (antes de escrever qualquer código)

Leia, nesta ordem, os três documentos a seguir **por inteiro**:

1. **Spec:** `mobile/specs/active/editar-arquivar-aluno-mobile.md` — explica o objetivo, as duas divergências conscientes em relação ao web, escopo incluso/excluído, fluxos de usuário, arquivos afetados, critérios de aceite por fase, restrições, edge cases e testes requeridos.
2. **Prompt da Fase 1:** `mobile/specs/active/prompt-claude-code-fase-1-edge-functions-editar-arquivar-aluno.md` — cobre a criação e deploy de duas Edge Functions Supabase (`update-student` e `archive-student`) + smoke tests via curl.
3. **Prompt da Fase 2:** `mobile/specs/active/prompt-claude-code-fase-2-mobile-editar-arquivar-aluno.md` — cobre os hooks, o `EditStudentModal`, a integração no menu "..." da tela de detalhe do aluno, e a propagação do tratamento de `FunctionsHttpError`.

**Depois de ler, resuma em 5 bullets**: (i) as duas divergências conscientes do web; (ii) os arquivos que vão ser criados; (iii) os arquivos que vão ser modificados; (iv) o que está explicitamente fora de escopo; (v) a ordem de execução. Se não conseguir responder esses 5 bullets com clareza, **releia a spec**.

## Contexto crítico (não pule)

- **Projeto Supabase de produção:** `lylksbtgrihzepbteest`. Toda Edge Function vive nesse projeto.
- **Duas divergências em relação ao web, ambas intencionais**:
  1. **Mobile faz soft delete** (`status = 'archived'`), o web faz hard delete com cascata. Motivo: toque acidental num phone é mais caro que no desktop. A coluna `students.status` já existe — veja `supabase/functions/create-student/index.ts`, que já popula `status: "active"`.
  2. **Mobile sincroniza `auth.users.email` com `students.email` via admin API** quando o email muda. O web hoje só atualiza `students.email` client-side, deixando `auth.users.email` desatualizado (bug silencioso). Mobile resolve isso na Edge Function `update-student` via `adminClient.auth.admin.updateUserById(id, { email, email_confirm: true })`.
- **Padrão de erro obrigatório em todos os hooks que chamam Edge Function:** extrair body JSON via `FunctionsHttpError.context.json()`. Já aplicado em `useResetStudentPassword.ts`. Propagar em `useCreateStudent.ts`, `useUpdateStudent.ts` (novo) e `useArchiveStudent.ts` (novo).
- **Arquivo da tela de detalhe do aluno:** `mobile/app/student/[id]/index.tsx`. Foi movido de `[id].tsx` pra dentro da pasta numa sessão anterior por conflito de rota — imports relativos usam `../../../`.

## Ordem de execução

Execute na ordem exata. **Não sobreponha fases.**

### Passo 1 — Rodar a Fase 1 (Edge Functions)

Siga por inteiro o prompt em `mobile/specs/active/prompt-claude-code-fase-1-edge-functions-editar-arquivar-aluno.md`. Isso inclui:

1. Ler `supabase/functions/create-student/index.ts` e `supabase/functions/reset-student-password/index.ts` como padrão.
2. Criar `supabase/functions/update-student/index.ts`.
3. Criar `supabase/functions/archive-student/index.ts`.
4. Deployar ambas em `lylksbtgrihzepbteest` via MCP Supabase (`mcp__5dd45980-...__deploy_edge_function`).
5. Rodar smoke tests (curl) cobrindo: sem Bearer → 401, ownership mismatch → 403, email inválido → 400, email duplicado → 400, idempotência do archive.
6. **Restaurar qualquer aluno real que tenha sido modificado durante os smokes** (renomeações de teste, status voltando pra `'active'`). Não deixe aluno em estado de teste em produção.

**Checkpoint antes de continuar:** confirme via `mcp__5dd45980-...__list_edge_functions` que `update-student` e `archive-student` aparecem como `ACTIVE`. Se alguma falhou, **pare, diagnostique, corrija**. Não avance pra Fase 2 com as Edge Functions quebradas.

### Passo 2 — Rodar a Fase 2 (Mobile UI)

Siga por inteiro o prompt em `mobile/specs/active/prompt-claude-code-fase-2-mobile-editar-arquivar-aluno.md`. Isso inclui:

1. Ler `mobile/hooks/useCreateStudent.ts`, `mobile/hooks/useResetStudentPassword.ts`, `mobile/components/trainer/students/AddStudentModal.tsx`, `mobile/app/student/[id]/index.tsx` e `mobile/CLAUDE.md` (se existir).
2. Criar `mobile/hooks/useUpdateStudent.ts` e `mobile/hooks/useArchiveStudent.ts`.
3. Propagar o padrão de `FunctionsHttpError.context.json()` em `mobile/hooks/useCreateStudent.ts`.
4. Criar `mobile/components/trainer/student/EditStudentModal.tsx` espelhando o visual de `AddStudentModal`.
5. Atualizar `mobile/app/student/[id]/index.tsx`: menu "..." com 3 opções (Editar aluno, Gerar nova senha, Arquivar), handlers `handleEditStudent` + `handleArchiveStudent`, render do `EditStudentModal`.
6. Localizar o hook de lista de alunos (provável `mobile/hooks/useStudentsList.ts` ou equivalente) e adicionar filtro `.neq('status', 'archived')`.
7. Adicionar testes Vitest cobrindo os hooks novos e a propagação do padrão de erro.
8. `cd mobile && npx tsc --noEmit` limpo, `cd mobile && npx vitest run` verde.

**Checkpoint final:** revise o diff inteiro. Confirme que não tocou em `web/`, `shared/`, nem em Edge Functions (que é trabalho da Fase 1, já concluído no Passo 1).

## Regras e restrições

- **Não combine as fases.** Rode Fase 1, valide em prod, **só então** rode Fase 2. Se você misturar, fica impossível diagnosticar problemas.
- **Não crie PR, branch ou commit.** As Edge Functions vão pra produção via MCP; as mudanças do mobile ficam locais pro dev revisar e testar em device.
- **Não faça migration de DB.** A coluna `status` já existe.
- **Não adicione colunas de auditoria** (`archived_at`, `archived_by`, etc.) — fora de escopo.
- **Não siga o web em hard delete.** Soft delete é intencional.
- **Não mande email de verificação** ao aluno no edit — use `email_confirm: true` no admin API.
- **Não duplique lógica de auth/CORS** nas Edge Functions — siga exatamente o padrão de `create-student`.
- **Não quebre o que já funciona.** "Gerar nova senha" não pode regredir.
- **pt-BR hardcoded** em toda label visível. Sentence case em labels do menu.
- **Sem `any`.** Use tipos do `@kinevo/shared` quando aplicável (ex: `Student`).
- **Haptics obrigatórios** nos pontos-chave (menu aberto, modal aberto, salvar sucesso, erro, Alert destrutivo) — detalhes no prompt da Fase 2.

## O que entregar no final

Ao terminar as duas fases, produza um resumo curto em bullets com:

1. **Fase 1 — Edge Functions:**
   - Confirmação de que `update-student` e `archive-student` estão `ACTIVE` em `lylksbtgrihzepbteest`.
   - Resultado de cada smoke test (status HTTP observado).
   - Decisões não-óbvias que você tomou (ex: como achou o `auth_user_id` do student — FK direto em `students.user_id` ou outra via).
   - Confirmação de que nenhum aluno real ficou em estado de teste.
2. **Fase 2 — Mobile:**
   - Arquivos criados e modificados (lista exata).
   - Como você localizou e filtrou a lista de alunos (nome exato do hook, como filtrou arquivados).
   - Padrão de cache usado (React Query com `invalidateQueries` vs Zustand store manual — depende do projeto).
   - Status de `tsc --noEmit` e `vitest run`.
   - Quaisquer desvios dos prompts e justificativa.

**Se em qualquer momento você se pegar pensando "acho que não preciso dessa validação" ou "o prompt exagera, vou simplificar":** pare, releia a spec e os dois prompts faseados. As regras existem porque refletem decisões já discutidas e aceitas pelo dev. Não as rediscuta sozinho.

Boa execução.
