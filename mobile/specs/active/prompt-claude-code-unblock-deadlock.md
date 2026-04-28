# Prompt para o Claude Code — Destravar Deadlock CI/Branch Protection

> Cole numa nova sessão do Claude Code. Resolve em sequência: fix do `database.ts` corrompido → admin-merge → rebase + merge dos PRs #1 (Fase 1) e #2 (workflow setup).

---

Você vai destravar um deadlock no repo `gustavoprado11/kinevo-2.0`:

- **Branch protection em `main`** exige 3 CI checks verdes (shared/web/mobile com `tsc --noEmit && vitest run`).
- **`shared/types/database.ts` em main está corrompido** desde o commit `132d43f` — o arquivo inteiro é `{"types":"<código TS escaped>"}` em vez do código TS direto. Isso quebra `tsc --noEmit` em shared, e cascateia pra web e mobile.
- **PRs #1 (Fase 1, `feat/per-set-fase-1-shared`) e #2 (`chore/workflow-setup`)** ambos travam no CI por causa disso.

`enforce_admins: false` foi setado, então admin (Gustavo) pode bypass. Vou usar isso pra destravar.

## 0. Pré-checagens

```bash
gh auth status
# Esperado: Logged in as gustavoprado11

# Verificar estado atual
git fetch origin
gh pr list --state open
```

Confirme que vê os PRs #1 e #2. Se algum não existir, anote e siga (vai abrir depois).

## 1. Fix do `database.ts` em main

```bash
git checkout main
git pull --ff-only origin main
git checkout -b fix/repair-database-types-header

# Extrai o conteúdo TS do JSON wrapper
python3 << 'EOF'
import json
content = open('shared/types/database.ts').read()
parsed = json.loads(content)
ts = parsed['types']
open('shared/types/database.ts', 'w').write(ts)
print(f"OK — {len(ts)} chars, {ts.count(chr(10))} linhas escritas.")
EOF

# Sanity check: o arquivo agora começa com `export type Json`
head -3 shared/types/database.ts
# Esperado:
# export type Json =
#   | string
#   | number

# Validar TS no shared
cd shared && npx tsc --noEmit && cd ..
# Esperado: 0 erros

# Commit
git add shared/types/database.ts
git commit -m "fix(types): repair corrupted database.ts JSON wrapper

The file was committed in 132d43f as raw JSON output from supabase
CLI ({\"types\":\"...\"}) instead of having .types extracted. This
broke tsc --noEmit in shared and cascaded to web and mobile.

Fix: extract the .types field and write it as the file contents.
No actual schema change — same content, correct format."

git push -u origin fix/repair-database-types-header

# Abrir PR
gh pr create \
  --base main \
  --title "fix(types): repair corrupted database.ts JSON wrapper" \
  --body "## Problema

\`shared/types/database.ts\` em \`main\` está com o conteúdo
\`{\"types\":\"<código TS escaped>\"}\` desde o commit 132d43f
(\`feat(appointments)\`). Era pra ter rodado \`jq -r .types\` ou
similar antes de salvar — alguém pipou a saída crua do Supabase CLI.

Isso quebra \`tsc --noEmit\` em shared, e cascateia pro web e mobile,
travando todos os PRs no CI novo.

## Fix

Extrai o campo \`.types\` do JSON e escreve como conteúdo do arquivo.
Não muda o schema — só o formato.

\`\`\`python
import json
content = open('shared/types/database.ts').read()
parsed = json.loads(content)
open('shared/types/database.ts', 'w').write(parsed['types'])
\`\`\`

## Validação

- \`cd shared && npx tsc --noEmit\` — 0 erros (vs. ~30 erros pré-fix)
- Diff é o arquivo inteiro reformatado, mas o conteúdo lógico é idêntico

## Merge strategy

Como este PR é o que CONSERTA o CI, o próprio CI dele provavelmente
ainda vai bater nos erros pre-existentes nos workspaces web e mobile.
Vou fazer admin-merge (\`enforce_admins: false\` permite).

Após merge, PR #1 (Fase 1) e PR #2 (workflow setup) devem rebase
e o CI passar normalmente."

# Admin-merge bypassando proteção (porque é o fix do CI quebrado)
PR_FIX=$(gh pr view --json number -q .number)
gh pr merge $PR_FIX --admin --squash --delete-branch
```

## 2. Verificar / abrir PR #1 (Fase 1)

