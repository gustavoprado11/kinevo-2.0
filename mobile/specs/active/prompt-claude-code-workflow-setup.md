# Prompt para o Claude Code — Setup de Workflow para Agilizar Entrega

> Cole este prompt inteiro numa nova sessão do Claude Code dentro do repositório `kinevo-monorepo`. Ele executa toda a configuração de workflow (CI, permissões, prompts atualizados, auto-merge, PR) de uma vez. Saída esperada: 1 PR aberto em `main`, doc/config-only.

---

Você vai configurar a infraestrutura de workflow do monorepo Kinevo pra reduzir fricção no desenvolvimento. Não há código de feature nesta tarefa — só CI, docs de execução, e permissões de agente. O dono do repo (Gustavo) acabou de instalar `gh` CLI e quer que daqui pra frente os agentes (você inclusive) fechem PRs end-to-end sem ele ter que clicar em links.

**Saída esperada:** branch `chore/workflow-setup`, ~5 arquivos novos/editados, PR aberto em `main` com auto-merge ativado se passar o CI próprio. Doc/config-only.

## 0. Pré-checagens (obrigatório, falha alto se não passar)

Rode em ordem. Se qualquer um falhar, PARE e reporte:

```bash
# 1. gh autenticado
gh auth status
# Esperado: "Logged in to github.com account gustavoprado11..."
# Se falhar, abortar com mensagem: "Rode `gh auth login` antes."

# 2. Repo default configurado
gh repo set-default gustavoprado11/kinevo-2.0

# 3. Working tree limpo OU stray modifications conhecidas
git status --short
# Se houver `M web/src/components/dashboard/quick-actions.tsx` ou
# `M mobile/components/trainer/students/AddStudentModal.tsx` ou
# `M web/src/lib/welcome-message.ts`, FAÇA stash:
git stash push -m "stray-app-links-redo" -- \
    web/src/components/dashboard/quick-actions.tsx \
    mobile/components/trainer/students/AddStudentModal.tsx \
    web/src/lib/welcome-message.ts 2>/dev/null || true
# Outras modificações: PARE e reporte.

# 4. Confirmar que estamos partindo de main atualizada
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b chore/workflow-setup
```

Se tudo passar, diga numa frase: "Pré-checagens ok, vou criar os arquivos." e siga.

## 1. Criar `.github/workflows/ci.yml`

Crie o arquivo com EXATAMENTE este conteúdo:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  shared:
    name: shared (tsc + vitest)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: cd shared && npx tsc --noEmit
      - run: cd shared && npx vitest run

  web:
    name: web (tsc + vitest)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: cd web && npx tsc --noEmit
      - run: cd web && npx vitest run

  mobile:
    name: mobile (tsc + vitest)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: cd mobile && npx tsc --noEmit
      - run: cd mobile && npx vitest run
```

Notas:
- Os 3 jobs rodam em paralelo.
- `concurrency` cancela runs antigos quando você empurra commit novo.
- **Não inclua** lint nem build do Next/Expo nesta primeira versão — começamos lean. Se o `tsc/vitest` provar que pega regressões, expandimos depois.

## 2. Atualizar `mobile/CLAUDE.md` — adicionar seção "Execução Autônoma"

Adicione a seção abaixo **no final** do arquivo (após a última seção atual), separada por `---`:

```markdown
---

## Execução Autônoma (agentes)

Esta seção define o que agentes (Claude Code, Cowork, qualquer LLM) podem fazer
sem confirmar com Gustavo a cada passo.

### Permitido sem confirmar

- `git add`, `git commit`, `git push` em branches `feat/*`, `fix/*`, `chore/*`, `docs/*`.
- `gh pr create --fill --body-file <arquivo>` quando há body preparado.
- `gh pr merge --auto --squash` SOMENTE em PRs que satisfaçam todas estas condições:
  - PR é doc-only (`docs/*`) OU test-only (apenas arquivos `**/*.test.ts(x)` e `**/__tests__/**`).
  - CI verde.
  - Sem reviewers humanos pendentes.
