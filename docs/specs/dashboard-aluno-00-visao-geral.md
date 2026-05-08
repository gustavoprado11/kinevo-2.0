# Specs — Redesign do Dashboard do Aluno

**Leia isto primeiro.** Este arquivo define contexto, decisões já tomadas, invariantes que valem para todas as ondas, e a ordem sugerida de execução. Cada onda tem seu próprio arquivo com spec executiva para o Claude Code.

---

## 1. Contexto rápido

A tela `/students/[id]` é o "command center" do treinador para um aluno específico. Hoje ela renderiza informação rica mas com 3 problemas estruturais:

1. **Mesma informação aparece em 2–4 lugares** (`0/5 esta semana`, `há 20 dias`, `Sem treino há N dias`, `Programa em 50%`, `Avaliações pendentes`).
2. **Engine de insights não deduplica**: cada execução cria um novo registro para o mesmo evento, gerando filas tipo "sem treino há 19 dias / 18 dias / 13 dias".
3. **Hierarquia visual fraca**: 10+ cards empilhados sem priorização — o treinador não sabe o que fazer primeiro ao abrir a tela.

A análise completa, com benchmarks e mockups, está em `Kinevo - Análise UX-UI Dashboard do Aluno.docx` (raiz do repo). O mockup interativo em `Kinevo - Mockup Redesign Dashboard Aluno.html`.

## 2. Decisões já tomadas (não revisar)

As decisões abaixo foram aprovadas pelo Gustavo em 08/mai/2026 e são premissa de todas as specs:

1. **Calendário continua sendo o componente principal** do bloco de programa ativo. NÃO foi escolhido substituí-lo por heatmap — o calendário é familiar e responde direto às duas perguntas reais do treinador no dia a dia ("qual o treino de hoje?" e "o aluno fez?"). Só removemos as métricas duplicadas dele e adicionamos uma faixa fina de tendência acima.
2. **Smart Banner novo**, com lógica de prioridade explícita (`critical > high > info`) e no máximo 1 banner visível. Substitui a barra de chips do header e o card "Próximos Programas" competindo por atenção.
3. **Insights deduplicados por `insight_key` + janela de 7 dias.** A coluna `insight_key` JÁ EXISTE na tabela `assistant_insights` — não há migração de schema. A engine passa a fazer `upsert` em vez de `insert`.
4. **Header expandido** com `objective` e `management_tags` visíveis (campos já existem na tabela `students` e já são fetched em `page.tsx`).
5. **Saúde & métricas unificada**: o `AssessmentSidebarCard` (avaliações) e o `BodyMetricsTrend` (peso/% gordura) viram um único card.
6. **Histórico de programas em timeline horizontal** com mini-gráfico de volume por semana (substitui os cards verticais grandes).

## 3. Invariantes que valem para todas as ondas

Todas as specs respeitam as regras abaixo — se alguma onda parecer violar, **pare e reporte antes de executar**:

1. **Sem migração de schema de banco em nenhuma onda.** Schemas atuais (`students`, `assigned_programs`, `assistant_insights`, `form_submissions`, etc.) permanecem como estão. Onda 3 mexe na lógica de `assistant_insights` mas não no schema.
2. **Nada de refactor "while we're at it".** Se encontrar código feio vizinho ao que precisa mudar, deixe como está e registre num `follow-ups sugeridos` no log de execução.
3. **Preserve o comportamento funcional**. Toda ação que existe hoje no dashboard (Editar programa, Trocar, Concluir, Prorrogar, Atribuir, Agendar, Enviar mensagem, Reset de senha, etc.) tem que continuar funcionando exatamente igual.
4. **Stack já definida.** Use o que o projeto já usa: Tailwind, `lucide-react` (ícones), Server Actions com `'use server'` retornando `{ success, data?, error? }`, Supabase client de `@/lib/supabase/server`, Vitest + `@testing-library/react` para testes, store Zustand quando aplicável. **Não introduzir bibliotecas novas.**
5. **Strings user-facing em pt-BR**; comentários e nomes técnicos em inglês ou pt-BR seguindo o padrão do projeto (ambos coexistem).
6. **i18n.** Não introduzir biblioteca de i18n. Strings literais como hoje.
7. **Telemetria.** Onde a spec pedir tracking, use a função `track()` do `@/lib/analytics` (se existir) ou siga o padrão atual do projeto. Se não houver infra, deixe um TODO bem visível e não introduza biblioteca nova.
8. **Tests.** Toda onda entrega testes co-localizados em `__tests__/` ao lado do componente, com Vitest + RTL. Componentes com lógica não-trivial precisam de teste; pure UI passa.
9. **Sem mudanças no app mobile.** Estas specs são exclusivamente do `web/`. O dashboard mobile do treinador, se houver tela equivalente, fica fora de escopo.

