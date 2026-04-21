# Prompt — Fase 2: Mobile UI (editar + arquivar aluno)

> Copie e cole o bloco abaixo em uma sessão nova do Claude Code, a partir da raiz do monorepo `kinevo`.

---

Essa é a **Fase 2 de 2** da feature "Editar e arquivar aluno no menu '...' do mobile". A Fase 1 (Edge Functions `update-student` e `archive-student`) precisa estar **deployada em produção** antes de começar aqui.

## Prerequisito

- Fase 1 deployada: confirme via `mcp__5dd45980-...__list_edge_functions` (projeto `lylksbtgrihzepbteest`) que `update-student` e `archive-student` aparecem como `ACTIVE`.
- Se alguma não estiver, **pare e peça ao dev pra rodar a Fase 1 primeiro**. Não tente re-deployar aqui.

## Spec

Leia por inteiro antes de começar: `mobile/specs/active/editar-arquivar-aluno-mobile.md`. Essa fase corresponde à linha **"Fase 2 — Mobile UI"** da tabela "Estratégia de execução" e aos critérios sob **"Fase 2 — Mobile"** em "Critérios de Aceite".

## Contexto crítico

1. **O padrão de tratamento de `FunctionsHttpError` é obrigatório em todos os hooks que chamam Edge Functions.** Foi aplicado em `useResetStudentPassword.ts` na sessão anterior. Nessa fase, propague pra `useCreateStudent.ts`, `useUpdateStudent.ts` (novo) e `useArchiveStudent.ts` (novo). Padrão:
   ```ts
   import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";

   if (response.error) {
     if (response.error instanceof FunctionsHttpError) {
       try {
         const errorBody = await response.error.context.json();
         return { success: false, error: errorBody.error ?? errorBody.message ?? "Erro ao <ação>" };
       } catch {
         return { success: false, error: "Erro ao <ação>. Tente novamente." };
       }
     }
     if (response.error instanceof FunctionsRelayError || response.error instanceof FunctionsFetchError) {
       return { success: false, error: "Erro de rede. Verifique sua conexão." };
     }
     return { success: false, error: response.error.message ?? "Erro desconhecido" };
   }
   ```

2. **Menu "..." hoje tem 1 opção** (`Gerar nova senha`) e é renderizado via `Alert.alert` ou `ActionSheetIOS` — localize exatamente como está em `mobile/app/student/[id]/index.tsx`. Você vai adicionar mais 2 opções e ajustar a ordem: **Editar aluno, Gerar nova senha, Arquivar, Cancelar**.

3. **Visual do modal de edição deve espelhar o `AddStudentModal`**. Abra `mobile/components/trainer/students/AddStudentModal.tsx` e replique estilo (Modal RN + `animationType="fade"` + overlay escurecido + card branco com borda 20px + botões roxos + Lucide icons). O conteúdo é diferente mas a estética é idêntica.

4. **Arquivo de rota:** `mobile/app/student/[id]/index.tsx`. Foi movido de `[id].tsx` para dentro da pasta numa sessão anterior (conflito de rota com `prescribe.tsx`). Todos os imports relativos usam `../../../`.

## Trabalho

### 1. Estudar padrões existentes

Leia antes de escrever:
- `mobile/hooks/useCreateStudent.ts` — padrão de hook que chama Edge Function.
- `mobile/hooks/useResetStudentPassword.ts` — padrão atualizado com `FunctionsHttpError`.
- `mobile/components/trainer/students/AddStudentModal.tsx` — padrão visual de modal.
- `mobile/components/trainer/student/ResetPasswordModal.tsx` — outro modal recente para referência visual.
- `mobile/app/student/[id]/index.tsx` — arquivo que você vai editar; entenda o estado atual do menu "...".
- `mobile/CLAUDE.md` se existir — convenções do mobile.

### 2. Criar `mobile/hooks/useUpdateStudent.ts`

**Contrato:**

