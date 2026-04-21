# Editar e excluir aluno no menu "..." do mobile

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto

O menu "..." (MoreVertical) na tela de detalhe do aluno no mobile (`mobile/app/student/[id]/index.tsx`) hoje tem apenas uma opção: **"Gerar nova senha"**. No web, o mesmo menu tem duas opções: **"Gerar nova senha"** e **"Excluir aluno"**. Além disso, o web expõe **"Editar aluno"** como botão primário no header da tela de detalhe.

Essa spec cobre a paridade do menu "..." e adiciona edição de aluno, com duas divergências conscientes em relação ao web:

1. **Delete vira archive (soft delete) no mobile.** O web faz hard delete com cascata (remove `students` + cascata FK em `assigned_programs`, `workout_sessions`, `messages`). Mobile é mais propenso a toque acidental; perder histórico de meses por um toque errado é inaceitável. Mobile vai fazer soft delete via `status = 'archived'` (coluna já existe na tabela `students` — ver `create-student/index.ts:107` que já popula `status: "active"`).
2. **Edit de email sincroniza `students.email` com `auth.users.email`.** O web hoje tem um bug silencioso: o `StudentModal` atualiza só `students.email` via client-side, deixando `auth.users.email` antigo — o aluno continua logando com o email antigo. Mobile vai fazer a coisa certa via Edge Function com admin API.

Essas divergências são **intencionais** e devem ser documentadas nos comentários do código e nas notas de implementação. O débito do web (hard delete sem server action, email dessincronizado) fica registrado pra eventual alinhamento futuro.

## Objetivo

Ter paridade funcional com o menu "..." do web, mas implementando corretamente as duas operações que no web têm problemas (hard delete agressivo; email dessincronizado).

Ações finais no menu "..." do mobile:
1. **Editar aluno** — abre modal de edição com `name`, `email`, `phone`, `modality`.
2. **Gerar nova senha** — já existe, sem mudança.
3. **Arquivar aluno** (label: "Arquivar") — soft delete reversível via status.

## Estratégia de execução — 2 fases

| Fase | Escopo | Dependências |
|------|--------|--------------|
| **Fase 1 — Edge Functions** | Criar `update-student` e `archive-student`. Deploy em produção. Smoke tests. | Nenhuma. |
| **Fase 2 — Mobile UI** | Hooks, `EditStudentModal`, Alert de archive, integração no menu "...", tratamento `FunctionsHttpError` consistente. | Fase 1 deployada. |

## Escopo

### Incluído

**Supabase (Edge Functions):**
- `supabase/functions/update-student/index.ts` — nova Edge Function.
  - Body: `{ studentId, name?, email?, phone?, modality? }`.
  - Auth: Bearer JWT; verifica que o trainer é dono do student (`students.coach_id === trainer.id`).
  - Valida: nome não vazio se enviado; email formato válido se enviado; modality ∈ `{'online', 'presential'}` se enviado.
  - Se `email` muda:
    - Atualiza `auth.users.email` via `adminClient.auth.admin.updateUserById(authUserId, { email })` com `email_confirm: true` pra não mandar email de verificação.
    - Atualiza `students.email` na mesma transação lógica.
    - Se `auth.admin.updateUserById` falha (ex: email já em uso), retorna 400 com mensagem útil **sem** ter tocado em `students`.
  - Atualiza `students` com os campos passados (nome/phone/modality sempre que presentes, email quando mudou).
  - Retorna `{ success: true, student: { id, name, email, phone, modality, status } }`.
  - Segue padrão de CORS, auth e error handling do `create-student`.

- `supabase/functions/archive-student/index.ts` — nova Edge Function.
  - Body: `{ studentId }`.
  - Auth: Bearer JWT; verifica ownership.
  - Atualiza `students.status = 'archived'`. **Não toca em `auth.users`**, não toca em programas, mensagens ou sessões.
  - Retorna `{ success: true, studentId }`.
  - Idempotente: arquivar um aluno já arquivado retorna sucesso sem erro.

**Mobile:**
- `mobile/hooks/useUpdateStudent.ts` — hook que invoca `update-student`. Trata `FunctionsHttpError` extraindo body JSON (padrão definido na Fase 3 da unificação de prescrição).
- `mobile/hooks/useArchiveStudent.ts` — hook que invoca `archive-student`.
- `mobile/components/trainer/student/EditStudentModal.tsx` — modal de edição com os 4 campos. Visual consistente com `AddStudentModal` (mesmo padrão de Modal + card branco + bordas 20px).
- `mobile/app/student/[id]/index.tsx`:
  - Adicionar opções **"Editar aluno"** e **"Arquivar"** ao ActionSheet/Alert já existente.
  - Ao tocar "Editar aluno": abre `EditStudentModal` com warning antes: "Deseja editar os dados de \<nome\>?" → modal com campos preenchidos.
    - Se usuário mudar o email, o modal mostra um warning inline: "Ao alterar o email, o aluno precisará fazer login novamente com o novo endereço."
  - Ao tocar "Arquivar": Alert destrutivo: título "Arquivar \<nome\>?", mensagem "O aluno sairá da sua lista e não poderá acessar mais treinos. Você pode restaurar depois em Configurações.", botões "Cancelar" e "Arquivar" (destrutivo).
  - Após archive bem-sucedido: navegar de volta pra lista de alunos (`router.back()` ou `router.replace('/students')`).
