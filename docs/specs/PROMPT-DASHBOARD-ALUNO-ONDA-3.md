# Prompt para o Claude Code — Dashboard do Aluno · Onda 3 (Estruturais)

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`). Use só **depois que as Ondas 1 e 2 estiverem commitadas na branch `dashboard-aluno-redesign` e o walk-through manual de cada uma estiver feito**. Esta é a última onda — PR única abre quando ela terminar. Sem merge para `main` entre ondas.

---

Leia e siga as seguintes specs, nesta ordem:

1. `docs/specs/dashboard-aluno-00-visao-geral.md` — decisões, invariantes e glossário. **Ler inteiro antes de qualquer coisa.**
2. `docs/specs/dashboard-aluno-03-onda-3-estruturais.md` — a onda que você vai executar nesta sessão.

Esta é a última onda. Não há onda 4.

## Antes de editar qualquer arquivo

Produza um **plano de execução** e aguarde minha aprovação. O plano deve ter:

- Lista ordenada dos 7 passos com arquivos a tocar e critério de pronto.
- Pontos de risco/ambiguidade — em particular:
  - **onde a engine de geração de insights vive hoje** (`web/src/lib/insights/...`? `web/src/actions/...`? buscar com `rg "assistant_insights" web/src` e listar os pontos de `INSERT`).
  - **como `insight_key` é gerada hoje** — se for aleatória ou contém timestamps, o upsert por chave **não funciona** sem ajuste prévio. Reportar antes.
  - como integrar o `SmartBanner` com o banner amarelo de "Reavaliação pendente" do `HealthMetricsCard` (Onda 2) sem duplicar visualmente.
  - se há infra de telemetria (`rg "track\\(" web/src/lib`); se não, deixar stub e TODO.
  - se outros lugares no projeto usam `StudentStatusBar` em modo `full` (`rg "StudentStatusBar" web/`).
- Estratégia de testes (cobertura mínima da seção 4 da spec, incluindo os mocks de Supabase para o teste de upsert).
- Ordem em que você executará para manter o repo compilando entre passos (sugestão: regras puras → componente → wire-up → engine → status bar enxuta → atalhos → telemetria).

Só comece a editar código **depois que eu aprovar o plano**. Se durante a execução descobrir algo que contraria o plano aprovado, pare e reporte antes de desviar.

## Regras para esta sessão

- **Não use git em nenhuma hipótese.** Sem `git add`, `commit`, `push`, `branch`, `checkout`, `stash`, `reset`, `restore`. Eu gerencio commits e PR. Para verificar baseline de erros de TS/teste, **não rode `git stash`** — em vez disso, rode `pnpm tsc --noEmit 2>&1 | grep <arquivo>` ou `pnpm test <arquivo>` em isolamento, ou compare contra o estado já commitado da branch via `git log --oneline -5` (apenas leitura). Se a única forma de baselinar for via `stash`, **pare e reporte**.
- **Não faça refactor oportunista.** Lista de follow-ups vai pro log.
- **Respeite as invariantes da seção 3 do `dashboard-aluno-00-visao-geral.md`.** Em especial: **nenhuma migração de schema** — a coluna `insight_key` em `assistant_insights` já existe.
- **Se a engine atual gerar `insight_key` instáveis** (com timestamps, UUIDs, etc.), pare e reporte antes de prosseguir. O upsert por chave depende da estabilidade do identificador.
- **`AssessmentSidebarCard`** pode ser deletado no fim desta onda **se** `rg "AssessmentSidebarCard"` retornar zero imports.
- **Estado da working tree** quando esta sessão começar: Ondas 1 e 2 estão commitadas na branch `dashboard-aluno-redesign`. Pode haver 2 arquivos pré-existentes em stash (`forms-dashboard-client.tsx`, `tour-definitions.ts`) — não os recupere.
- **Se uma invariante estiver prestes a ser violada, pare e me avise.**

## Premissas do ambiente

- Repo `~/kinevo`. App web em `web/`.
- Mocks de Supabase para o teste de upsert: usar fixtures existentes ou criar em `web/src/actions/__fixtures__/insights.ts`.
- Strings user-facing pt-BR.

## Definição de "pronto"

- Checklist da seção 5 do `dashboard-aluno-03-onda-3-estruturais.md` marcado.
- `pnpm tsc --noEmit` verde.
- Suite de testes verde — incluindo os 3 arquivos de teste novos (`smart-banner-rules.test.ts`, `smart-banner.test.tsx`, `insights-upsert.test.ts`) e o ajuste em `student-status-bar.test.tsx`.
- Walk-through manual documentado em `docs/specs/logs/dashboard-aluno-onda-3.md` cobrindo:
  - cenário de aluno com 20+ dias sem treinar → banner crítico.
  - cenário de aluno saudável → banner não aparece.
  - rodando engine de insights duas vezes → registros não duplicam para mesma chave em <7 d.
  - atalhos M/L/P funcionando.
- Follow-ups sugeridos no log.

Comece produzindo o plano. Aguarde aprovação.
