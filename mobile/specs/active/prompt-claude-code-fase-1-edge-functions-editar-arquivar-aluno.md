# Prompt — Fase 1: Edge Functions (update-student + archive-student)

> Copie e cole o bloco abaixo em uma sessão nova do Claude Code, a partir da raiz do monorepo `kinevo`.

---

Essa é a **Fase 1 de 2** da feature "Editar e arquivar aluno no menu '...' do mobile". Aqui você cria e deploya duas Edge Functions novas (`update-student` e `archive-student`). Sem UI nessa fase.

## Spec

Leia por inteiro antes de começar: `mobile/specs/active/editar-arquivar-aluno-mobile.md`. Essa fase corresponde à linha **"Fase 1 — Edge Functions"** da tabela "Estratégia de execução" e aos critérios sob **"Fase 1 — Edge Functions"** em "Critérios de Aceite".

## Contexto crítico

1. **As duas divergências do web estão documentadas na spec (seção "Contexto", itens 1 e 2).** Leia. Em resumo:
   - Mobile faz **soft delete** (`status = 'archived'`), não hard delete como o web. A coluna `students.status` já existe (ver `supabase/functions/create-student/index.ts` — busque pelo insert que popula `status: "active"`).
   - Mobile **sincroniza `auth.users.email`** quando o email muda, via admin API. O web hoje só atualiza `students.email` (bug silencioso — aluno continua logando com email antigo).

2. **Essas duas Edge Functions ainda não existem**. Você vai criar do zero seguindo o padrão de `supabase/functions/create-student/index.ts`.

3. **Projeto Supabase de produção: `lylksbtgrihzepbteest`**. Todas as funções vivem lá.

## Prerequisitos

- MCP do Supabase disponível (`mcp__5dd45980-...__deploy_edge_function`, `mcp__5dd45980-...__list_edge_functions`, etc.).
- Nenhuma dependência de código de outras fases — essa é a primeira fase.

## Trabalho

### 1. Estudar o padrão existente

Antes de escrever qualquer função nova, leia **inteiros**:
- `supabase/functions/create-student/index.ts` — padrão de CORS, auth Bearer, ownership check, admin API para `auth.users`, shape de erro.
- `supabase/functions/reset-student-password/index.ts` — segundo exemplo do mesmo padrão (mais enxuto que `create-student`).

Confirme que entendeu:
- Como o Bearer JWT é parseado.
- Como o `trainer_id` é derivado do JWT.
- Como o ownership do student é verificado (`students.coach_id === trainer.id`).
- O shape dos erros (`{ success: false, error: "mensagem em pt-BR" }` com status HTTP apropriado).
- Que a env var `SUPABASE_SERVICE_ROLE_KEY` já existe em produção (não precisa configurar).

### 2. Criar `supabase/functions/update-student/index.ts`

**Contrato:**

- **Método:** `POST`.
- **Auth:** Bearer JWT (igual `create-student`).
- **Body (JSON):**
  ```ts
  {
    studentId: string;        // uuid, obrigatório
    name?: string;            // opcional, não pode ser vazio se enviado
    email?: string;           // opcional, formato de email válido se enviado
    phone?: string;           // opcional, aceita qualquer formato; normalize pra dígitos
    modality?: 'online' | 'presential'; // opcional
  }
  ```
- **Response 200:**
  ```json
  { "success": true, "student": { "id": "...", "name": "...", "email": "...", "phone": "...", "modality": "...", "status": "..." } }
  ```
- **Response 400:** validação (campos inválidos, email duplicado no auth).
- **Response 401:** sem Bearer ou Bearer inválido.
- **Response 403:** ownership mismatch (trainer não é dono do student).
- **Response 404:** `studentId` não existe.
- **Response 500:** erro inesperado.

**Fluxo:**

