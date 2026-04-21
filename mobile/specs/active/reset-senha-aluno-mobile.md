# Reset de Senha do Aluno no App Mobile do Treinador

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto

Hoje o treinador consegue resetar (gerar uma nova) senha de um aluno apenas pelo sistema web (`web/src/app/students/[id]` → menu de três pontos no header → "Gerar Nova Senha"). No app mobile do treinador a funcionalidade não existe, o que força o treinador a abrir o navegador toda vez que um aluno perde a senha.

A implementação web está em `web/src/app/students/[id]/actions/reset-student-password.ts` (Server Action) e na UI em `web/src/components/students/student-header.tsx`. Usa `supabase.auth.admin.updateUserById` com o Service Role Key, então **o mobile não pode chamar isso diretamente** — o cliente mobile só tem a anon key. A operação privilegiada precisa ser encapsulada em uma Edge Function do Supabase, seguindo o mesmo padrão já usado por `supabase/functions/create-student/index.ts` (a Edge Function equivalente do fluxo de criação de aluno).

## Objetivo

Permitir que o treinador, no app mobile, gere uma nova senha para qualquer aluno que ele gerencia, com o mesmo comportamento e garantias de segurança do fluxo web (verificação de identidade, verificação de propriedade `coach_id`, senha aleatória segura, e retorno da senha em texto claro uma única vez para o treinador copiar e compartilhar).

## Escopo

### Incluído
- Criação de uma Edge Function Supabase `reset-student-password` que replica a lógica da Server Action web.
- Novo hook `useResetStudentPassword` no mobile.
- Novo componente `ResetPasswordModal` (confirmação + tela de sucesso com senha visível + ações de copiar / compartilhar no WhatsApp).
- Integração na tela `app/student/[id].tsx` via um menu de três pontos (⋯) no header, seguindo o padrão do web.
- Copy para clipboard (`expo-clipboard`) com a mesma mensagem formatada do web.
- Abertura do WhatsApp (`Linking.openURL('whatsapp://send?...')`) quando o aluno tem telefone cadastrado, com fallback para só copiar.
- Feedback via `toast` (`lib/toast.ts`) e `Haptics`.
- Testes unitários para as funções puras (montagem da mensagem, sanitização do telefone).

### Excluído
- Auto-login do aluno após reset.
- Envio automático de email ou SMS com a senha (mantém o padrão atual: treinador compartilha manualmente).
- Alteração do fluxo do web.
- Unificação do fluxo de prescrição IA no mobile (escopo de spec futura).
- Qualquer mudança no UI do web.
- Reset de senha feito pelo próprio aluno (fluxo "esqueci minha senha"); essa spec é só a ação do treinador sobre um aluno específico.

## Arquivos Afetados

**Criar:**
- `supabase/functions/reset-student-password/index.ts` — Edge Function que:
  1. Autentica o chamador via header `Authorization`.
  2. Resolve `trainer.id` a partir de `auth_user_id`.
  3. Busca `student.auth_user_id` e `student.coach_id`.
  4. Confirma `student.coach_id === trainer.id`.
  5. Gera senha com `crypto.getRandomValues(new Uint8Array(8))` → base64url de 8 bytes (mesmo padrão do `create-student`).
  6. Chama `adminClient.auth.admin.updateUserById(student.auth_user_id, { password })`.
  7. Retorna `{ success, newPassword }` ou `{ success: false, error }`.

- `mobile/hooks/useResetStudentPassword.ts` — hook espelho de `useCreateStudent.ts`:
  - Estado `isResetting`.
  - Função `resetPassword(studentId: string): Promise<ResetPasswordResult>` que chama `supabase.functions.invoke('reset-student-password', { body: { studentId } })`.
  - Tipo `ResetPasswordResult = { success: true; newPassword: string } | { success: false; error: string }`.

