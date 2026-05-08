# Prompt para o Claude Code — Dashboard do Aluno · Onda 2 (Refatorações Médias)

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`). Use só **depois que a Onda 1 estiver commitada na branch `dashboard-aluno-redesign` e o walk-through manual estiver feito**. Não há merge para `main` entre as ondas — todas vivem na mesma branch e abrem PR única no final.

---

Leia e siga as seguintes specs, nesta ordem:

1. `docs/specs/dashboard-aluno-00-visao-geral.md` — decisões, invariantes e glossário. **Ler inteiro antes de qualquer coisa.**
2. `docs/specs/dashboard-aluno-02-onda-2-refatoracoes.md` — a onda que você vai executar nesta sessão.

Você **não** vai executar a Onda 3. Apenas a Onda 2.

## Antes de editar qualquer arquivo

Produza um **plano de execução** e aguarde minha aprovação. O plano deve ter:

- Lista ordenada dos 8 passos da spec com os arquivos a tocar e critério de pronto.
- Pontos de risco/ambiguidade — em particular:
  - como o `ProgramCalendar` aceita `initialWeekStart` hoje (se não existe, propor a interface).
  - como mapear `weekIndex` do sparkline para `Date` da semana correspondente do programa.
  - como o `BodyMetricsTrend` é importado/usado em outros lugares.
  - como tornar o `<ProgramComparisonCard compact>` reativo sem duplicar a lógica de fetch.
- Estratégia de testes (cobertura mínima da seção 4 da spec).
- Ordem em que você executará para manter o repo compilando entre passos (sugestão: criar `AdherenceTrendStrip` antes de mexer no `active-program-dashboard.tsx`; criar `HealthMetricsCard` em paralelo ao antigo, cutover por último).

Só comece a editar código **depois que eu aprovar o plano**. Se durante a execução descobrir algo que contraria o plano aprovado, pare e reporte antes de desviar.

## Regras para esta sessão

- **Não use git em nenhuma hipótese.** Sem `git add`, `commit`, `push`, `branch`, `checkout`, `stash`, `reset`, `restore`. Eu gerencio commits e PR. Para verificar baseline de erros de TS/teste, **não rode `git stash`** — em vez disso, rode `pnpm tsc --noEmit 2>&1 | grep <arquivo>` ou `pnpm test <arquivo>` em isolamento, ou compare contra o estado já commitado da branch via `git log --oneline -5` (apenas leitura, nunca mutar). Se a única forma de baselinar for via `stash`, **pare e reporte** — eu rodo manualmente.
- **Não faça refactor oportunista.** Lista de follow-ups vai pro log.
- **Respeite as invariantes da seção 3 do `dashboard-aluno-00-visao-geral.md`.** Em especial: nada de migração de schema, nada de bibliotecas novas, sem mudanças em `page.tsx` (queries).
- **`AssessmentSidebarCard`** não deve ser deletado nesta onda — só marcado como `@deprecated` e cortado dos imports do `student-detail-client.tsx`. Removeremos na Onda 3.
- **Estado da working tree** quando esta sessão começar: a Onda 1 está commitada na branch `dashboard-aluno-redesign`. Pode haver 2 arquivos pré-existentes em stash (`forms-dashboard-client.tsx`, `tour-definitions.ts`) — não os recupere nem mexa neles.
- **Se uma invariante estiver prestes a ser violada, pare e me avise.**

## Premissas do ambiente

- Repo `~/kinevo`. App web em `web/`.
- Gerenciador de pacotes do projeto.
- Mocks/stubs de Supabase em `__fixtures__/`.
- Strings user-facing pt-BR.

## Definição de "pronto"

- Checklist da seção 5 do `dashboard-aluno-02-onda-2-refatoracoes.md` marcado.
- `pnpm tsc --noEmit` verde.
- Suite de testes verde — incluindo os 3 arquivos de teste novos da seção 4 da spec.
- Walk-through manual documentado em `docs/specs/logs/dashboard-aluno-onda-2.md`.
- Follow-ups sugeridos no mesmo log (em particular: alimentar o mini bar chart do histórico com dados reais via nova action — provavelmente Onda 3 ou pós).

Comece produzindo o plano. Aguarde aprovação.
