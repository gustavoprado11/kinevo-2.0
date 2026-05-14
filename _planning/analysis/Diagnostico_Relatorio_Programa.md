# Relatório do Programa — Diagnóstico e Plano de Otimização

**Escopo:** rota `GET /reports/program/[id]`
**Arquivos analisados:**
- `web/src/app/reports/program/[id]/route.ts`
- `web/src/lib/reports/program-report-service.ts`
- `web/src/lib/reports/program-report-html.ts`
- `web/src/components/students/active-program-dashboard.tsx` (botão "Relatório")

---

## 1. Diagnóstico dos bugs

### 1.1 Causa raiz nº 1 — O relatório é **congelado** no primeiro acesso

`route.ts:18–30` faz exatamente isso:

```ts
let report = await getReportByProgram(supabase, programId)          // cache hit?
if (report && shouldRegenerate) { ... }                              // só regenera com ?regenerate=1
if (!report) { const id = await generateReport(...) }
```

Ou seja, o PDF é gerado **na primeira vez** que alguém abre `/reports/program/<id>` e então fica guardado em `program_reports.metrics_json`. O rodapé do PDF ("Gerado pelo Kinevo em 23 de mar. de 2026") confirma: a foto foi tirada em **23/03**, logo após o programa começar, quando só havia 1 sessão concluída.

O dashboard, por outro lado, lê sempre do vivo. Daí a divergência: **41 treinos na tela × 1 sessão no PDF**.

Além disso o botão "Relatório" (`student-detail-client.tsx:533`) aponta para `/reports/program/<id>` sem `?regenerate=1`, então o treinador nunca tem como atualizar a foto pela UI.

### 1.2 Causa raiz nº 2 — `planned_sessions = numWorkouts × durationWeeks` usa premissa errada

Em `program-report-service.ts:365–370`:

```ts
const { count: numWorkouts } = await supabase
    .from('assigned_workouts')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_program_id', programId)

const plannedSessions = (numWorkouts ?? 0) * durationWeeks
```

`assigned_workouts` armazena **tipos de treino do programa** (ex.: "Treino A", "Treino B"). O número de sessões planejadas por semana é a soma de `scheduled_days.length` em cada treino, **não** a quantidade de treinos distintos. O dashboard já faz certo em `getExpectedPerWeek()` (`active-program-dashboard.tsx:33–36`):

```ts
return workouts.reduce((sum, w) => sum + (w.scheduled_days?.length || 0), 0)
```

Com o cálculo atual, um programa com 2 treinos distintos rodando 4× por semana por 4 semanas vira `2 × 4 = 8` — é exatamente o "8 sessões" mostrado no PDF, enquanto o correto seria 16.

### 1.3 Causa raiz nº 3 — `-94% vs programa anterior` é matematicamente correto, mas semanticamente enganoso

`computeVolume` soma a tonelagem do programa anterior inteiro e compara com a tonelagem atual **parcial** (o programa ainda está em andamento, semana 4 de 4). Comparar um programa encerrado com um em andamento vai sempre dar um delta negativo enorme até a última sessão. A comparação só faz sentido ao fim do ciclo.

### 1.4 Causa raiz nº 4 (corolário das anteriores) — S2, S3, S4 vazias, Δ = +0 kg

Todos os gráficos semanais e a tabela de progressão vêm dos mesmos loops (`calcProgramWeek`), que agregam corretamente — eles só aparecem vazios porque, no momento em que o snapshot foi feito, só existia 1 sessão e ela caiu em S1. Uma vez resolvidos os itens 1.1 e 1.2, S2–S4 vão preencher automaticamente.

### 1.5 Bug menor de formatação — "Desde mar. de 26"

`program-report-html.ts` deve estar usando `toLocaleDateString` com `year: '2-digit'`. Em um app SaaS, ano em 2 dígitos confunde o leitor (aluno e treinador). Usar `year: 'numeric'` ou omitir para programas do ano corrente.

---

## 2. Resumo dos dados observados no PDF × realidade (tela)

