# Onda 2 — Refatorações Médias do Dashboard do Aluno

Pré-requisito: Onda 1 commitada na branch `dashboard-aluno-redesign` e walk-through manual validado. **Ainda não houve merge para `main`** — todas as ondas vivem na mesma branch e só sobem por PR única no final. Ler `dashboard-aluno-00-visao-geral.md` antes de qualquer coisa.

## 1. Objetivo & escopo

Refatorações que mudam a estrutura visual de blocos inteiros, mas sem mexer em schema de banco nem em lógica de geração de insights (isso fica para a Onda 3).

**No escopo:**

1. **Calendário enxuto**: remover do `ProgramCalendar` as métricas inline `Adesão %` e `N treinos` que duplicam o stats grid imediatamente acima.
2. **`AdherenceTrendStrip` (novo)**: faixa fina com sparkline de 12 semanas + 1 número, posicionada acima do calendário.
3. **Strip de deltas em 1 linha**: compactar o `ProgramComparisonCard` (Volume por Grupo Muscular) num strip horizontal com Volume / Carga média / PSE média; detalhes em modal.
4. **Card unificado `HealthMetricsCard`**: funde `AssessmentSidebarCard` + `BodyMetricsTrend` num componente só com Peso, Gordura, sparkline e banner de "Reavaliação pendente".
5. **`ProgramHistorySection` em timeline horizontal** com mini-gráfico de volume por semana.
6. **`QuickMessageCard` com sugestão IA contextual**: a primeira sugestão é uma frase pronta gerada a partir do estado do aluno (já temos a lógica em `student-detail-client.tsx`, basta destacar visualmente).
7. **Padronizar paleta de status**: red = bloqueio, amber = atenção, emerald = saudável, violet = neutro/marca.

**Fora do escopo:**

- Smart Banner → Onda 3.
- Engine de insights / dedup → Onda 3.
- Mudanças em `page.tsx` (queries) — apenas client components e server actions já existentes podem ser tocados.
- Migração de schema.

## 2. Arquivos a tocar

| Arquivo | Mudança |
|---|---|
| `web/src/components/students/program-calendar.tsx` | Remover do header interno do calendário a renderização de "Adesão %" e do contador "N treinos" no rodapé. Manter toggle Semana/Mês e navegação. |
| `web/src/components/students/adherence-trend-strip.tsx` (novo) | Novo componente: SVG inline com sparkline + número + delta. Recebe `weeklyAdherence` (já existente em `page.tsx`). Pontos clicáveis emitem `onWeekClick(weekIndex)`. |
| `web/src/components/students/active-program-dashboard.tsx` | Renderizar `<AdherenceTrendStrip>` logo antes do `<ProgramCalendar>`. Wire-up do `onWeekClick` para navegar o calendário pra semana correspondente (precisa ler como `ProgramCalendar` aceita "semana inicial" — provavelmente via prop `initialWeekStart` a adicionar). |
| `web/src/components/students/program-comparison-card.tsx` | Adicionar uma prop `compact?: boolean` que, quando `true`, renderiza o card como strip horizontal com 3 deltas (Volume / Carga / PSE). Manter a versão completa em modal aberto via "Ver detalhes". |
| `web/src/components/students/health-metrics-card.tsx` (novo) | Novo componente que substitui `AssessmentSidebarCard` no rail direito. Renderiza Peso + % Gordura com sparkline (lógica de `BodyMetricsTrend`) + banner amarelo de "Reavaliação pendente" quando aplicável + dropdown "Enviar formulário". |
| `web/src/components/students/program-history-section.tsx` | Layout virar `flex` horizontal com `overflow-x: auto`; cada programa vira um `tl-item` (~200 px) com título, datas, % adesão e mini-bar-chart de volume por semana. |
| `web/src/components/students/quick-message-card.tsx` | Destaque visual da primeira sugestão (chip com background `bg-violet-50 dark:bg-violet-500/10` e texto da frase em destaque). Lógica de geração das sugestões já está no parent (`student-detail-client.tsx`); só visual. |
| `web/src/app/students/[id]/student-detail-client.tsx` | Substituir `<AssessmentSidebarCard>` por `<HealthMetricsCard>`. Substituir `<ProgramComparisonCard>` por versão compact + modal de detalhes. |
| `web/src/components/students/__tests__/adherence-trend-strip.test.tsx` (novo) | Testes do componente novo. |
| `web/src/components/students/__tests__/health-metrics-card.test.tsx` (novo) | Testes do componente novo. |
| `web/src/components/students/__tests__/program-history-section.test.tsx` | Ampliar para cobrir layout horizontal e cálculo de volume por semana. |