- `mobile/components/trainer/student/ResetPasswordModal.tsx` — Modal RN nativo com dois estados:
  - **Confirmação**: ícone `Key` roxo, título "Gerar Nova Senha?", corpo "Tem certeza que deseja redefinir a senha de <Nome>? A senha atual deixará de funcionar imediatamente.", botões "Cancelar" e "Sim, Gerar" (com `ActivityIndicator` quando `isResetting`). Mostra erro em caixa vermelha inline se a chamada falhar.
  - **Sucesso**: ícone `Check` verde, título "Senha Gerada!", texto explicativo, caixa com a senha em monospace grande/`selectable`, botão primário "Copiar para WhatsApp" (muda para "Copiado!" verde por 2s após copiar) e botão secundário "Fechar". Se o aluno tiver `phone`, o botão tenta abrir o WhatsApp direto; se não tiver, apenas copia a mensagem.

- `mobile/lib/resetPasswordMessage.ts` — utilitários puros:
  - `buildWhatsAppMessage({ studentName, email, password })` — retorna a string padrão (mesma do web).
  - `sanitizePhoneForWhatsApp(phone: string | null | undefined)` — retorna só dígitos, com código do país 55 quando ausente, ou `null` se inválido.
  - `buildWhatsAppUrl(phone, message)` — retorna `whatsapp://send?phone=...&text=...` ou `null`.

**Editar:**
- `mobile/app/student/[id].tsx` — adicionar:
  - Botão/ícone `MoreVertical` (lucide) no lado direito do cabeçalho do aluno (após os badges de status/modalidade), que abre `ActionSheetIOS` no iOS e `Alert.alert` no Android, com a opção "Gerar Nova Senha" (seguindo o padrão já estabelecido em `handleAssignProgram`). A ação abre o `ResetPasswordModal`.
  - Estado `showResetPassword` (`boolean`).
  - Renderização condicional do `<ResetPasswordModal ... />` no fim do JSX, ao lado dos outros sheets.
  - Não exibir o menu se `student.is_trainer_profile === true` (paridade com o web, que esconde o menu para o próprio perfil do treinador).

**Não editar:**
- Nada no `web/` — o fluxo web permanece intacto.
- Nada no fluxo do aluno (tabs `(tabs)` e telas pessoais) — só na visão do treinador.

## Comportamento Esperado

### Fluxo do Usuário

1. Treinador abre a tela de detalhe de um aluno (`/student/[id]`).
2. Toca no botão `⋯` (três pontos) no header.
3. Aparece um ActionSheet/Alert com a opção "Gerar Nova Senha" (além de "Cancelar"). Se houver mais ações futuras, podem ser adicionadas à lista.
4. Ao tocar em "Gerar Nova Senha", abre um modal de confirmação com o nome do aluno.
5. Treinador toca em "Sim, Gerar". Botão mostra spinner e texto muda para "Gerando".
6. Em caso de sucesso, o modal transita para o estado "Senha Gerada!" mostrando a senha em fonte monospace grande e selecionável.
7. Treinador toca em "Copiar para WhatsApp". A mensagem padrão é copiada para o clipboard. Se o aluno tiver telefone, o WhatsApp abre com a conversa pré-preenchida; se não, apenas copia (feedback visual "Copiado!" no botão + haptic).
8. Treinador toca em "Fechar" para dismiss do modal.
9. Se der erro em qualquer ponto, o erro aparece inline dentro do modal de confirmação (caixa vermelha com a mensagem retornada pela Edge Function), e o modal não transita para o estado de sucesso.

### Fluxo Técnico

1. `ResetPasswordModal` chama `useResetStudentPassword().resetPassword(student.id)`.
2. O hook chama `supabase.functions.invoke('reset-student-password', { body: { studentId } })`.
3. A Edge Function:
   - Valida `Authorization` header presente e o JWT via `userClient.auth.getUser()`.
   - Resolve o `trainer.id` via `trainers` com `adminClient`.
   - Busca `student.auth_user_id` e `student.coach_id` via `adminClient`.
   - Confirma `student.coach_id === trainer.id`. Se não bater, retorna 403 `{ success: false, error: 'Acesso negado: Você não tem permissão para alterar este aluno.' }`.
   - Se `auth_user_id` for `null`, retorna 400 `{ success: false, error: 'Aluno não possui conta de acesso associada.' }`.
   - Gera senha com `crypto.getRandomValues(new Uint8Array(8))` → base64url (sem `+`, `/`, `=`).
   - Chama `adminClient.auth.admin.updateUserById(student.auth_user_id, { password })`.
   - Se falhar, retorna 500 com mensagem genérica; loga o erro real no console da função.
   - Se der certo, retorna 200 `{ success: true, newPassword }`.
