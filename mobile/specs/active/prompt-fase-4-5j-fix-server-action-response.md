# Prompt Claude Code — Fase 4.5j: Fix do "An unexpected response was received from the server" pós-save

> Cole numa nova sessão do Claude Code. **Workflow:** apenas modificações no working tree. **NÃO faça `git commit` nem `git push`.** Working tree continua acumulando.
>
> Releia `mobile/specs/WORKFLOW.md` antes de começar.

---

**Bug crítico identificado pelo Gustavo após validar a Fase 4.5i:**

Ao salvar um programa atribuído editado em `/students/[id]/program/[programId]/edit` (com Drop-set 3×3 prescrito):

1. Toast "Treino atualizado com sucesso" aparece — server action returnou OK no servidor.
2. Mas o navegador trava com "Rendering..." (Next.js dev indicator) infinito.
3. Console mostra:
   - `Uncaught (in promise) Error: An unexpected response was received from the server. at fetchServerAction (server-action-reducer.js:118:37)`
   - `Initializing workouts with program: undefined` (4× repetido — re-render loop)
   - Múltiplos `[Fast Refresh] rebuilding` (sintoma do loop)

**Hipótese principal:** regressão da Fase 4.5i. Quando estendemos a query de load (`page.tsx`) com `LEFT JOIN assigned_workout_item_sets`, ou o server action de save com `persistAssignedSetSchemeRows`, algo na resposta serializada do servidor virou inparseável pro client (`fetchServerAction`).

**Provável root cause:**
- O server action está retornando dados não-serializáveis (ex.: `Date`, `BigInt`, função, classe instanciada, objeto com referência circular)
- OU o `revalidatePath`/`redirect` pós-save dispara um refetch que retorna shape inesperado
- OU a tipagem do retorno desalinhou (server action espera shape A, retorna shape B)

## 0. Pré-checagens

```bash
git status        # working tree atual com 4.5d-i acumuladas
```

## 1. Investigação ANTES de qualquer fix

### 1.1 Localizar o server action de save

```bash
grep -rn "use server\|saveProgram\|updateAssignedProgram\|revalidatePath" web/src/components/programs/edit-assigned-program-client.tsx web/src/app/students 2>/dev/null | head -20
```

Encontra o server action que é chamado quando o trainer clica em "Salvar Alterações". Pode estar em:
- `web/src/components/programs/edit-assigned-program-client.tsx` (inline `'use server'` ou import)
- `web/src/actions/programs/save-assigned-program.ts` (ou similar)
- `web/src/app/students/[id]/program/[programId]/edit/actions.ts` (route-local actions)

### 1.2 Inspecionar o que o server action retorna

Lê o código completo da função. Verifica:

- (a) **Tipo de retorno** declarado — é `Promise<void>`? `Promise<{ ok: boolean }>`? `Promise<AssignedProgramData>`?
- (b) **O que ele REALMENTE retorna** no path de sucesso — pode estar retornando objeto inteiro do programa atualizado (incluindo objetos do Supabase com Date, ou rows com campos não-esperados pelo client).
- (c) **Existe `revalidatePath` ou `redirect`** na função? Se sim, **onde** — antes ou depois do return?
- (d) **Existe `try/catch`** mascarando erros do JOIN/insert e retornando `undefined`?

### 1.3 Inspecionar o que o client espera

Localiza onde o handler do botão "Salvar" chama o server action:

```bash
grep -n "saveProgram\|handleSave\|onSave\|await.*save\|.then(" web/src/components/programs/edit-assigned-program-client.tsx | head -20
```

Verifica:
- (e) **Como o client interpreta o resultado** — desestrutura algum campo? Espera shape específico?
- (f) **Tem `useEffect` ou `setState`** que dispara após save bem-sucedido? Pode ser fonte do loop.
- (g) **Existe `router.refresh()`, `router.push()`** ou outra navegação pós-save? Se a navegação tenta carregar o mesmo programa de novo e a query falha → loop.

### 1.4 Verificar se save persistiu (perguntar ao Gustavo)

O Gustavo já vai ter rodado o "Teste A" (recarregar a página e ver se Drop-set persistiu). Pergunta a ele o resultado:

- **Se preservou:** save OK. Bug é puramente na resposta do action / re-render pós-save.
- **Se NÃO preservou:** save falhou silenciosamente apesar do toast. Investigar o que está retornando "sucesso" sem ter persistido.

### 1.5 Reportar diagnóstico ANTES de fixar