```ts
type UpdateStudentInput = {
  studentId: string;
  name?: string;
  email?: string;
  phone?: string;
  modality?: 'online' | 'presential';
};

type UpdateStudentResult =
  | { success: true; student: Student }
  | { success: false; error: string };

export function useUpdateStudent() {
  // retorna { mutate, isPending, ... } no padrão do projeto (React Query? estado local?).
  // Siga o mesmo padrão de useCreateStudent / useResetStudentPassword.
}
```

**Implementação:**
- `supabase.functions.invoke("update-student", { body: input })`.
- Aplica o padrão de `FunctionsHttpError` da seção Contexto Crítico item 1.
- Em caso de sucesso, invalida o cache do student individual e da lista (seguir padrão do projeto — React Query com chaves? store Zustand? confirmar ao ler `useCreateStudent`).

### 3. Criar `mobile/hooks/useArchiveStudent.ts`

**Contrato:**

```ts
type ArchiveStudentInput = { studentId: string };
type ArchiveStudentResult =
  | { success: true; studentId: string }
  | { success: false; error: string };

export function useArchiveStudent() { /* ... */ }
```

**Implementação:**
- `supabase.functions.invoke("archive-student", { body: input })`.
- Padrão de `FunctionsHttpError`.
- Em caso de sucesso, invalida cache da lista de alunos (pra que o aluno suma da listagem).

### 4. Propagar padrão `FunctionsHttpError` em `mobile/hooks/useCreateStudent.ts`

Aplique o mesmo bloco de extração de `FunctionsHttpError.context.json()` que está em `useResetStudentPassword.ts`. Não altere o contrato do hook — só melhore a mensagem de erro.

### 5. Criar `mobile/components/trainer/student/EditStudentModal.tsx`

**Props:**
```ts
type EditStudentModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (updatedStudent: Student) => void;
  student: Student; // aluno atual, pra preencher os campos
};
```

**Comportamento:**
- 4 campos: `name` (texto), `email` (texto, keyboard email-address), `phone` (texto, keyboard phone-pad), `modality` (toggle ou select entre `online` e `presential`).
- Inicializa campos com os valores de `student` via `useState` + `useEffect` quando `visible` muda para `true`.
- **Warning inline se o email mudou**: abaixo do input de email, quando `emailAtual !== emailNovo`, renderiza um texto cinza (classe Tailwind equivalente à `text-gray-500 text-sm`) dizendo: "Ao alterar o email, o aluno precisará fazer login novamente com o novo endereço."
- Botão "Salvar" chama `useUpdateStudent.mutate({ studentId: student.id, ...campos })`.
  - **Só envia os campos que mudaram** (comparar com `student` original). Evita enviar `phone: "11999999999"` inalterado.
  - Loading state no botão (desabilita + troca label pra "Salvando..." ou spinner).
- **Sucesso:** fecha modal, chama `onSuccess(updatedStudent)`, dispara `Haptics.notificationAsync(Success)`.
- **Erro:** mantém modal aberto, mostra mensagem inline vermelha no topo do modal (igual o padrão de `AddStudentModal` para erros). Dispara `Haptics.notificationAsync(Error)`.
- **Botão cancelar / fechar modal:** fecha sem salvar. Se o usuário tiver mudanças pendentes, mostra um `Alert.alert` "Descartar alterações?" com botões "Continuar editando" e "Descartar" (destrutivo). Se não houver mudanças, fecha direto.
- **Validação client-side** (leve, pra UX; Edge Function revalida):
  - Nome não pode ser vazio.
  - Email precisa de regex básica.
  - Phone opcional.
- Segue o visual de `AddStudentModal` (Modal RN fade, overlay, card branco 20px border, botões roxos).

### 6. Atualizar `mobile/app/student/[id]/index.tsx`

**Mudanças:**

1. **Importar** os novos hooks (`useUpdateStudent`, `useArchiveStudent`), o novo modal (`EditStudentModal`), e `Alert` do RN se não estiver importado.