4. O hook retorna o resultado para o modal, que atualiza o estado.
5. Copy/share usa `expo-clipboard` e `Linking.openURL`.

## Critérios de Aceite

- [ ] Treinador consegue gerar nova senha de qualquer aluno que ele gerencia pelo app mobile.
- [ ] Treinador **não** consegue gerar senha de um aluno de outro treinador (retorna erro).
- [ ] Treinador não autenticado ou sem registro em `trainers` recebe erro amigável.
- [ ] Aluno sem `auth_user_id` retorna erro específico ("Aluno não possui conta de acesso associada.").
- [ ] Nova senha é mostrada ao treinador uma única vez, no modal.
- [ ] Cópia para clipboard funciona no iOS e Android.
- [ ] Quando o aluno tem telefone, o botão abre o WhatsApp com a conversa pré-preenchida e mensagem idêntica à do web.
- [ ] Quando o aluno não tem telefone, o botão só copia (sem tentar abrir WhatsApp).
- [ ] A mensagem formatada é idêntica à do web: `Olá <primeiro nome>!\n\nSua senha de acesso ao aplicativo Kinevo foi redefinida.\n\nSua nova senha é: *<SENHA>*\n\nBaixe o app e faça o login com seu e-mail (<email>).`
- [ ] Spinner visível enquanto a Edge Function está em andamento, e botões desabilitados.
- [ ] Haptic `Medium` ao abrir menu, `Light` ao confirmar, `Success` ao concluir, `Error` em caso de erro.
- [ ] Sem novos erros de TypeScript e sem `any` novos (seguindo `CLAUDE.md`).
- [ ] Retrocompatível — nada quebra na tela do aluno.
- [ ] Menu de três pontos não aparece para `student.is_trainer_profile === true`.
- [ ] Modal dismissável apenas após sucesso ou cancelamento — não fechar por acidente enquanto `isResetting`.
- [ ] Edge Function tem CORS configurado (padrão `create-student`).

## Restrições Técnicas

- Seguir convenções do `mobile/CLAUDE.md` (NativeWind, Reanimated, Lucide exclusivamente, Haptics obrigatório, SafeArea, SecureStore, sentence case em labels).
- Edge Function deve seguir o padrão de `supabase/functions/create-student/index.ts`: `Deno.serve`, CORS, `userClient` para identidade + `adminClient` com Service Role Key para ação privilegiada.
- Não acessar diretamente `auth.admin` do lado do mobile. O mobile tem apenas a anon key.
- Validação de ownership sempre no servidor (não confiar em checagem client-side).
- Senha gerada deve usar `crypto.getRandomValues` (Web Crypto API disponível no Deno runtime).
- **Não** usar alerts nativos para apresentar a senha — precisa ser um modal próprio com fonte monospace e `selectable={true}`.
- Todas as strings novas em pt-BR.
- Sem mudanças no banco de dados (nenhuma migration necessária).

## Edge Cases