```
DIAGNÓSTICO Fase 4.5j:

Server action (arquivo:linha):
  Retorno declarado: <tipo>
  Retorno real: <descrição do objeto>
  revalidatePath: <SIM em linha X / NÃO>
  redirect: <SIM em linha X / NÃO>
  try/catch mascarando erro: <SIM / NÃO>

Client handler (arquivo:linha):
  Espera shape: <tipo>
  Pós-save action: <router.refresh / setState / nada>
  Loop suspeito em useEffect: <SIM com deps X / NÃO>

Save persistiu no DB (per Gustavo):
  <SIM — preservou Drop-set ao recarregar / NÃO — voltou pra modo simples>

ROOT CAUSE: <descrição em 2-3 frases>

PLANO DE FIX:
  <passos específicos>
```

**Pare aqui e aguarda o Gustavo confirmar o diagnóstico antes de aplicar o fix.**

## 2. Fix (após aprovação do diagnóstico)

Os fixes mais prováveis (escolhe conforme diagnóstico):

### Cenário A — Server action retornando objeto não-serializável

```ts
// ANTES (provavelmente errado)
return { ok: true, program: insertedProgram } // pode ter Date / circular ref

// DEPOIS
return { ok: true } // só primitivos
```

E faz o client refetch via `router.refresh()` se precisar dos dados novos.

### Cenário B — `revalidatePath` antes do return causa double-render

```ts
// ANTES
revalidatePath('/students/[id]/program/[programId]/edit')
return { ok: true }

// DEPOIS — revalidate FORA do return path quente, ou só após confirmação client-side
return { ok: true }
// Cliente decide se quer revalidar via router.refresh()
```

### Cenário C — Loop em useEffect pós-save

Se o handler faz algo como:

```ts
useEffect(() => {
  // re-init quando program muda
  initializeWorkouts(program)
}, [program]) // 👈 program é objeto que muda referência toda render
```

Fix: estabiliza a dependência (useMemo, ou usa ID em vez do objeto):

```ts
useEffect(() => {
  initializeWorkouts(program)
}, [program?.id]) // só re-inicializa se ID mudar
```

### Cenário D — JOIN da query falha silenciosamente

Se o `LEFT JOIN assigned_workout_item_sets` está retornando `null` ou erro mascarado, o `program` chega `undefined` no client. Fix: tratar erro explicitamente:

```ts
const { data: program, error } = await supabase.from(...).select(...)
if (error) {
  console.error('Failed to load program:', error)
  notFound() // ou throw
}
```

## 3. Validação do round-trip pós-fix

Após o fix, valida com Gustavo:

1. Edita um programa atribuído com Drop-set, salva.
2. Toast aparece, **sem** erro no console, **sem** "Rendering..." preso.
3. Página recarrega/atualiza com os dados novos visíveis.
4. Recarrega F5 manual: dados persistem.

## 4. Validações locais

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Mantém baselines.

## 5. NÃO commita, NÃO empurra

Atualize a spec com notas dessa fase no working tree, rode `git status`, e pare.

## 6. Reporte final

```
FASE 4.5j — fix do server action response (working tree, sem commit)

Diagnóstico: <root cause>

Fix aplicado:
  - <arquivo:linhas> — <descrição>

Round-trip validado:
  - Save de drop-set 3×3 → toast sucesso
  - Console limpo (zero erros)
  - Página atualiza sem "Rendering..." preso
  - F5 manual: dados preservados

Mensagem de commit sugerida (não execute agora):
  fix(per-set): repair server action response after save in assigned program editor

Arquivos modificados (working tree):
  <lista>

Validações:
  shared: 142/142
  web TS: 11 erros baseline (idêntico)
  web vitest: <X>/<X>
  mobile TS: 10 erros baseline (idêntico)
  mobile vitest: 255/255

Estado: working tree acumulando 4.5d-j. SEM commits, SEM push.
```

## 7. Edge cases

- **`program: undefined` ao recarregar diretamente** (sem ter salvado antes): pode ser bug pré-existente desmascarado pela 4.5i, não relacionado. Reporta separado se for o caso.
- **Save retorna ok mas Supabase RLS rejeitou silenciosamente**: trate o `error` do supabase explicitamente.

## 8. Iterar / desfazer

- Working tree: edita arquivos in-place.
- Voltar arquivo: `git checkout -- <arquivo>`.
- NÃO `git reset --hard origin/main`.

Tudo claro? Confirme com "Fase 4.5j — começando" e parta da pré-checagem (incluindo passo 1.5 — reportar diagnóstico antes de fixar).
