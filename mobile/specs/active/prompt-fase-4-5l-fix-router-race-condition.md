# Prompt Claude Code — Fase 4.5l: Fix do race condition router.push + router.refresh pós-save

> Cole numa nova sessão do Claude Code. **Workflow:** apenas modificações no working tree. **NÃO faça `git commit` nem `git push`.** Working tree continua acumulando.
>
> Releia `mobile/specs/WORKFLOW.md` antes de começar.

---

**Bug A confirmado pelo Gustavo como reproduzível** (não era glitch one-time como inicialmente suspeitei).

Sintomas observados:
- Após clicar "Salvar Alterações" em `/students/[id]/program/[programId]/edit`:
- Toast "Programa atualizado com sucesso" aparece (alert nativo)
- Console mostra: `Uncaught (in promise) Error: An unexpected response was received from the server. at fetchServerAction (server-action-reducer.js:118:37)` — **2 ocorrências**
- URL **continua em `/edit`** (router.push pra `/students/[id]` NÃO completou)
- "Rendering..." indicator do Next.js trava por minutos
- F5 manual: página carrega OK e dados persistiram corretamente (save funcionou no DB)

**Diagnóstico já feito** (Fase 4.5j parou aqui sem fix):

Na função `saveProgram` de `web/src/components/programs/edit-assigned-program-client.tsx` (linha ~1273+), após save bem-sucedido:

```ts
alert('Programa atualizado com sucesso!')
capturePostAssignmentEdits(...).catch(() => {})  // fire-and-forget
router.push(`/students/${studentId}`)            // navega pra detalhe
router.refresh()                                  // re-fetcha RSC
```

A combinação `router.push()` + `router.refresh()` em sequência síncrona é o bug. No Next 16:
- `router.push` inicia navegação pra rota destino e dispara fetch do RSC payload da nova rota
- `router.refresh()` em paralelo dispara fetch do RSC da rota ATUAL
- Os dois fetches conflitam → um dos payloads chega malformado/abortado
- Cliente não consegue parsear → `fetchServerAction` lança "An unexpected response"
- Navegação fica travada, URL não muda

## 0. Pré-checagens

```bash
git status        # working tree atual com 4.5d-k acumuladas
```

## 1. Aplicar 2 fixes simultâneos

### 1.1 Fix principal — remover `router.refresh()` redundante

Em `web/src/components/programs/edit-assigned-program-client.tsx`, localiza o bloco pós-save (provavelmente linha ~1273+):

```ts
// ANTES
alert('Programa atualizado com sucesso!')
capturePostAssignmentEdits(...).catch(() => {})
router.push(`/students/${studentId}`)
router.refresh()  // 👈 REMOVER

// DEPOIS
alert('Programa atualizado com sucesso!')
capturePostAssignmentEdits(...).catch(() => {})
router.push(`/students/${studentId}`)
// router.refresh() removido — router.push já busca dados frescos da rota destino
```

**Justificativa:** `router.push()` em Next 16 já faz fetch do RSC da rota destino. O `refresh()` em cima é redundante e causa o race condition. A rota destino (`/students/[id]`) sempre carrega dados atualizados ao montar.

### 1.2 Fix diagnóstico — parar de descartar erro do Supabase no load

Em `web/src/app/students/[id]/program/[programId]/edit/page.tsx`, localiza o load (linha ~23):

```ts
// ANTES
const { data: program } = await supabase.from(...).select(...)
if (!program) notFound()

// DEPOIS
const { data: program, error } = await supabase.from(...).select(...)
if (error) {
  console.error('[EditProgramPage] failed to load program:', error)
  // Em produção, ainda chama notFound() pra UX consistente, mas o erro
  // fica logado pra debugging futuro.
}
if (!program) notFound()
```

Esse fix **não é o conserto principal** do Bug A — é instrumentação. Se algum outro problema futuro tocar a query, vamos ter visibilidade no terminal de dev em vez de silêncio.

## 2. Validação do round-trip pós-fix

Pede pro Gustavo testar:

1. Edita um programa atribuído com Drop-set ou Cluster.
2. Salva.
3. **Observações esperadas:**
   - Toast "Programa atualizado com sucesso" aparece.
   - URL muda pra `/students/[id]` (página de detalhe do aluno).
   - **Console limpo** (sem `fetchServerAction error`).
   - Sem "Rendering..." preso.
4. Volta pra editar o mesmo programa: dados preservados, abre em modo Avançado.

Se o erro persistir mesmo após remover `router.refresh()`, a causa é outra (provavelmente H1 — query da página destino `/students/[id]` está falhando). Reporta de volta com nova investigação.

## 3. Validações locais

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Mantém baselines.

## 4. NÃO commita, NÃO empurra

Atualize a spec com notas dessa fase no working tree, rode `git status`, e pare.

## 5. Reporte final

```
FASE 4.5l — fix do race condition router pós-save (working tree, sem commit)

Diagnóstico:
  router.push() + router.refresh() em sequência síncrona causavam race
  condition no Next 16: dois RSC fetches conflitantes, um payload chegava
  malformado → fetchServerAction error.

Fixes aplicados:
  1. edit-assigned-program-client.tsx — removido router.refresh() redundante
     após router.push(). A rota destino já carrega dados frescos ao montar.
  2. page.tsx — adicionado console.error pra erros do Supabase no load.
     Não muda comportamento, mas dá visibilidade pra problemas futuros.

Round-trip esperado:
  - Save de drop-set → toast → URL muda pra /students/[id] → console limpo
  - F5 manual: dados preservados em modo Avançado

Mensagem de commit sugerida (não execute agora):
  fix(per-set): remove redundant router.refresh after save (race condition with push)

Arquivos modificados (working tree):
  web/src/components/programs/edit-assigned-program-client.tsx
  web/src/app/students/[id]/program/[programId]/edit/page.tsx
  mobile/specs/active/prescricao-per-set-manual.md (notas Fase 4.5l)

Validações:
  shared: 142/142
  web TS: 11 erros baseline (idêntico)
  web vitest: <X>/<X>
  mobile TS: 10 erros baseline
  mobile vitest: 255/255

Estado: working tree acumulando 4.5d-l. SEM commits, SEM push.
```

## 6. Edge cases

- **Se o erro persistir após o fix:** sinaliza que o root cause é outro. Provavelmente H1 (query `/students/[id]` falhando). Pede investigação focada nessa rota.
- **Outros lugares do código com `router.push() + router.refresh()` em sequência:** se você encontrar, aplica o mesmo padrão. Mas foco é o `saveProgram` em edit-assigned.

## 7. Iterar / desfazer

- Working tree: edita arquivos in-place.
- Voltar arquivo: `git checkout -- <arquivo>`.
- NÃO `git reset --hard origin/main`.

Tudo claro? Confirme com "Fase 4.5l — começando" e parta da pré-checagem.