- **Aluno sem `auth_user_id`**: retorna erro "Aluno não possui conta de acesso associada."; modal mostra o erro e não transita.
- **Aluno de outro treinador** (payload manipulado no cliente): Edge Function retorna 403 e o app mostra "Acesso negado...".
- **Sessão expirada**: `supabase.auth.getSession()` retorna `null` → hook retorna `{ success: false, error: 'Sessão expirada. Faça login novamente.' }` antes mesmo de chamar a Edge Function (mesmo padrão de `useCreateStudent`).
- **WhatsApp não instalado**: `Linking.canOpenURL('whatsapp://...')` retorna `false` → copiar mensagem no clipboard e mostrar toast "Mensagem copiada" + "Cole no WhatsApp para enviar".
- **Telefone inválido** (menos de 10 dígitos após sanitização): não tentar abrir WhatsApp, só copiar.
- **Telefone do aluno começa com "+55"** ou só com dígitos: `sanitizePhoneForWhatsApp` remove não-dígitos e prefixa `55` só quando ausente (não duplica).
- **Usuário fecha a tela durante o request**: hook não deve crashar — usar cleanup padrão do React/`AbortController` não é estritamente necessário, mas o `setIsResetting` só é chamado se o componente ainda estiver montado (use ref + `isMountedRef` se necessário — mesmo padrão de outros hooks do projeto, caso haja).
- **Duplo toque no botão "Sim, Gerar"**: botão fica `disabled` enquanto `isResetting` — não dispara duas chamadas.
- **Ícone Key** do lucide: mesmo roxo (`#7c3aed` / `colors.brand.primary`) usado nos demais destaques do app.
- **Perfil do próprio treinador**: quando o "aluno" carregado é o perfil do próprio treinador (`is_trainer_profile === true`), o menu ⋯ não aparece (paridade com web).

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
Vitest, sem DOM nem mocks complexos. Arquivo `mobile/lib/resetPasswordMessage.test.ts`:
- [ ] `buildWhatsAppMessage` — produz a string exatamente no formato esperado, com apenas o primeiro nome do aluno.
- [ ] `buildWhatsAppMessage` — nome com único token (sem sobrenome) não quebra.
- [ ] `buildWhatsAppMessage` — escapa corretamente `*` ao redor da senha (a senha não deve ser tocada).
- [ ] `sanitizePhoneForWhatsApp` — input `'(11) 98765-4321'` → `'5511987654321'`.
- [ ] `sanitizePhoneForWhatsApp` — input `'5511987654321'` → `'5511987654321'` (não duplica `55`).
- [ ] `sanitizePhoneForWhatsApp` — input `'+55 11 98765-4321'` → `'5511987654321'`.
- [ ] `sanitizePhoneForWhatsApp` — input `null`, `undefined`, `''`, `'abc'`, `'12345'` → `null`.
- [ ] `buildWhatsAppUrl` — retorna `whatsapp://send?phone=5511987654321&text=<encoded>` quando phone válido.
- [ ] `buildWhatsAppUrl` — retorna `null` quando phone é `null`.

### Server Actions / Queries (recomendado)
Edge Function é Deno, não entra no vitest. Cobrir manualmente com curl/Postman as 4 variantes (OK, sem auth, outro treinador, aluno sem `auth_user_id`). Não criar testes automatizados para a Edge Function nessa spec.

### Componentes (opcional)
Não prioritário — o modal não afeta receita nem prescrição core. Pode ser pulado.

## Referências

- Server Action web: `web/src/app/students/[id]/actions/reset-student-password.ts`
- UI web: `web/src/components/students/student-header.tsx` (linhas 101–123 para o handler; 362–452 para o modal)
- Edge Function de referência: `supabase/functions/create-student/index.ts`
- Hook de referência: `mobile/hooks/useCreateStudent.ts`
- Tela alvo: `mobile/app/student/[id].tsx`
- Helper de toast: `mobile/lib/toast.ts`
- Template de spec: `mobile/specs/TEMPLATE.md`

## Notas de Implementação

### Arquivos criados
- `supabase/functions/reset-student-password/index.ts` — Edge Function. CORS, auth via JWT, ownership check (`student.coach_id === trainer.id`), gera senha base64url de 8 bytes via `crypto.getRandomValues`, chama `adminClient.auth.admin.updateUserById`. Códigos HTTP: 401 (sem auth), 403 (não é treinador / aluno de outro), 400 (payload inválido / aluno sem `auth_user_id`), 404 (aluno não encontrado), 500 (erro interno / falha no admin API).
- `mobile/lib/resetPasswordMessage.ts` — `buildWhatsAppMessage`, `sanitizePhoneForWhatsApp`, `buildWhatsAppUrl`. Mensagem byte-a-byte idêntica à do web (`student-header.tsx:120`).
- `mobile/lib/resetPasswordMessage.test.ts` — 9 testes vitest, todos passando.
- `mobile/hooks/useResetStudentPassword.ts` — espelho de `useCreateStudent.ts`. Check de sessão expirada antes do invoke. Retorno tipado union (`{ success: true; newPassword } | { success: false; error }`).
- `mobile/components/trainer/student/ResetPasswordModal.tsx` — Modal RN com dois estados (confirmação / sucesso). Senha em monospace `selectable`. Haptics `Light` ao confirmar, `Success` ao gerar/copiar, `Error` no erro. Botão de copiar tenta abrir WhatsApp via `Linking.canOpenURL` quando há telefone válido (≥10 dígitos), sempre copia para o clipboard. Modal não fecha enquanto `isResetting`.