| Métrica | PDF | Tela | Diagnóstico |
|---|---|---|---|
| Sessões totais | 1 de 8 | 41 em ~16 planejadas | Bugs 1.1 + 1.2 |
| Frequência | 12,5% | 86% média | Bugs 1.1 + 1.2 |
| Volume total | 11,3 t | (não exposto na tela, mas tende a ser maior) | Bug 1.1 |
| -94% vs anterior | mostrado | — | Bug 1.1 + 1.3 |
| RPE por semana | só S1 = 7,0 | — | Bug 1.1 |
| Progressão de carga | só S1 preenchida, Δ = +0 kg | — | Bug 1.1 |
| Data header | "Desde mar. de 26" | "23/03 – 19/04" | Bug 1.5 |

---

## 3. Plano de correção (ordem de prioridade)

### P0 — Consertar `planned_sessions`

Em `computeFrequency`, substituir o count simples por uma soma da cardinalidade de `scheduled_days`:

```ts
const { data: workouts } = await supabase
    .from('assigned_workouts')
    .select('scheduled_days')
    .eq('assigned_program_id', programId)

const sessionsPerWeek = (workouts ?? []).reduce(
    (sum, w) => sum + ((w.scheduled_days as number[] | null)?.length ?? 0),
    0
)
const plannedSessions = sessionsPerWeek * durationWeeks
```

**Teste:** um programa com 2 treinos (A seg/qua, B ter/qui) de 4 semanas deve dar 16 planejadas, não 8.

### P0 — Invalidar/regenerar o cache em três gatilhos

O snapshot congelado é OK para programas **concluídos** (é até uma feature: preserva o relatório de fechamento intacto). Para programas **ativos ou expirados**, precisamos frescor. Três opções, em ordem de complexidade:

**Opção A — Regeneração automática no GET quando programa ainda está ativo**

```ts
// route.ts
const { data: program } = await supabase
    .from('assigned_programs')
    .select('status')
    .eq('id', programId)
    .single()

const isFinal = program?.status === 'completed'
let report = await getReportByProgram(supabase, programId)

const shouldForceRegenerate =
    shouldRegenerate ||
    (report && !isFinal && isStale(report.generated_at))  // ex.: > 1h

if (report && shouldForceRegenerate) {
    const newId = await regenerateReport(supabase, report.id)
    report = newId ? await getReport(supabase, newId) : report
}
```

**Opção B — Invalidar no momento em que a sessão é completada** (trigger ou webhook em `workout_sessions.status → completed` que marca o report como stale).

**Opção C — Abandonar o cache e computar on-the-fly** quando o programa está ativo; cachear só no `complete-program` action. É a arquitetura mais simples e elimina a classe inteira de bugs de staleness.

**Recomendação:** Opção C. Os cálculos já são paralelos (`Promise.all`) e o volume de dados é pequeno. Cache só vale a pena para o relatório **final**, que é estável por definição.

### P0 — Botão "Relatório" deve trazer dado fresco em programas ativos

Se ficar com cache (Opção A), o botão no dashboard precisa passar `?regenerate=1` quando `program.status !== 'completed'`. Se for Opção C, nem precisa — o GET já recomputa.

### P1 — Remover ou recontextualizar "-94% vs programa anterior"

Dois problemas compostos: (a) comparar programa em andamento com programa encerrado sempre dá delta negativo enorme, e (b) tonelagem bruta, como decidido na seção 4, deixa de ser a métrica principal. Opções:

- **Remover** o card por enquanto (mais simples).
- **Substituir** por comparativo de **séries por grupo muscular** entre ciclos, que é acionável ("o ciclo anterior teve 48 séries de peito/semana; este ciclo está em 56 — ↑"). Só exibir se `status === 'completed'`.

### P1 — Tratamento de ano no header

Em `program-report-html.ts`, trocar `year: '2-digit'` por `year: 'numeric'` e, se o programa está 100% no ano corrente, exibir só "Desde março" sem ano, para enxugar.