## 3. Passos de execução

### Passo 1 — Limpar redundâncias do `ProgramCalendar`

1. Abra `program-calendar.tsx`. Identifique o trecho que renderiza:
   - "03 de mai – 09 de mai" (range da semana) — **manter**.
   - "0 treinos" (contador) — **remover**.
   - "Adesão 0%" — **remover**.
2. Mantenha intacta:
   - Navegação (chevrons, toggle Semana/Mês).
   - Grid de dias com status (`done`, `done_historic`, `missed`, `scheduled`, `rest`, `out_of_program`, `compensated`).
   - Click handlers em dias com sessões (abre `SessionDetailSheet`).
3. Adicione prop opcional `initialWeekStart?: Date` que, quando fornecida, posiciona o calendário naquela semana ao montar. Isso será usado pelo trend strip para navegar.
4. **Critério de aceitação:** o calendário não exibe mais "Adesão 0%" nem "0 treinos" inline. Range da semana e navegação continuam idênticos.

### Passo 2 — Criar `AdherenceTrendStrip`

1. Crie `web/src/components/students/adherence-trend-strip.tsx`.
2. Interface:
   ```tsx
   interface AdherenceTrendStripProps {
     /** 12 últimas entradas, cronológicas. Aceita rates 0–1 ou 0–100 (normalizar como em StudentStatusBar). */
     weeklyAdherence: { week: number | string; rate: number }[]
     /** Se >= 12, usa as 12 últimas. Se <2, retorna null. */
     onWeekClick?: (weekIdentifier: number | string) => void
   }
   ```
3. Renderize:
   - Bloco esquerdo (label + número grande + delta): `ADESÃO 12 SEM` + `72%` + `média · ↓ −34% últ. 2 sem` (ou `↑` quando positivo).
   - SVG sparkline (`viewBox="0 0 380 28"`) usando os dados normalizados; pontos com `<circle>` clicáveis.
   - Cor da linha: `#6B46FF` (violet); pontos com rate < 50 % em `#EF4444` (red).
4. Cálculo do delta:
   ```ts
   const norm = (r: number) => (r <= 1 ? r * 100 : r)
   const values = weeklyAdherence.slice(-12).map(w => norm(w.rate))
   const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length)
   const last2 = avgOf(values.slice(-2))
   const prev2 = avgOf(values.slice(-4, -2))
   const delta = last2 - prev2  // pode ser negativo
   ```
5. Acessibilidade: container tem `role="img"` e `aria-label="Adesão de 12 semanas: 72% em média"`; cada `<circle>` tem `<title>` com a semana e a taxa.
6. **Critério de aceitação:** componente renderiza com 12 pontos quando há 12+ entradas; retorna `null` com <2; cliques nos pontos disparam `onWeekClick` com o identificador correto.

### Passo 3 — Wire-up do trend strip no programa ativo

1. Em `active-program-dashboard.tsx`, importe `AdherenceTrendStrip`.
2. Renderize-o **acima** do `<ProgramCalendar>`, antes do bloco "Últimas Sessões":
   ```tsx
   {weeklyAdherence.length >= 2 && (
     <AdherenceTrendStrip
       weeklyAdherence={weeklyAdherence}
       onWeekClick={(w) => setCalendarStartWeek(w)}
     />
   )}
   ```
3. Estado local `calendarStartWeek` decide o `initialWeekStart` do `ProgramCalendar`. Conversão de "semana N do programa" para `Date` usa `addWeeks(programStartedAt, week - 1)` com utilidades existentes em `@kinevo/shared/utils/schedule-projection`.
4. **Critério de aceitação:** clicar num ponto vermelho do sparkline navega o calendário para a semana correspondente sem reload.