- Tratamento de `FunctionsHttpError` aplicado também em `useCreateStudent.ts` e `useResetStudentPassword.ts` (propagar o padrão).
- Atualizar filtro da lista de alunos pra esconder arquivados: `mobile/hooks/useStudentsList.ts` (ou equivalente — localizar) deve filtrar `status !== 'archived'` no select.

### Excluído

- **Restauração de aluno arquivado**: a mensagem do Alert menciona "restaurar em Configurações", mas a tela de configurações não faz parte desta spec. Arquiva-se sem restore no V1. Criar incremento separado depois.
- **Changelog/audit log** de edições (quem editou, quando): não é pedido. Não cria.
- **Soft delete no web**: fora de escopo. A divergência fica documentada.
- **Email verification flow** no edit: usamos `email_confirm: true` no admin API. Não manda email de verificação ao aluno. Se no futuro for desejável mandar, é incremento separado.
- **Mudar senha via edit**: senha continua sendo operação separada via "Gerar nova senha".
- **Editar ou arquivar do próprio trainer (self-edit)**: bloqueado. A Edge Function verifica que `student.coach_id === trainer.id` e isso já impede (trainer não é student dele mesmo).

## Arquivos Afetados

### Supabase — criar
- `supabase/functions/update-student/index.ts` (Fase 1)
- `supabase/functions/archive-student/index.ts` (Fase 1)

### Mobile — criar
- `mobile/hooks/useUpdateStudent.ts` (Fase 2)
- `mobile/hooks/useArchiveStudent.ts` (Fase 2)
- `mobile/components/trainer/student/EditStudentModal.tsx` (Fase 2)

### Mobile — editar
- `mobile/app/student/[id]/index.tsx` (Fase 2):
  - Adicionar opções ao ActionSheet/Alert.
  - Adicionar handlers `handleEditStudent` e `handleArchiveStudent`.
  - Renderizar `EditStudentModal`.
  - Propagar update do aluno via invalidação de query (depende do padrão de cache usado — React Query? Zustand? — confirmar ao implementar).
- `mobile/hooks/useCreateStudent.ts` (Fase 2): adicionar tratamento de `FunctionsHttpError` com extração de body JSON.
- `mobile/hooks/useResetStudentPassword.ts` (Fase 2): confirmar que já tem o tratamento adequado (aplicado na sessão anterior); se não, propagar.
- `mobile/hooks/useStudentsList.ts` ou equivalente (Fase 2): filtrar `status !== 'archived'` na listagem default.

## Comportamento Esperado

### Fluxo de usuário — editar aluno

1. Treinador abre a tela de detalhe do aluno.
2. Toca no "..." no canto superior direito.
3. ActionSheet/Alert aparece com opções: **"Editar aluno"**, **"Gerar nova senha"**, **"Arquivar"**, "Cancelar".
4. Toca em "Editar aluno".
5. **Warning modal** aparece: "Deseja editar os dados de \<nome\>?" — botões "Cancelar" e "Editar".
6. Ao confirmar, `EditStudentModal` abre com campos preenchidos (`name`, `email`, `phone`, `modality`).
7. Treinador edita os campos.
8. Se mudar o email, aparece warning inline abaixo do campo: "Ao alterar o email, o aluno precisará fazer login novamente com o novo endereço."
9. Toca "Salvar". Loading state.
10. Sucesso: modal fecha, toast "Aluno atualizado", tela de detalhe reflete os novos dados.
11. Erro (ex: email já em uso): modal permanece aberto, mostra mensagem de erro inline, treinador pode ajustar e tentar de novo.

### Fluxo de usuário — arquivar aluno

1. Treinador abre a tela de detalhe do aluno.
2. Toca no "..." no canto superior direito.
3. Toca em "Arquivar".
4. `Alert.alert` aparece:
   - Título: "Arquivar \<nome\>?"
   - Mensagem: "O aluno sairá da sua lista e não poderá acessar mais treinos. Você pode restaurar depois em Configurações."
   - Botões: "Cancelar" (cancel style) e "Arquivar" (destructive style).