1. CORS preflight (igual `create-student`).
2. Parse Bearer, resolve trainer via `supabase.auth.getUser()`, busca `trainer.id` em `trainers` via `user_id`. Se não encontrar, 401.
3. Parse do body. Se faltar `studentId`, 400 "ID do aluno é obrigatório".
4. Busca o student atual: `adminClient.from('students').select('*').eq('id', studentId).single()`. Se não existir, 404. Se `student.coach_id !== trainer.id`, 403.
5. **Validações de campos** (só valida os que estão presentes):
   - `name`: se enviado, `.trim()` e não pode ser vazio → 400 "Nome inválido".
   - `email`: se enviado, regex básica ou validação equivalente → 400 "Email inválido".
   - `modality`: se enviado, ∈ `{'online','presential'}` → 400 "Modalidade inválida".
   - `phone`: se enviado, `.replace(/\D/g, '')` pra normalizar pra dígitos só.
6. **Se `email` está presente e diferente do `student.email` atual:**
   - Precisa do `auth_user_id` do aluno. `create-student` usa a coluna `user_id` em `students` (confirmar nome exato no schema — se for `user_id`, use; se for outro, use o que existir). Se essa coluna não existir em `students`, ache o link via `auth.admin.getUserByEmail(oldEmail)` como fallback, mas prefere o FK direto.
   - `adminClient.auth.admin.updateUserById(authUserId, { email: novoEmail, email_confirm: true })`.
     - `email_confirm: true` garante que **não** manda email de verificação.
   - Se essa chamada retornar erro:
     - Se a mensagem indica email duplicado (`"already been registered"`, `"already in use"`, similar — olhar a string exata no retorno do Supabase), retorna 400 `{ success: false, error: "Email já está em uso" }`.
     - Outros erros: 500 com a mensagem do Supabase.
   - **Importante:** só atualize `students` DEPOIS que `auth.users` já foi atualizado com sucesso. Se a primeira falha, não toca em `students`.
7. **Atualizar `students`** com os campos enviados:
   - Monte um objeto `updates = {}` e adicione só as chaves presentes (`name`, `email`, `phone`, `modality`).
   - `adminClient.from('students').update(updates).eq('id', studentId).eq('coach_id', trainer.id).select('*').single()`.
   - O `.eq('coach_id', trainer.id)` é defense-in-depth (já validamos ownership no passo 4).
8. Retorna `{ success: true, student: { id, name, email, phone, modality, status } }`.

**Erros comuns a tratar explicitamente:**
- Email duplicado no `auth.users` → 400 "Email já está em uso".
- Student não pertence ao trainer → 403 "Aluno não encontrado ou sem permissão".
- Body malformado → 400 "Requisição inválida".

### 3. Criar `supabase/functions/archive-student/index.ts`

**Contrato:**

- **Método:** `POST`.
- **Auth:** Bearer JWT.
- **Body (JSON):** `{ studentId: string }`.
- **Response 200:** `{ "success": true, "studentId": "..." }`.
- **Response 401, 403, 404, 500:** igual `update-student`.

**Fluxo:**

1. CORS, auth, resolve trainer.
2. Parse body. `studentId` obrigatório.
3. Busca student. Se não existir, 404. Se `coach_id !== trainer.id`, 403.
4. `adminClient.from('students').update({ status: 'archived' }).eq('id', studentId).eq('coach_id', trainer.id)`.
   - **Não** toca em `auth.users`.
   - **Não** toca em `assigned_programs`, `workout_sessions`, `messages`.
5. Retorna `{ success: true, studentId }`.
6. **Idempotente**: se o student já está com `status = 'archived'`, retorna 200 mesmo assim — não dá erro.

### 4. Deploy em produção

Use o MCP do Supabase (`mcp__5dd45980-...__deploy_edge_function`). Projeto: `lylksbtgrihzepbteest`.

Deploy `update-student` e `archive-student`. Confirme via `mcp__5dd45980-...__list_edge_functions` que ambas aparecem como `ACTIVE`.

### 5. Smoke tests manuais