### Passo 4 — `ProgramComparisonCard` em modo compact

1. Adicione prop `compact?: boolean` ao componente. Em modo `compact`:
   - Renderize uma linha horizontal com 3 cards pequenos: Volume (com %change), Carga média (com %change), PSE média (sem %change).
   - Sem barras detalhadas por grupo muscular.
   - Adicione um link "Ver detalhes →" que abre a versão completa num modal/sheet.
2. Em `student-detail-client.tsx`, troque o uso atual para `<ProgramComparisonCard ... compact />`.
3. O modal de detalhes pode ser implementado com a versão não-compact do mesmo componente dentro de um Dialog. Reuse `Dialog` do projeto se existir; senão, padrão `<div role="dialog">` simples.
4. **Critério de aceitação:** o card "Volume por Grupo Muscular" deixa de ser uma seção grande e vira uma faixa de 3 deltas. Modal abre/fecha; conteúdo idêntico ao antigo.

### Passo 5 — `HealthMetricsCard` (unificação)

1. Crie `web/src/components/students/health-metrics-card.tsx`.
2. Props: as mesmas de `AssessmentSidebarCard` (lastSubmission, pendingForms, bodyMetrics, bodyMetricsHistory, formTemplates, formSchedules) + studentId.
3. Layout interno:
   - Header: "Saúde & métricas" + microtag com data da última atualização + link "Enviar reavaliação →".
   - Grid 1×2: Peso (valor grande + "↘ −0,8 kg em 30d" + sparkline) | % Gordura idem.
   - Banner amarelo "Reavaliação periódica · pendente" quando há `pendingForms.length > 0` ou `formSchedules` com `next_due_at <= hoje + 7 dias`. Botões: "Enviar" (chama `assignFormToStudents`) e "Ver formulário".
   - Lista de `formSchedules` ativas em accordion fechado por padrão.
4. Reaproveite a lógica de cálculo de delta e a renderização da sparkline que já existe em `BodyMetricsTrend`.
5. Em `student-detail-client.tsx`, troque `<AssessmentSidebarCard ... />` por `<HealthMetricsCard ... />`. **Não** delete o componente antigo — só pare de importá-lo. Marque como `@deprecated` num JSDoc no topo. (Removeremos no fim da Onda 3 quando todo o uso estiver coberto.)
6. **Critério de aceitação:** o rail direito mostra um único card `Saúde & métricas` no lugar de dois. Todos os fluxos (enviar formulário, ver agenda de avaliações) continuam funcionando.

### Passo 6 — `ProgramHistorySection` horizontal

1. Mude o layout de `flex flex-col` para `flex flex-row gap-2 overflow-x-auto pb-2`.
2. Cada programa vira um card de ~200 px de largura com:
   - Título do programa.
   - Datas (`start → end`) e duração.
   - "Adesão N%" (calculado: `sessions_count / (workouts_count * duration_weeks)` se aplicável; se não, hide).
   - Mini bar chart de volume por semana — **simplificação aceitável**: gerar barras "fake" por enquanto (estilo placeholder com `Array.from({length: 8})`) e abrir TODO para alimentar com dados reais via nova action `getProgramVolumeByWeek` (escopo Onda 3 ou follow-up).
3. Programa atual destacado com background `bg-violet-50` ou similar.
4. **Critério de aceitação:** histórico passa a ser uma timeline horizontal scrollável; cards visualmente distintos do programa atual. Mini bar chart pode estar com placeholders (TODO documentado).

### Passo 7 — `QuickMessageCard` com sugestão em destaque

1. Em `quick-message-card.tsx`, identifique o render atual dos chips de sugestão.
2. A primeira sugestão (`suggestions[0]`) ganha um destaque especial:
   ```tsx
   <button className="px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-300 text-[12.5px] font-bold text-left">
     <span className="opacity-80">✨</span> "{suggestions[0].message}"
   </button>
   ```
3. Demais sugestões mantêm o estilo de chip existente.
4. **Critério de aceitação:** a primeira sugestão aparece como uma frase pronta destacada, clicável; clicar preenche o textarea com a mensagem. Demais chips funcionam como hoje.