### P2 — Gráficos "S1 com barra, S2–S4 vazias" ficam feios

Mesmo depois dos fixes de agregação, é possível que um programa tenha semanas realmente zeradas. Fazer o renderer omitir barras zeradas (ou renderizá-las em cinza claro com tracejado) comunica melhor "sem sessão" vs. "sem dado ainda".

---

## 4. Otimizações — premissas revistas

Três premissas reformulam o desenho:

- **O relatório é um entregável compartilhável.** Treinador lê para ajustar, e depois manda ao aluno no fim do ciclo. É aí que gera valor. O produto precisa servir os dois leitores no mesmo documento.
- **Treinador não prescreve RPE.** A métrica representa a **percepção de esforço do aluno** — não há alvo para comparar. Serve para ler a semana, não para qualificar ("Bem dosado" some).
- **Tonelagem bruta não fala a língua do personal.** Peso × reps agregado é métrica de engenheiro. Quem prescreve pensa em séries, cargas por exercício, RIR/RPE, progressão de kg.

### 4.1 Arquitetura: um relatório com toggles de seções

O treinador vê o relatório completo. Antes de compartilhar com o aluno, pode **ligar/desligar seções** (um painel de checkboxes no topo da página ou antes do "Publicar"). Decisões de default:

| Seção | Default ligado | Observação |
|---|---|---|
| Cabeçalho + aderência | sempre | — |
| Conquistas do ciclo | sim | Motivacional — aluno adora |
| Progressão de carga | sim | Tabela + 1RM estimado |
| Séries por grupo muscular | sim | Substitui tonelagem como primeira leitura |
| Carga média por exercício-chave | sim | — |
| RPE (percepção) | opcional | Treinador decide — alguns alunos se confundem |
| Planejado × realizado | **desligado** | Técnico demais pro aluno; ligado por padrão se público = treinador |
| Sinais/alertas | **desligado** | Nunca vai no PDF do aluno |
| Observações do treinador | sim | Texto livre — é onde o personal assina o trabalho |

Implementação: guardar o conjunto de seções habilitadas em `program_reports.visible_sections` (jsonb ou bitmask) e usar no renderer. No app, bloco de toggles no topo com preview ao vivo.

### 4.2 Volume: substituir tonelagem por métricas que personal usa

Três métricas, na ordem de prioridade visual:

**a) Séries por grupo muscular** — contagem de séries completadas, agrupada por `exercises.muscle_group`, barplot horizontal. Usa vocabulário padrão de hipertrofia (ex.: "12 séries de peito/semana"). Saída do `computeVolume`: `series_by_muscle_group: { chest: 48, back: 52, legs: 64, ... }` + breakdown semanal opcional.

**b) 1RM estimado por exercício principal** — fórmula de Epley `1RM = weight × (1 + reps/30)` aplicada em cada set_log, pegando o máximo semanal por exercício. Já existe infra de "top exercícios" em `computeProgression`; basta estender a saída:

```ts
interface ReportExerciseProgression {
    // ... campos existentes
    weekly_est_1rm: (number | null)[]  // novo
    start_est_1rm: number              // novo
    end_est_1rm: number                // novo
    change_est_1rm_kg: number          // novo
}
```

Mostrar na tabela de progressão como uma coluna adicional.

**c) Carga média por exercício-chave** — média simples de `weight` por exercício, por semana. Útil pra série temporal "Supino Reto: 80 → 85 → 90 → 92,5 kg". Um sparkline por linha da tabela.

**Tonelagem total** pode sobrar em um card secundário tipo "headline" para o aluno ("você moveu 11,3 toneladas!"), sem gráfico semanal — fica num canto discreto.

### 4.3 RPE como percepção do aluno

Reinterpretar o card:

- Título: **"Percepção de esforço do aluno (PSE)"** (ou "Como o aluno sentiu os treinos")
- Valor: média das PSEs registradas, sem qualificativo.
- Gráfico: série temporal semanal (S1…Sn). Só série, sem linha de meta nem rótulo.
- Subtexto neutro: "Média relatada pelo aluno ao final de cada sessão."