- Rodar testes (`npx vitest run`, `npx tsc --noEmit`) e linters localmente.
- Criar/atualizar arquivos em `mobile/specs/active/`.
- Stash de arquivos não relacionados ao escopo da tarefa (com nome descritivo).

### Sempre parar e perguntar antes

- Merge de PR de feature (`feat/*`) — mesmo com CI verde, espera Gustavo aprovar.
- Push para `main` direto (qualquer push direto pra main exige confirmação).
- `git rebase` interativo, `git reset --hard`, `git push --force` em branch
  compartilhada.
- Mudanças em `supabase/migrations/*.sql` aplicadas em produção.
- Adicionar/remover dependências do `package.json` (npm install/uninstall).
- Mudanças em CI, GitHub settings, ou `.github/`.
- Alterações em `CLAUDE.md` (esta seção inclusa).
- Qualquer mudança que afete `web/src/lib/prescription/` (motor de IA — protegido).

### Convenção de PR body

PR de feature/fase: usar template em `mobile/specs/active/<spec>.md` como base.
PR doc/test-only: pode ser `gh pr create --fill` (usa título + descrição do commit).
PR chore: descrição curta apontando o que mudou e por quê.
```

## 3. Atualizar `web/CLAUDE.md` — adicionar a MESMA seção

Cole a mesma seção "Execução Autônoma" no final de `web/CLAUDE.md`, com um único ajuste de path: troque `mobile/specs/active/` por `mobile/specs/active/` (mantém igual — specs vivem só em mobile/specs por convenção do repo).

## 4. Atualizar `mobile/specs/active/prompts-fases-2-a-5.md`

Localize a seção "## Lembretes gerais (todas as fases)" no fim do arquivo. **Antes** dela, adicione esta nova seção:

```markdown
## Como fechar cada fase (CI + PR + auto-merge)

Ao completar os critérios de aceite da fase, execute:

```bash
# 1. Garantir CI verde localmente
cd shared && npx tsc --noEmit && npx vitest run
cd web    && npx tsc --noEmit && npx vitest run
cd mobile && npx tsc --noEmit && npx vitest run

# 2. Commits lógicos (já listados no prompt da fase)
git add <arquivos>
git commit -m "..."
# ...
git push -u origin feat/per-set-fase-N-<area>

# 3. Abrir PR. Use o body abaixo como base, ajustando.
gh pr create \
  --base main \
  --head feat/per-set-fase-N-<area> \
  --title "feat(per-set): Fase N — <Área>" \
  --body-file /tmp/pr-body-fase-N.md

# 4. Auto-merge SE for fase doc-only (não é o caso das Fases 2-5).
# Para Fases 2-5 (feature), NÃO fazer auto-merge. Esperar aprovação.
```

Body template (`/tmp/pr-body-fase-N.md`):

```markdown
Implementa Fase N da spec [prescricao-per-set-manual.md](mobile/specs/active/prescricao-per-set-manual.md).

## Mudanças
(listar arquivos tocados, agrupados por área)

## Critérios de aceite
Ver "Critérios de Aceite → Fase N" da spec — todos marcados como [x] no commit final desta PR.

## Como testar
(passo a passo manual)

## Pré-requisitos para merge
- CI verde
- Aprovação do Gustavo
```
```

## 5. Configurar branch protection e auto-merge no GitHub

Rode:

```bash
# Habilitar auto-merge no repo (necessário pra `gh pr merge --auto` funcionar)
gh api -X PATCH repos/gustavoprado11/kinevo-2.0 \
  -f allow_auto_merge=true \
  -f allow_squash_merge=true \
  -f delete_branch_on_merge=true