5. Ao confirmar, loading implícito (Alert já fechou).
6. Sucesso: toast "Aluno arquivado", navega de volta pra lista de alunos que agora não mostra o aluno arquivado.
7. Erro: toast de erro, treinador permanece na tela de detalhe.

### Fluxo técnico — update-student

1. Hook `useUpdateStudent.mutate({ studentId, fields })` chama `supabase.functions.invoke("update-student", { body: {...} })`.
2. Edge Function:
   - Valida auth + ownership (igual `create-student`).
   - Valida campos enviados.
   - Se `email` presente e diferente do atual:
     - Chama `adminClient.auth.admin.updateUserById(authUserId, { email, email_confirm: true })`.
     - Se der erro (ex: "User with this email already exists"), retorna 400 `{ success: false, error: "Email já está em uso" }`.
   - Atualiza `students` com os campos.
   - Retorna `{ success: true, student }`.
3. Hook recebe, atualiza cache local (invalidation), chama callback de sucesso.

### Fluxo técnico — archive-student

1. Hook `useArchiveStudent.mutate({ studentId })` chama `supabase.functions.invoke("archive-student", { body: {...} })`.
2. Edge Function:
   - Valida auth + ownership.
   - `adminClient.from("students").update({ status: "archived" }).eq("id", studentId).eq("coach_id", trainer.id)`.
   - Retorna `{ success: true, studentId }`.
3. Hook recebe, invalida cache da lista de alunos, chama callback.

## Critérios de Aceite

### Fase 1 — Edge Functions
- [ ] `update-student` deployada em produção (`lylksbtgrihzepbteest`).
- [ ] `archive-student` deployada em produção.
- [ ] Smoke test `update-student`: `curl` sem Bearer → 401; com Bearer inválido → 401.
- [ ] Smoke test `archive-student`: `curl` sem Bearer → 401.
- [ ] Integration test manual via SQL: trainer A tenta arquivar aluno de trainer B → 403 (ownership check).
- [ ] `update-student` com email duplicado retorna 400 com mensagem útil (não 500).
- [ ] `archive-student` em aluno já arquivado retorna 200 (idempotente).

### Fase 2 — Mobile
- [ ] Menu "..." mostra 3 opções funcionais: "Editar aluno", "Gerar nova senha", "Arquivar".
- [ ] "Editar aluno" dispara warning + modal com campos preenchidos.
- [ ] Editar nome/phone/modality e salvar: tela reflete os novos dados sem reload.
- [ ] Editar email válido: aluno consegue fazer login novamente com o novo email (validar manualmente em dev).
- [ ] Editar para email já em uso: mensagem inline clara, modal permanece aberto.
- [ ] "Arquivar": Alert destrutivo, confirmação navega de volta, aluno some da lista.
- [ ] Aluno arquivado não aparece na lista de alunos default.
- [ ] `useCreateStudent` e `useResetStudentPassword` tratam `FunctionsHttpError` extraindo body JSON (mensagem útil em vez de "Edge Function returned a non-2xx status code").
- [ ] `cd mobile && npx tsc --noEmit` sem novos erros vs baseline.
- [ ] `cd mobile && npx vitest run` verde.
- [ ] Nenhuma regressão em "Gerar nova senha".

## Restrições Técnicas

- Seguir `mobile/CLAUDE.md`: NativeWind, Reanimated, Lucide, Haptics, SafeArea, sentence case, pt-BR hardcoded.
- Não usar `any`; usar tipos de `@kinevo/shared` quando aplicável.
- Edge Functions seguem o padrão de `create-student` (CORS, auth, error shape).
- `EditStudentModal` segue o visual de `AddStudentModal` (verificar e replicar — Modal RN com `animationType="fade"`, card branco, bordas 20px, botões roxos, Lucide icons).
- Haptics: `Medium` ao abrir menu, `Light` ao abrir modal, `Success` no salvar bem-sucedido, `Error` em falha, `Warning` no Alert destrutivo.
- **Sem migration de DB**. A coluna `students.status` já existe e já é usada (`create-student` insere com `"active"`).
- **Backward compat das Edge Functions**: novas functions, nenhum consumidor existente pode quebrar porque não existem consumidores ainda.
- **Auditoria**: nenhum campo de audit adicionado (`archived_at`, `archived_by`). Se for necessário no futuro, é incremento. Não adicionar coluna nova agora.
- **Cascata de arquivar**: arquivar o aluno **NÃO** arquiva programas, sessões ou mensagens. Esses dados permanecem tal qual — apenas o aluno some da listagem. Programas ativos do aluno arquivado ficam "órfãos da listagem" mas acessíveis se alguém tiver a URL direta. Documentar como comportamento esperado.