### Passo 8 — Paleta de status (ajustes pontuais)

Audite os seguintes arquivos e ajuste tonalidade quando o sentido for inconsistente:

- `student-status-bar.tsx`: `metGoal` em `emerald` (já está). Inatividade ≥6 dias `red`, ≥3 `amber`. **Já está correto** — não tocar.
- `quick-message-card.tsx`: chip de "sucesso" em `emerald`, chip de "envio falhou" em `red`.
- `active-program-dashboard.tsx`: stat "Esta semana" hoje usa `red` para 0, `yellow` para parcial, `emerald` para meta. **Trocar `yellow` por `amber`** para consistência (`text-amber-400` em vez de `text-yellow-400`).

**Não altere** componentes fora de `web/src/components/students/`.

## 4. Testes obrigatórios

- `adherence-trend-strip.test.tsx` (novo)
  - retorna `null` com menos de 2 pontos.
  - normaliza rates 0–1 e 0–100 corretamente.
  - calcula delta entre últimas 2 e penúltimas 2 semanas.
  - dispara `onWeekClick` com identificador correto ao clicar num ponto.

- `health-metrics-card.test.tsx` (novo)
  - renderiza Peso e Gordura quando há `bodyMetrics`.
  - renderiza banner de "Reavaliação pendente" quando há `pendingForms` ou `formSchedules` vencendo em ≤7d.
  - dispara envio do formulário ao clicar em "Enviar".

- `program-history-section.test.tsx` (ampliar)
  - layout horizontal com `overflow-x-auto`.
  - card do programa atual destacado.

- `program-calendar.test.tsx` (ajustar)
  - remover assertions sobre "Adesão 0%" e "0 treinos" se existirem.
  - garantir que o calendário ainda exibe os dias com status correto.

## 5. Checklist final

- [ ] `pnpm tsc --noEmit` verde.
- [ ] `pnpm test` verde.
- [ ] `pnpm lint` verde.
- [ ] Walk-through manual:
  - calendário sem "Adesão %" e "N treinos".
  - trend strip aparece acima do calendário com sparkline e delta.
  - clicar num ponto do sparkline navega o calendário.
  - card "Volume por Grupo Muscular" virou strip de 3 deltas; modal abre.
  - rail direito tem `Saúde & métricas` (e não mais `Avaliações` separado).
  - histórico de programas é horizontal e scrollável.
- [ ] Log em `docs/specs/logs/dashboard-aluno-onda-2.md`.

## 6. Armadilhas conhecidas

- **`weeklyAdherence`** vem de `page.tsx` com `rate` em **inteiros 0–100**. O `StudentStatusBar` aceita ambos formatos (normaliza). O novo trend strip também precisa normalizar — não assuma escala.
- **`ProgramCalendar`** tem `useMemo` pesado para calcular dias. Adicionar a prop `initialWeekStart` exige ajustar o `useState` inicial sem quebrar o memo.
- **`BodyMetricsTrend`** já existe e é usado em outros lugares? `rg "BodyMetricsTrend"` — se for, mantenha o componente vivo e só pare de usá-lo no `AssessmentSidebarCard`. Não delete.
- **`ProgramComparisonCard`** atualmente carrega dados via `dynamic` import. Adicionar `compact` não pode quebrar o lazy load.
- **`overflow-x: auto`** em mobile pode brigar com gestures globais. Teste em viewport pequeno.
- **`AssessmentSidebarCard`** importa `assignFormToStudents` que é uma server action. O novo `HealthMetricsCard` precisa importar a mesma. Não duplicar lógica.
- **Reavaliação pendente** com `next_due_at` no passado deve aparecer como **vencida** (vermelho) — alinhar com a regra do Smart Banner que será implementado na Onda 3 para evitar inconsistência futura.

## 7. Definição de pronto

- Checklist da seção 5 marcado.
- PR aberta apontando para `dashboard-aluno-02-onda-2-refatoracoes.md`.
- Log de execução commitado.
- Nenhuma invariante da seção 3 do `00-visao-geral` violada.