# Branch protection em `main` exigindo CI verde (sem exigir review — Gustavo
# trabalha sozinho e revisa quando quer)
gh api -X PUT repos/gustavoprado11/kinevo-2.0/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["shared (tsc + vitest)", "web (tsc + vitest)", "mobile (tsc + vitest)"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

Se algum desses comandos falhar com erro de permissão (404/403), reporte mas não aborte — o resto do PR ainda vale. Gustavo pode rodar manualmente depois.

**Importante:** os 3 contexts (`shared (tsc + vitest)` etc.) são EXATAMENTE os `name:` dos jobs no `ci.yml`. Se você renomeou os jobs, ajuste aqui.

## 6. Commit + PR

```bash
git add .github/workflows/ci.yml \
        mobile/CLAUDE.md \
        web/CLAUDE.md \
        mobile/specs/active/prompts-fases-2-a-5.md
git commit -m "chore(workflow): add CI, agent permissions, and PR templates

- .github/workflows/ci.yml: tsc + vitest for shared/web/mobile in parallel
- CLAUDE.md (mobile + web): 'Execução Autônoma' section defining
  what agents can do without confirmation
- prompts-fases-2-a-5.md: add 'Como fechar cada fase' section with
  gh pr create flow

Repo settings (auto-merge, branch protection) applied via gh api."

git push -u origin chore/workflow-setup

# Abrir PR
gh pr create \
  --base main \
  --title "chore(workflow): CI, agent permissions, PR templates" \
  --body "Setup de workflow pra reduzir fricção no desenvolvimento.

## Mudanças

- **CI** (\`.github/workflows/ci.yml\`): 3 jobs em paralelo (shared, web, mobile)
  rodando \`tsc --noEmit\` + \`vitest run\`. Concurrency cancela runs antigos.
- **\`CLAUDE.md\` (mobile + web)**: nova seção 'Execução Autônoma' definindo o
  que agentes podem fazer sem confirmação. Auto-merge permitido só pra PRs
  doc/test-only com CI verde.
- **\`prompts-fases-2-a-5.md\`**: adiciona seção 'Como fechar cada fase' com
  fluxo via \`gh pr create\` e template de body.

## Repo settings aplicadas via \`gh api\`

- \`allow_auto_merge: true\`
- \`allow_squash_merge: true\`
- \`delete_branch_on_merge: true\`
- Branch protection em \`main\`: exige CI verde (3 contexts), sem PR review
  obrigatório.

## Como testar

PR em si valida o CI: se os 3 jobs ficarem verdes, está funcionando.
Permissões de agente passam a valer assim que isto mergear em main.

## Auto-merge

Este PR é doc/config-only e seguro pra auto-merge. Vou ativar:

\`\`\`bash
gh pr merge --auto --squash
\`\`\`"

# Auto-merge: este PR é doc/config-only, então pode auto-mergear
PR_NUMBER=$(gh pr view --json number -q .number)
gh pr merge $PR_NUMBER --auto --squash
```

## 7. Reporte final

Ao terminar, imprima EXATAMENTE este formato:

```
WORKFLOW SETUP — completo

PR: <link da PR>
Auto-merge: ativado (vai mergear quando CI passar)

Próximos passos do Gustavo:
1. Acompanhar CI em <link>
2. Quando mergear, qualquer agente já pode usar gh pr create / gh pr merge --auto
   conforme regras em CLAUDE.md → "Execução Autônoma"
3. Se quiser desfazer alguma config de repo, rodar: <comando reverso>

Stash criado: stray-app-links-redo (recuperar quando for trabalhar em PR separado:
git stash list  →  git stash pop)
```

## 8. Se algo falhar

- **gh não autenticado**: pare na pré-checagem e oriente Gustavo a rodar `gh auth login`.
- **Branch protection falha (403)**: provavelmente é repo plan free com proteção limitada. Reporte mas continue — settings podem ser aplicadas via UI depois.
- **CI workflow falhar no primeiro run** (problema de `npm ci` por exemplo): NÃO faça auto-merge. Investigue, corrija, push novo commit. Se não conseguir resolver em 10 minutos, reporta pra Gustavo com o log do erro.
- **Conflito ao stashar**: pare e reporte o que tem na working tree.

Tudo claro? Confirme com "Setup workflow — começando" e parta da pré-checagem.