## 4. Glossário de nomes

Os nomes abaixo são os **nomes-alvo**. Onde escrevi "novo", significa arquivo a ser criado.

| Nome | Papel | Caminho |
|---|---|---|
| `StudentDetailClient` (existente) | Render principal da tela do aluno. | `web/src/app/students/[id]/student-detail-client.tsx` |
| `StudentHeader` (existente, edição na Onda 1) | Avatar + nome + badges + ações. Ganha `objective` e `management_tags` na Onda 1. | `web/src/components/students/student-header.tsx` |
| `StudentStatusBar` (existente, edição na Onda 3) | Barra de chips no rodapé do header. Reduzida a "quase invisível" na Onda 3. | `web/src/components/students/student-status-bar.tsx` |
| `SmartBanner` (novo, Onda 3) | Banner de 1 ação clara baseado no estado dominante do aluno. | `web/src/components/students/smart-banner.tsx` |
| `ActiveProgramDashboard` (existente, edição na Onda 2) | Card grande do programa ativo. | `web/src/components/students/active-program-dashboard.tsx` |
| `AdherenceTrendStrip` (novo, Onda 2) | Faixa fina com sparkline de 12 semanas + 1 número, acima do calendário. | `web/src/components/students/adherence-trend-strip.tsx` |
| `ProgramCalendar` (existente) | Calendário do programa, com toggle Semana/Mês. **Não é substituído.** | `web/src/components/students/program-calendar.tsx` |
| `StudentInsightsCard` (existente, edição na Onda 3) | Lista de insights. Passa a respeitar dedup por `insight_key`. | `web/src/components/students/student-insights-card.tsx` |
| `AssessmentSidebarCard` + `BodyMetricsTrend` → `HealthMetricsCard` (refator na Onda 2) | Unificação dos dois em um só. | `web/src/components/students/health-metrics-card.tsx` (novo) |
| `ProgramHistorySection` (existente, edição na Onda 2) | Histórico de programas concluídos. Vira timeline horizontal. | `web/src/components/students/program-history-section.tsx` |
| `actions/insights.ts` (existente, edição na Onda 3) | Server actions de insights. Ganha `upsertInsightByKey`. | `web/src/actions/insights.ts` |

## 5. Ordem de execução

| # | Onda | Depende de | Notas |
|---|---|---|---|
| 1 | `dashboard-aluno-01-onda-1-quick-wins.md` | — | 5 quick wins. ~3-5 dias. |
| 2 | `dashboard-aluno-02-onda-2-refatoracoes.md` | Onda 1 commitada na branch | Refatorações médias. ~1-2 sprints. |
| 3 | `dashboard-aluno-03-onda-3-estruturais.md` | Ondas 1 e 2 commitadas na branch | Smart Banner + dedup engine. ~2-3 sprints. |

**Estratégia de commits:** todas as 3 ondas vivem na branch única `dashboard-aluno-redesign`. Cada onda fecha em **um commit limpo na branch** (não em PR/merge). PR para `main` abre **uma única vez** quando a Onda 3 terminar e o walk-through final estiver feito. Razão: o redesign é coordenado e validar ondas isoladamente em produção pode introduzir inconsistência visual transitória. O histórico granular fica preservado (3 commits separados, possível squash no merge se o time preferir).

O Gustavo aprova cada onda (testes verdes + walk-through manual) antes da próxima começar — só sem merge intermediário.

## 6. Como o Claude Code deve consumir cada spec

Cada arquivo de onda tem esta estrutura:

- **Objetivo & escopo** — o que faz e (igualmente importante) o que **não** faz.
- **Arquivos a tocar** — lista concreta com papel de cada um.
- **Passos de execução** — ordenados, com critérios de aceitação em cada passo.
- **Testes obrigatórios** — nada merge sem esses verdes.
- **Checklist final** — rodar antes de abrir PR.
- **Armadilhas conhecidas** — pontos onde o agente já sabe que o código é sutil.

Leia o arquivo inteiro antes de começar. Se algum passo quebrar uma invariante da seção 3, pare e reporte.

## 7. Ambiente

- Repo monorepo em `~/kinevo`. App web em `web/`.
- Use o gerenciador de pacotes que o projeto já usa (verificar `package.json` / lockfile antes).
- Supabase local pode estar rodando ou não. Não rode migrations.
- Para testes que precisem de Supabase, use mocks/stubs já existentes ou crie em `__fixtures__/` ao lado.
- O Gustavo fala português; comunicação em PT-BR. Strings user-facing pt-BR; nomes técnicos seguindo padrão do arquivo (mistura aceitável).