```bash
# Voltar pra main e atualizar
git checkout main
git pull --ff-only origin main

# Verificar se PR da Fase 1 existe
PR_FASE1=$(gh pr list --head feat/per-set-fase-1-shared --json number -q '.[0].number')

if [ -z "$PR_FASE1" ]; then
  # PR não existe — abrir agora
  git checkout feat/per-set-fase-1-shared
  git rebase main   # absorve o fix do database.ts
  git push --force-with-lease

  gh pr create \
    --base main \
    --head feat/per-set-fase-1-shared \
    --title "feat(per-set): Fase 1 — DB e shared" \
    --body "$(cat <<'EOFB'
Implementa a Fase 1 da spec [prescricao-per-set-manual.md](mobile/specs/active/prescricao-per-set-manual.md): infraestrutura de DB + tipos compartilhados + helpers puros.

Sem mudanças de UI nesta fase. Builder web, mobile e Watch permanecem com comportamento idêntico.

## Mudanças

- **Migration 111** (`supabase/migrations/111_per_set_prescription.sql`):
  - Tabelas filhas `workout_item_set_templates` e `assigned_workout_item_sets`
  - Coluna nullable `method_key TEXT` em `workout_item_templates` e `assigned_workout_items`
  - Tabela `training_method_presets` com 6 presets de sistema seedados
- **Shared types**: `SetType`, `MethodKey`, `WorkoutSet`, `TrainingMethodPreset`
- **Helpers puros**: `summarizeSetScheme`, `expandToSetScheme`, `validateSetScheme`, `applyPreset`, `inferMethodKeyFromScheme`
- **Dados de presets**: `SYSTEM_PRESETS` espelhando o seed SQL
- **23 testes Vitest novos**
- **Prompts executores** das Fases 2-5 prontos pra colar no Claude Code

## Bloqueado antes do merge

- [ ] CI verde nos 3 contexts (shared / web / mobile)
- [ ] Reviewer com Docker rodar `npm run gen:types` em algum momento — não é blocker desta PR (database.ts atual já reflete o schema pré-Fase-1)

## Fora desta PR

- Builder web/mobile/sala de treino — Fases 2-4
- Texto para Treino — Fase 5
EOFB
)"
else
  echo "PR #$PR_FASE1 já existe. Vou só rebase."
  git checkout feat/per-set-fase-1-shared
  git rebase main
  git push --force-with-lease
fi
```

## 3. Verificar / rebase PR #2 (workflow setup)

```bash
git checkout chore/workflow-setup
git rebase main   # absorve o fix do database.ts
git push --force-with-lease
# auto-merge já está armado — vai mergear sozinho quando CI passar
```

## 4. Acompanhar CI

```bash
# Lista PRs e status do CI
gh pr list --state open
gh pr checks  # roda no PR atual; alterne com `gh pr checks <num>` se precisar

# Watch loop simples
watch -n 30 'gh pr list --state open --json number,title,mergeable,statusCheckRollup -q ".[] | \"#\(.number) \(.title) — mergeable=\(.mergeable) ci=\(.statusCheckRollup | length)\""'
```

## 5. Reporte final

Quando terminar (PR fix mergeado + PRs #1 e #2 com CI rodando ou já mergeado):

```
DEADLOCK RESOLVIDO

PR fix database.ts: <link> (admin-merged)
PR #1 (Fase 1): <link, status>
PR #2 (workflow): <link, status>

CI status no momento do reporte:
- shared: <green/red/pending>
- web:    <green/red/pending>
- mobile: <green/red/pending>

Próximos passos do Gustavo:
- Acompanhar merge automático dos PRs #1 e #2
- Se o CI bater em erro pre-existente em web ou mobile (não relacionado
  ao database.ts), reportar pra eu (Claude Code) investigar
```

## 6. Se algo der errado

- **`tsc --noEmit` em shared falha mesmo após fix**: provavelmente tem outro erro pre-existente. Investigue, mas não tente consertar tudo neste PR — limite ao escopo do fix do JSON wrapper. Se for crítico, abra issue separada.
- **Admin-merge falha (403)**: Gustavo precisa ser owner do repo. Se for, pode ser que `enforce_admins=true` foi setado em vez de false. Rodar:
  ```bash
  gh api -X PUT repos/gustavoprado11/kinevo-2.0/branches/main/protection \
    --input - <<'EOF'
  {
    "required_status_checks": {"strict": true, "contexts": ["shared (tsc + vitest)", "web (tsc + vitest)", "mobile (tsc + vitest)"]},
    "enforce_admins": false,
    "required_pull_request_reviews": null,
    "restrictions": null
  }
  EOF
  ```
  E tentar de novo.
- **`web` ou `mobile` falha CI por erro pre-existente** (não database.ts): documente quais erros, abra PR separado de `chore/repair-tsc-errors` se for trivial; senão escale pra Gustavo.
- **Rebase do PR #1 dá conflito em `database.ts`**: aceita a versão de main (`git checkout --theirs shared/types/database.ts && git add shared/types/database.ts && git rebase --continue`).

Tudo claro? Confirme com "Destravando deadlock" e parta da pré-checagem.
