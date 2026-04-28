# Prompt Claude Code — Fase 4.5k: Fix do hydration mismatch no painel da biblioteca

> Cole numa nova sessão do Claude Code. **Workflow:** apenas modificações no working tree. **NÃO faça `git commit` nem `git push`.** Working tree continua acumulando.
>
> Releia `mobile/specs/WORKFLOW.md` antes de começar.

---

**Bug confirmado pelo Gustavo:** console mostra hydration mismatch no painel da biblioteca de exercícios:

```
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.
...
+ title="Expandir biblioteca"     (client)
- title="Minimizar biblioteca"    (server)
```

Stack aponta pra `edit-assigned-program-client.tsx:1589` (`<div className="bg-white dark:bg-surface-primary flex flex-col flex-shrink-0 transition-a...">`).

**Causa:** o estado `libraryCollapsed` (ou similar) é inicializado lendo `localStorage` no momento do render inicial. Server-side não tem `localStorage` → renderiza com default (provavelmente `false` = expandida). Client lê `localStorage` e descobre que estava `true` (recolhida) → mismatch.

**Bug A** (server action error) **NÃO existe** — confirmado como glitch one-time de cache do dev server. Esta fase trata APENAS Bug B.

## 0. Pré-checagens

```bash
git status        # working tree atual com 4.5d-i acumuladas
```

## 1. Localizar o estado e a inicialização

```bash
grep -n "libraryCollapsed\|isLibrary\|toggleLibrary\|localStorage.*library\|kinevo_library\|libraryOpen" web/src/components/programs/edit-assigned-program-client.tsx web/src/components/programs/program-builder-client.tsx
```

Provavelmente vai encontrar algo tipo:

```ts
// PADRÃO ERRADO
const [libraryCollapsed, setLibraryCollapsed] = useState(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('kinevo_library_collapsed') === 'true'
  }
  return false
})
```

Esse padrão (lazy init com `typeof window !== 'undefined'`) é o que causa o mismatch. Server retorna `false`, client retorna o que está no storage.

## 2. Aplicar fix nos 2 arquivos (mesma lógica em ambos)

Substitui o padrão por:

```ts
// PADRÃO CERTO
const [libraryCollapsed, setLibraryCollapsed] = useState(false)  // sempre default no SSR

useEffect(() => {
  // Hidrata do localStorage SÓ no client, depois do mount
  const stored = localStorage.getItem('kinevo_library_collapsed')
  if (stored === 'true') {
    setLibraryCollapsed(true)
  }
}, [])

// Persistir mudanças (mantém comportamento atual)
useEffect(() => {
  localStorage.setItem('kinevo_library_collapsed', String(libraryCollapsed))
}, [libraryCollapsed])
```

**Alternativa válida** (se quiser evitar o "flash" visual de expandida → recolhida no primeiro render):
- Usa `suppressHydrationWarning` no `<div>` raiz do painel (linha ~1589 de edit-assigned-program-client.tsx)
- Mantém o lazy init do `useState`
- Custo: warning some, mas o flash visual existe (~50ms)

**Recomendação:** vai com a primeira opção (useEffect). Sem flash visível porque o transição animada do panel mascara o ajuste. E é o padrão correto pro Next.js App Router.

## 3. Aplicar nos arquivos relevantes

Aplica o fix em **todos os arquivos que tenham esse padrão**, especialmente:

- `web/src/components/programs/edit-assigned-program-client.tsx` (afetado, confirmado pelo stack trace)
- `web/src/components/programs/program-builder-client.tsx` (provavelmente tem o mesmo padrão pra paridade)

Se houver outros componentes com `localStorage` lido no render inicial (sidebar, theme, etc.), avalia caso a caso. Foco principal é o painel da biblioteca.

## 4. Validações locais

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Mantém baselines.

## 5. Validação visual (peça pro Gustavo testar)

1. Abre `/students/[id]/program/[programId]/edit` com biblioteca recolhida (deve estar recolhida pelo localStorage anterior).
2. Abre DevTools → Console.
3. Recarrega a página (F5).
4. **Não deve aparecer** o erro `A tree hydrated but some attributes...`.
5. Painel da biblioteca deve continuar respeitando a preferência salva (recolhida no caso).

## 6. NÃO commita, NÃO empurra

Atualize a spec com notas dessa fase no working tree, rode `git status`, e pare.

## 7. Reporte final

```
FASE 4.5k — fix do hydration mismatch no painel da biblioteca (working tree, sem commit)

Diagnóstico:
  Estado libraryCollapsed inicializado via localStorage no render inicial.
  Server retorna default (false), client retorna valor salvo → mismatch React.

Fix aplicado:
  - useState com default fixo (false) — funciona em SSR
  - useEffect pós-mount lê localStorage e atualiza estado
  - useEffect separado persiste mudanças no localStorage

Arquivos modificados (working tree):
  web/src/components/programs/edit-assigned-program-client.tsx
  web/src/components/programs/program-builder-client.tsx (se aplicável)
  mobile/specs/active/prescricao-per-set-manual.md (notas Fase 4.5k)

Validações:
  shared: 142/142
  web TS: 11 erros baseline (idêntico)
  web vitest: <X>/<X>
  mobile TS: 10 erros baseline
  mobile vitest: 255/255

Mensagem de commit sugerida (não execute agora):
  fix(per-set): resolve hydration mismatch on collapsible library panel

Estado: working tree acumulando 4.5d-k. SEM commits, SEM push.
```

## 8. Edge cases

- **Outros estados com mesmo bug**: se você encontrar mais lugares lendo localStorage no render inicial (theme, sidebar, etc.), aplique o mesmo padrão. Mas foque no library panel — esse é o reportado.
- **Flash visual** (panel "pisca" expandida → recolhida): se aparecer e incomodar, considera adicionar uma classe CSS `opacity-0` no panel até o `useEffect` rodar. Mas só se realmente piscar — pode não ser perceptível por causa da transição.

## 9. Iterar / desfazer

- Working tree: edita arquivos in-place.
- Voltar arquivo: `git checkout -- <arquivo>`.
- NÃO `git reset --hard origin/main`.

Tudo claro? Confirme com "Fase 4.5k — começando" e parta da pré-checagem.