### Arquivos editados
- `mobile/app/student/[id].tsx` — adicionado import `MoreVertical` e `Haptics`, `ResetPasswordModal` import, estado `showResetPassword`, handler `handleOpenStudentMenu` (Haptics `Medium` + ActionSheet/Alert seguindo padrão do `handleAssignProgram`), botão `MoreVertical` no header (escondido se `student.is_trainer_profile`), e renderização do modal no fim do JSX.

### Decisões não-óbvias
- **Modal usa `Modal` nativo do RN com `animationType="fade"`** (não Reanimated) — é o suficiente para um modal simples e evita complexidade extra. A regra "Reanimated para animações" continua valendo para qualquer animação custom.
- **Botão "Copiar para WhatsApp"** sempre copia a mensagem; se o WhatsApp estiver disponível, também tenta abrir. Toast diferencia os dois caminhos ("Abrindo WhatsApp…" vs "Cole no WhatsApp para enviar.").
- **Hook não usa `isMountedRef`** — `setIsResetting` é chamado dentro de um `try/finally`, e o invoke é uma única chamada; o pior caso é um warning de setState após unmount, que é aceitável para o escopo. Pode ser endurecido depois, se aparecer no log.
- **Telefone < 10 dígitos** → `sanitizePhoneForWhatsApp` retorna `null` → não tenta abrir WhatsApp, só copia.
- **Senha gerada server-side**: o cliente nunca gera senha, conforme spec.

### Verificação
- `cd mobile && npx tsc --noEmit` — zero novos erros (16 erros pré-existentes em arquivos não relacionados, contagem antes/depois idêntica).
- `cd mobile && npx vitest run lib/resetPasswordMessage.test.ts` — 9/9 testes passando.

### Deploy da Edge Function (a ser feito pelo dev)

```bash
cd /Users/gustavoprado/kinevo
supabase functions deploy reset-student-password
```

A função usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` (já disponíveis no ambiente padrão do Supabase Functions). Nenhuma secret nova precisa ser configurada.

### Curl de validação (substituir variáveis)

```bash
# Substitua SUPABASE_URL, JWT_DO_TREINADOR e STUDENT_ID
curl -X POST "$SUPABASE_URL/functions/v1/reset-student-password" \
  -H "Authorization: Bearer $JWT_DO_TREINADOR" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"STUDENT_ID"}'

# Esperado (200): {"success":true,"newPassword":"..."}
# Sem auth (401): {"success":false,"error":"Não autorizado."}
# Aluno de outro treinador (403): {"success":false,"error":"Acesso negado: ..."}
# Aluno sem auth_user_id (400): {"success":false,"error":"Aluno não possui conta de acesso associada."}
```

### Checklist de validação manual no app

- [ ] iOS: abrir aluno → tocar `⋯` no header → ActionSheet aparece com "Gerar nova senha".
- [ ] Android: mesma ação abre `Alert` com a mesma opção.
- [ ] Confirmar geração → spinner + botão desabilitado → modal transita para "Senha gerada!".
- [ ] Senha em monospace, selecionável (long-press copia no iOS/Android).
- [ ] "Copiar para WhatsApp" com aluno **com** telefone → WhatsApp abre na conversa, mensagem pré-preenchida idêntica à do web.
- [ ] "Copiar para WhatsApp" com aluno **sem** telefone → só copia, toast informa "Cole no WhatsApp…".
- [ ] Aluno = perfil do próprio treinador (`is_trainer_profile === true`) → botão `⋯` **não** aparece.
- [ ] Tentar fechar o modal durante o request → não fecha.
- [ ] Erro 403 (forçar via curl com aluno de outro treinador) → mensagem em caixa vermelha dentro do modal.