Remover completamente o texto "Bem dosado". Não julgar.

**Para o treinador (no app, não no PDF):** o mesmo gráfico pode ganhar um badge de tendência detectada pela série em si — "estável", "em alta" ou "em queda" nas últimas 3 semanas (regressão simples). Mas isso é sinal, não entra no relatório compartilhável por padrão.

### 4.4 Progressão de carga — mais exercícios

`computeProgression` hoje pega só 3. Aumentar para todos os exercícios com ≥ 3 sessões, com toggle "Top 5 / Todos" no app. No PDF do aluno, fixar Top 5 (principais compostos) para não virar pdf de 12 páginas.

### 4.5 Aderência como heatmap de calendário

Em vez das 4 barras S1–S4, heatmap 7×N (dia da semana × semana). Expõe padrões — "segunda virou buraco", "nunca treina sábado". Muito mais diagnóstico e também bonito visualmente no PDF do aluno. Manter as 4 barras como card resumido no topo.

### 4.6 Check-ins: série temporal, não só média

`computeCheckins` retorna média. Plotar a série (sono, dor, motivação) mostra trajetória — uma média de 7 pode esconder início 9 / fim 5.

### 4.7 Bloco "Conquistas do ciclo" (para o aluno)

Substitui em parte a função do bloco "Sinais" — mas com tom positivo/construtivo, pensado para o aluno. Heurística simples sobre dados que já computamos:

- "Você concluiu **41 de 48 treinos** (86% de aderência)."
- "Subiu **+15 kg** no Leg Press ao longo das 4 semanas."
- "**Recorde pessoal** em Supino Reto: 90 kg × 8 reps (1RM estimado: 114 kg)."
- "Esteve ativo em **todas as 4 semanas** do programa."

Tom: celebratório, substantivo. É o que o aluno vai tirar print e mandar no story. Ranqueamento: 3–5 conquistas, priorizando PRs e marcos (aderência ≥ 80%, evolução de kg).

### 4.8 Bloco "Sinais" — só para o treinador

Visível apenas no app do treinador (não vai para o PDF compartilhado — default desligado na matriz de toggles). Mesma heurística, tom técnico:

- "Aderência caiu de 95% (S1–S2) para 60% (S3–S4)."
- "Leg Press subiu +15 kg, Agachamento estável — revisar prescrição."
- "PSE subindo +2 pontos em 3 semanas — monitorar fadiga."

### 4.9 Exportação real em PDF (prioridade alta)

Para ser efetivamente compartilhável (WhatsApp, e-mail), o endpoint precisa servir `.pdf`, não HTML. Opções:

- **Puppeteer/Playwright server-side** — renderiza o HTML atual em PDF. Pesado, mas reaproveita 100% o template.
- **@react-pdf/renderer** — componentes React-pdf dedicados. Mais leve, mas exige manter dois templates em sincronia.
- **Print CSS + "imprimir como PDF"** manual — gambiarra, mas zero infra.

Recomendo Puppeteer num endpoint `/reports/program/[id]?format=pdf`. Adicionar botão "Baixar PDF" e "Compartilhar com aluno" (WhatsApp web link, se viável) na barra superior do dashboard.

### 4.10 Layout proposto — versão compartilhável (1 página celebratória)

Pensada para impressionar o aluno em uma página A4:

1. **Header** — logo Kinevo (discreto), nome do aluno em destaque, nome do programa, período do ciclo. Um selo "PROGRAMA CONCLUÍDO" ou "EM ANDAMENTO".
2. **3 números-herói** — "41 treinos · 86% de aderência · +15 kg no Leg Press". Tipografia grande, respiração visual.
3. **Conquistas do ciclo** — 3–5 bullets (4.7), com ícones sutis.
4. **Sua progressão** — uma tabela enxuta com 3–5 exercícios-chave: nome, carga inicial → carga final, Δ. Opcional: sparkline.
5. **Sua consistência** — heatmap de aderência, compacto.
6. **Mensagem do treinador** — texto livre, em destaque visual, assinado.
7. **Rodapé** — "Gerado pelo Kinevo · [data]".

