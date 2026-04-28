# Workflow de Entrega — Kinevo

> **Documento normativo. Todo agente (Claude Code, Cowork, qualquer LLM) deve ler antes de iniciar trabalho de feature.**
> Última atualização: abril/2026.

## Contexto

O Kinevo é mantido pelo Gustavo, fundador não-desenvolvedor, trabalhando sozinho. Não há revisor humano. Todo `git push origin main` deploya automaticamente via Vercel (web) e está acessível a usuários reais imediatamente.

**Consequência prática:** push de commit intermediário sem a feature estar 100% pronta = bug em produção pra usuários reais. **Isso já aconteceu** — usuários experimentaram erros porque commits parciais foram empurrados antes da funcionalidade estar completa.

Este documento define o padrão pra evitar repetir esse erro.

## Regra de ouro

**Uma funcionalidade = um batch de commits + push no fim, autorizado explicitamente pelo Gustavo.**

Não há commits intermediários durante o desenvolvimento. O working tree acumula as mudanças. O Gustavo testa localmente. Quando ele autoriza ("commita tudo e dá push", "manda pro origin", etc.), **só aí** o agente:

1. Organiza os commits atômicos (1 por escopo lógico)
2. Faz `git push origin main`

## Definição de "funcionalidade pronta"

Uma funcionalidade só é considerada pronta quando **todas** as condições abaixo são satisfeitas:

- ✅ Código implementado em todas as superfícies necessárias (web, mobile, shared, edge functions, etc.)
- ✅ Validações locais passam sem regressão (`tsc --noEmit`, `vitest run` em cada workspace afetado)
- ✅ Gustavo testou visualmente em ambiente local (Next.js dev server, simulador iOS) e aprovou
- ✅ Migration aplicada via Supabase MCP, se houver, com autorização dele
- ✅ Edge Function deployada via MCP, se houver, com autorização dele

**Apenas o Gustavo decide quando uma funcionalidade está pronta.** Não autoassuma.

## Iteração durante desenvolvimento

Se o Gustavo pede ajustes:

- **Edita os arquivos in place no working tree.** Working tree é a fonte da verdade.
- Não use `git stash`, `git commit --amend`, ou commits "checkpoint" pra salvar progresso. Não é necessário.
- Se ele pedir pra "voltar atrás" num arquivo específico: `git checkout -- caminho/do/arquivo`.
- Se quiser comparar o estado atual com main: `git diff main -- arquivo` (sem alterar nada).

## Exceções permitidas

### Migration (Supabase)

Se a funcionalidade exige nova tabela/coluna:

- Aplica via Supabase MCP **assim que o Gustavo autorizar dentro da sessão**.
- O DDL chega no Supabase imediatamente, mas o código que usa o schema fica no working tree até o batch final.
- **Pré-requisito:** migration deve ser backward compatible (colunas nullable, defaults seguros) — aplicar sem o código novo NÃO pode quebrar produção.
- Mostra o SQL ao Gustavo antes de aplicar, espera "ok".

### Edge Function (Supabase)

Mesmo padrão da migration:

- Deploya via MCP quando o Gustavo autorizar.
- Edge Functions são versionadas no Supabase — deploy parcial não estraga produção desde que o cliente atual em produção continue funcionando com o shape antigo (compat de payload).
- Anuncia ao Gustavo antes de deployar, descrevendo a mudança.

## O que NUNCA fazer

- ❌ `git commit` durante implementação sem autorização explícita
- ❌ `git push` durante implementação
- ❌ `gh pr create` ou abrir PR (solo dev sem reviewer — fluxo é push direto autorizado)
- ❌ Configurar auto-merge ou branch protection sem autorização
- ❌ Refatorar código fora do escopo da funcionalidade ("já que estou aqui…")
- ❌ Adicionar/remover dependências do `package.json` sem autorização
- ❌ Mexer em CI, GitHub settings, configs de repo
- ❌ Tocar em `web/src/lib/prescription/` (motor de IA agentivo) — escopo protegido até decisão explícita

## O que SEMPRE fazer

- ✅ Ler este `WORKFLOW.md` + `CLAUDE.md` do workspace afetado no início da sessão
- ✅ Confirmar a tarefa numa frase curta antes de começar
- ✅ Usar `git status` periodicamente pra mostrar o estado do working tree
- ✅ Validar localmente antes de declarar tarefa pronta
- ✅ Documentar mensagens de commit sugeridas no prompt da fase (pra serem usadas no batch final)
- ✅ Reportar no formato padrão: o que foi feito no working tree, o que está pendente, o que precisa de autorização

## Padrão de commit (pra quando o batch final acontecer)

Quando o Gustavo autorizar push:

- Commits atômicos por escopo lógico (1 commit = 1 mudança coesa).
- Mensagens em inglês, formato Conventional Commits:
  - `feat(scope): ...` para novas features
  - `fix(scope): ...` para bug fixes
  - `docs(scope): ...` para alterações em docs/specs
  - `test(scope): ...` para mudanças exclusivas em testes
  - `chore(scope): ...` para infra (raro neste fluxo)
- O `scope` reflete a feature/módulo (ex.: `per-set`, `payments`, `auth`).
- Cada prompt de fase documenta as mensagens de commit sugeridas — use elas como base.

## Exceção: hotfix em produção

Se um bug **já em produção** precisa de correção urgente (não desenvolvimento de feature, mas correção de algo live e quebrado):

- Pula o batch final. Identifica → corrige → valida localmente → commita → push imediato.
- Mensagem `fix(scope): ...` com explicação clara.
- Reporta ao Gustavo o que foi corrigido.

Use isso só pra hotfix real, não pra "uma melhoria pequena" que pode esperar.

## Pre-merge checklist (antes de cada `git push`)

Quando o Gustavo autorizar o push do batch final, **antes** de empurrar:

```bash
# 1. Pull rebase pra absorver qualquer commit que tenha aterrissado em main
git pull --rebase origin main

# 2. Re-validar TUDO após rebase
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web    && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..

# 3. Confirmar com git status que o working tree está limpo (já commitou tudo)
git status

# 4. Confirmar lista de commits que vão pro origin
git log origin/main..HEAD --oneline

# 5. Push
git push origin main
```

Se algo no passo 2 falhar (erro novo introduzido pelo rebase), PARA e reporta. Não empurra código quebrado.