Rode `curl` contra as URLs de produção. Você vai precisar de um Bearer JWT válido de um trainer real (pegue do log do mobile em dev, ou do Supabase dashboard → Auth → copy session) e do ID de um aluno real desse trainer.

**update-student:**
```bash
# 1. Sem Bearer → 401
curl -X POST https://lylksbtgrihzepbteest.supabase.co/functions/v1/update-student \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<uuid>"}'

# 2. Bearer válido + mudança de nome → 200
curl -X POST https://lylksbtgrihzepbteest.supabase.co/functions/v1/update-student \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<uuid>","name":"Novo nome teste"}'

# 3. Bearer válido + email inválido → 400
curl -X POST https://lylksbtgrihzepbteest.supabase.co/functions/v1/update-student \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<uuid>","email":"notanemail"}'

# 4. Bearer válido + email duplicado (use o email de OUTRO aluno seu) → 400 "Email já está em uso"
curl -X POST https://lylksbtgrihzepbteest.supabase.co/functions/v1/update-student \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<uuid>","email":"<email-de-outro-aluno-seu>"}'
```

**archive-student:**
```bash
# 1. Sem Bearer → 401
curl -X POST https://lylksbtgrihzepbteest.supabase.co/functions/v1/archive-student \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<uuid>"}'

# 2. Bearer válido → 200
curl -X POST https://lylksbtgrihzepbteest.supabase.co/functions/v1/archive-student \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<uuid>"}'

# 3. Idempotência (chamar de novo) → 200
curl -X POST https://lylksbtgrihzepbteest.supabase.co/functions/v1/archive-student \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<uuid>"}'
```

Confirme via SQL (ou via dashboard) que o `status` virou `'archived'`:
```sql
select id, name, status from students where id = '<uuid>';
```

**Restaure o student de volta pra `status = 'active'` após os testes** pra não deixar aluno real arquivado em prod:
```sql
update students set status = 'active' where id = '<uuid>';
```

### 6. Verificação final

- Ambas as funções aparecem em `list_edge_functions` como `ACTIVE`.
- Todos os smokes passaram conforme esperado.
- Nenhum aluno real ficou em estado inconsistente (nome mudado de teste restaurado, status restaurado).
- Logs das functions (`mcp__5dd45980-...__get_logs` com `service: edge-function`) não têm erros não-tratados.

## Restrições

- **Não toque em nenhum arquivo do `mobile/` nem do `web/`.** Só `supabase/functions/`.
- **Não crie migration de DB.** A coluna `students.status` já existe.
- **Não adicione colunas de auditoria** (`archived_at`, `archived_by`, `updated_by`). Fora de escopo.
- **Não deploye nada além dessas duas funções.** Se precisar criar helpers compartilhados, coloque em `supabase/functions/_shared/` só se o padrão do repo já usar isso (`create-student` não usa — provavelmente não precisa).
- **Não mude `create-student` nem `reset-student-password`**. Eles são referência, não alvo.
- **Não siga o padrão do web de hard delete**. Soft delete é intencional — ver spec.
- **Não envie email de verificação ao aluno no edit**. Use `email_confirm: true`.
- **Não logue o Bearer nem o email em logs de nível info**. OK logar `trainer_id` e `studentId`.

## Entregáveis finais

1. `supabase/functions/update-student/index.ts` criado e deployado.
2. `supabase/functions/archive-student/index.ts` criado e deployado.
3. Smoke tests rodados e documentados no resumo final.
4. Resumo em bullets com:
   - Comandos/calls exatos que você rodou para deploy.
   - Resultado de cada smoke test (status HTTP observado).
   - Quaisquer decisões não-óbvias (ex: como você achou o `auth_user_id` do student — pelo FK `user_id` ou outra via).
   - Confirmação de que nenhum aluno real ficou em estado de teste.

Quando terminar, **não crie PR, commit ou branch** — as funções já estão em produção, isso é suficiente. Deixe qualquer arquivo local (que o próprio MCP pode ter gerado como cache) para o dev revisar manualmente se quiser.