Cabe em A4 retrato, impactante, compartilhável em story/WhatsApp.

### 4.11 Layout proposto — versão treinador (densa, multi-página)

Quando o treinador abre no app (sem toggles desligados), o conteúdo expande:

1. Header.
2. **Sinais** (4.8) — bloco de alertas técnicos.
3. Frequência: card + heatmap + breakdown semanal.
4. **Progressão de carga completa** (4.4) — todos exercícios, 1RM estimado, sparklines.
5. **Volume: séries por grupo muscular** (4.2a) + carga média (4.2c) + tonelagem em canto secundário.
6. **Planejado × realizado** (quando o campo `planned_sets/reps` estiver preenchido).
7. **PSE** (4.3) — série temporal neutra.
8. **Check-ins** (4.6) — série temporal.
9. **Conquistas** (4.7) — mesmo bloco do aluno, para referência.
10. Observações do treinador (editável).

Mesma página HTML, seções controladas pelos toggles — a "versão do aluno" é só a versão treinador com as seções técnicas desligadas.

---

## 5. Roadmap sugerido

### Bloco A — Correções de dados (fecha o bug reportado)

1. **Corrigir `planned_sessions`** (P0, ~10 min) — fix de 5 linhas em `computeFrequency`.
2. **Recompute on-the-fly para programas ativos** (P0, ~1h) — Opção C da seção 3.
3. **Remover "-94% vs anterior"** enquanto o programa está em andamento (P1, 20 min).
4. **Remover qualificativo "Bem dosado"** do card de RPE e renomear para "Percepção de esforço do aluno (PSE)" (P1, 10 min).
5. **Corrigir formatação de data no header** (P1, 5 min).

Este bloco sozinho já resolve o que o usuário reportou. Um PR pequeno.

### Bloco B — Troca de vocabulário (o salto de valor para o treinador)

6. **Séries por grupo muscular** (P1, ~2h) — agregação em `computeVolume` usando `exercises.muscle_group`, novo card.
7. **1RM estimado + carga média por exercício** na tabela de progressão (P2, ~3h).
8. **Remover/diminuir protagonismo da tonelagem** no layout (P2, ~30 min de CSS/estrutura).

Com A + B o relatório já é muito mais útil para o treinador ler.

### Bloco C — Compartilhável (onde mora o valor de produto)

9. **Bloco "Conquistas do ciclo"** (P2, ~3h) — heurística simples sobre aderência, PRs, evolução de kg.
10. **Toggles de seções visíveis** (P2, ~meio dia) — persistir em `visible_sections`, UI no app, renderer respeita.
11. **Exportação real em PDF** via Puppeteer (P2, ~1 dia) — endpoint `?format=pdf`, botão "Baixar PDF" e "Compartilhar com aluno" no dashboard.
12. **Redesign da vista compartilhável (1 página)** — layout celebratório (seção 4.10) (P3, ~1 dia de design + implementação).

### Bloco D — Refinamentos

13. **Heatmap de aderência** (P3, ~meio dia).
14. **Séries temporais de PSE e check-ins** (P3, ~meio dia).
15. **Planejado × realizado** (P3, depende de ter dados de prescrição confiáveis) (~1 dia).
16. **Bloco "Sinais" no app do treinador** (P3, ~meio dia).

### Sequência recomendada de entregas

- **Semana 1:** Bloco A (fecha o bug) + 6, 7, 8 do Bloco B.
- **Semana 2:** 9, 10, 11 — o mínimo para virar produto compartilhável.
- **Semana 3:** 12 (redesign da vista do aluno) — o que faz o treinador querer compartilhar.
- Depois: Bloco D conforme prioridade.

Se topar, eu já aplico o Bloco A (1–5) num único conjunto de edits. São mudanças cirúrgicas, baixo risco, e deixam o relatório confiável antes de qualquer redesign.