2. **Adicionar estado:**
   ```ts
   const [editModalVisible, setEditModalVisible] = useState(false);
   ```

3. **Localizar o handler do menu "..."** (hoje deve ter um `handleMorePress` ou similar que chama `ActionSheetIOS.showActionSheetWithOptions` em iOS e `Alert.alert` em Android, ou só um Alert unificado). Você vai estender esse handler.

   **Ordem final das opções** (fora `Cancelar`):
   1. Editar aluno
   2. Gerar nova senha
   3. Arquivar

   Mantenha a detecção de plataforma que já existe (não reinvente). Se hoje é `ActionSheetIOS` no iOS e `Alert.alert` no Android, continue assim — só adiciona os dois novos itens na lista de `options` com os devidos `destructiveButtonIndex` (o "Arquivar" é destrutivo).

4. **Handler `handleEditStudent`:**
   ```ts
   const handleEditStudent = () => {
     Haptics.selectionAsync();
     Alert.alert(
       `Editar ${student.name}?`,
       "Você poderá alterar nome, email, telefone e modalidade.",
       [
         { text: "Cancelar", style: "cancel" },
         { text: "Editar", onPress: () => setEditModalVisible(true) },
       ]
     );
   };
   ```

5. **Handler `handleArchiveStudent`:**
   ```ts
   const handleArchiveStudent = () => {
     Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
     Alert.alert(
       `Arquivar ${student.name}?`,
       "O aluno sairá da sua lista e não poderá acessar mais treinos. Você pode restaurar depois em Configurações.",
       [
         { text: "Cancelar", style: "cancel" },
         {
           text: "Arquivar",
           style: "destructive",
           onPress: async () => {
             const result = await archiveStudent.mutateAsync({ studentId: student.id });
             if (result.success) {
               Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
               router.back(); // ou router.replace('/students') se o projeto preferir
             } else {
               Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
               Alert.alert("Erro", result.error);
             }
           },
         },
       ]
     );
   };
   ```
   (Ajuste os nomes de `mutateAsync` / `mutate` ao padrão do projeto — pode não ser React Query.)

6. **Renderizar `EditStudentModal`:**
   ```tsx
   <EditStudentModal
     visible={editModalVisible}
     onClose={() => setEditModalVisible(false)}
     onSuccess={(updated) => {
       setEditModalVisible(false);
       // invalidar cache ou setar state local com os novos dados
     }}
     student={student}
   />
   ```

7. **Testar mentalmente o fluxo**: toque no "..." → ActionSheet/Alert com 4 opções → "Editar aluno" → Alert warning → confirma → modal abre com dados preenchidos → edita → salva → toast/feedback → tela reflete dados novos.

### 7. Atualizar filtro da lista de alunos

Localize o hook que carrega a lista de alunos no mobile. Candidatos prováveis:
- `mobile/hooks/useStudentsList.ts`
- `mobile/hooks/useTrainerStudents.ts`
- `mobile/app/(trainer)/students.tsx` ou `mobile/app/(trainer)/index.tsx` (se carrega inline)

Procure por `.from('students').select(...)`. Adicione filtro: `.neq('status', 'archived')` ou `.eq('status', 'active')` — escolher o que for mais semântico.

**Importante:** se o filtro por status quebrar alunos antigos criados antes da coluna existir (nulo), use `.or('status.is.null,status.eq.active')` ou defina default na query. Na prática, `create-student` já seta `status: 'active'`, então quase todos os alunos devem ter o campo preenchido. Verifique com um SELECT via MCP Supabase antes de assumir.

### 8. Testes Vitest

Crie `mobile/hooks/__tests__/useUpdateStudent.test.ts` e `mobile/hooks/__tests__/useArchiveStudent.test.ts` seguindo o padrão dos testes de hooks existentes (localize `mobile/hooks/__tests__/useResetStudentPassword.test.ts` ou similar — se não existir, siga o padrão de outros testes de hooks no mobile).