## Edge Cases

- **Email sem mudança no edit**: se `email` é igual ao atual, **não** chamar `auth.admin.updateUserById` (evita operação desnecessária). Checar no handler da Edge Function.
- **Phone com máscara**: mobile envia phone com ou sem máscara? Edge Function normaliza pra dígitos só (como `create-student` já faz com `.trim()`). Se a UI mobile usa máscara, remover antes de enviar.
- **Modality inválida**: Edge Function rejeita com 400 "Modalidade inválida". UI mobile já usa select/radio — não deve acontecer, mas validação server-side existe como defesa.
- **Aluno arquivado e depois re-adicionado**: se o treinador cria um novo aluno com email igual ao de um aluno arquivado, `create-student` vai falhar porque o `auth.users` ainda existe com esse email. Documentar: por ora, fora de escopo. Se acontecer, o treinador precisa "gerar nova senha" no arquivado ou o aluno arquivado precisa ser hard-deletado via dashboard Supabase. Incremento futuro: `create-student` detectar email de aluno arquivado do mesmo trainer e oferecer "restaurar".
- **Concorrência**: dois devices do mesmo trainer tentam editar o mesmo aluno simultaneamente. O último write vence. Aceitável.
- **Sessão expirada durante edit**: hook retorna erro 401, modal mostra mensagem "Sessão expirada. Faça login novamente.", não fecha o modal automaticamente (usuário pode copiar dados que ele já digitou antes de sair).
- **Aluno arquivado tenta fazer login**: login continua funcionando no nível `auth.users`, mas ele não vai aparecer na lista do trainer. A tela do aluno do app é separada — tratar "aluno arquivado não pode logar" fica fora de escopo desta spec (é comportamento do app do aluno, não do trainer).

## Testes Requeridos

### Edge Functions (smoke tests manuais)
- [ ] `update-student` sem Bearer → 401.
- [ ] `update-student` com Bearer de trainer X tentando editar aluno de trainer Y → 403.
- [ ] `update-student` com email inválido → 400.
- [ ] `update-student` com email duplicado (já existe em `auth.users`) → 400 mensagem útil.
- [ ] `update-student` com email novo válido → 200, login do aluno funciona com novo email.
- [ ] `update-student` sem mudar email → não chama admin API (verificar logs).
- [ ] `archive-student` sem Bearer → 401.
- [ ] `archive-student` ownership mismatch → 403.
- [ ] `archive-student` idempotente → 200 mesmo em aluno já arquivado.

### Mobile (unitários — Vitest)
- [ ] `useUpdateStudent` — sucesso retorna student atualizado.
- [ ] `useUpdateStudent` — erro 400 com body JSON extrai mensagem do backend.
- [ ] `useUpdateStudent` — erro genérico sem body JSON cai em mensagem default.
- [ ] `useArchiveStudent` — sucesso retorna studentId.
- [ ] `useArchiveStudent` — erro 403 extrai mensagem do body.
- [ ] `useCreateStudent` — FunctionsHttpError extraído corretamente (não mais "non-2xx status").
- [ ] `useStudentsList` (ou equivalente) — filtra `status === 'archived'` por default.

### Manual (iOS + Android)
- [ ] Editar nome → reflete na tela.
- [ ] Editar phone → reflete.
- [ ] Editar modality (online ↔ presential) → reflete.
- [ ] Editar email → aluno consegue logar com novo email. Antigo não funciona.
- [ ] Editar email duplicado → mensagem clara.
- [ ] Arquivar → aluno some da lista, navega de volta.
- [ ] Arquivar idempotente (se conseguir reproduzir duplo-toque) → sem erro.

## Referências

- Web — `deleteStudent` hard delete: `web/src/actions/student-actions.ts`
- Web — `StudentModal` edit client-side: `web/src/components/students/StudentModal.tsx`
- Web — menu "...": `web/src/components/students/student-header.tsx`
- Mobile — `create-student` Edge Function (padrão): `supabase/functions/create-student/index.ts`
- Mobile — `reset-student-password` Edge Function (padrão): `supabase/functions/reset-student-password/index.ts`
- Mobile — `useCreateStudent` hook: `mobile/hooks/useCreateStudent.ts`
- Mobile — `useResetStudentPassword` hook: `mobile/hooks/useResetStudentPassword.ts`
- Mobile — `AddStudentModal` (visual ref): `mobile/components/trainer/students/AddStudentModal.tsx`
- Mobile — `ResetPasswordModal` (visual ref): `mobile/components/trainer/student/ResetPasswordModal.tsx`
- Mobile — tela de detalhe: `mobile/app/student/[id]/index.tsx`

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação.)