Cobertura mínima:
- `useUpdateStudent`: sucesso com student atualizado; erro `FunctionsHttpError` extrai body JSON; erro genérico cai em mensagem default.
- `useArchiveStudent`: sucesso; erro 403 extrai mensagem.
- `useCreateStudent` (se já tiver teste existente, estenda; se não, adicione um teste novo cobrindo `FunctionsHttpError` extraction).

Mocks: `supabase.functions.invoke` mockado para retornar `{ data, error }` ou lançar `FunctionsHttpError`. Veja exemplos em testes de `useResetStudentPassword`.

### 9. Verificação final

- `cd mobile && npx tsc --noEmit` → zero novos erros.
- `cd mobile && npx vitest run` → verde (pode pular testes e2e que dependem de device).
- Rodar o app em iOS simulator (se disponível no ambiente):
  - Abrir detalhe de um aluno.
  - Tocar "..." → ver as 3 opções + Cancelar.
  - Testar cada opção (editar, gerar nova senha, arquivar).
  - Editar nome → salvar → confirma que UI atualizou.
  - Editar email → warning inline aparece → salvar → (em dev, validar que `auth.users.email` atualizou via SQL).
  - Arquivar → Alert destrutivo → confirmar → volta pra lista → aluno some da lista.
- Revisar diff completo do PR:
  - `mobile/hooks/useUpdateStudent.ts` (novo)
  - `mobile/hooks/useArchiveStudent.ts` (novo)
  - `mobile/hooks/useCreateStudent.ts` (propagação do padrão)
  - `mobile/components/trainer/student/EditStudentModal.tsx` (novo)
  - `mobile/app/student/[id]/index.tsx` (menu + handlers + modal)
  - `mobile/hooks/useStudentsList.ts` (ou equivalente — filtro)
  - Testes novos.
- Confirmar que **não** mexeu em: `supabase/`, `web/`, `shared/`.

## Restrições

- **Não toque em `supabase/`, `web/`, `shared/`.** Só mobile.
- **Não crie migration de DB nem mude Edge Functions.** Fase 1 é responsável por isso e já está pronta.
- **Não adicione dependências novas sem justificar**. Se precisar de algo, prefira usar o que o projeto já tem.
- **Haptics obrigatórios nos pontos-chave**: menu aberto (Medium), modal aberto (Light), salvar sucesso (Success), erro (Error), Alert destrutivo (Warning).
- **pt-BR hardcoded** em toda label e mensagem visível ao usuário.
- **Sentence case em labels** ("Editar aluno", não "Editar Aluno"), mas "Gerar nova senha" já segue. Consistência.
- **Sem `any`**. Use tipos do `@kinevo/shared` quando o `Student` já existe lá.
- **Backward compat**: "Gerar nova senha" não pode regredir.
- **Não esqueça de invalidar caches** após update e archive — senão a UI fica stale.
- **Se detectar que o projeto usa React Query com `useQueryClient().invalidateQueries(['students'])`, use esse padrão.** Se usa Zustand store manual, atualize o store manualmente.

## Entregáveis finais

1. Hooks novos: `useUpdateStudent`, `useArchiveStudent`.
2. Hook estendido: `useCreateStudent` com `FunctionsHttpError` extraction.
3. Modal novo: `EditStudentModal`.
4. Tela atualizada: `mobile/app/student/[id]/index.tsx` com 3 opções no menu "..." + handlers + modal renderizado.
5. Filtro de lista de alunos escondendo arquivados.
6. Testes Vitest verdes.
7. `tsc --noEmit` limpo.
8. Resumo em bullets com:
   - Arquivos criados/modificados.
   - Como você localizou o hook de lista de alunos (nome exato) e como fez o filtro.
   - Decisões não-óbvias (ex: React Query vs Zustand, como invalidou cache).
   - Quaisquer desvios do prompt e por quê.

Quando terminar, **não crie PR nem commit** — deixe as mudanças locais pro dev testar em device real antes.
