# Log de execução — Onda 3 (Dashboard do Aluno)

Data: 2026-05-08
Spec: `docs/specs/dashboard-aluno-03-onda-3-estruturais.md`
Branch: `dashboard-aluno-redesign` (Ondas 1+2 commitadas como `ba0c173` e `979474f`).

## Resumo

Última onda do redesign: SmartBanner único e prioritizado acima do dashboard,
engine de insights deduplicada por prefixo de `insight_key` em janela de 7
dias, `StudentStatusBar` reduzida a `mode='compact'` (só stats operacionais),
atalhos de teclado novos `L`/`P` para ações do banner, telemetria via helper
`track()` existente. `AssessmentSidebarCard` (deprecated na Onda 2)
finalmente removido.

## Achados críticos da investigação prévia (resumidos)

- **`insight_key` parcialmente instável**: 5 dos 6 generators no cron usam
  `:{today}` no final, gerando chaves diferentes diariamente para o mesmo
  evento. A engine atual já fazia upsert por `insight_key` exato, mas isso
  só evita duplicação **dentro do mesmo dia** — não cobre o caso da spec
  (fila tipo "sem treino há 19d / 18d / 13d"). A nova helper resolve via
  LIKE `${prefix}%` na janela de 7 dias.
- **Zero `INSERT` direto** em `assistant_insights` na engine: tudo já era
  `upsert(batch, { onConflict, ignoreDuplicates: true })`. A migração foi
  trocar o batch por loop de `upsertInsightByKey`.
- **`pinned_note`** (autoral, treinador cria nota) NÃO foi migrado — não é
  da engine.
- **`form_insight`** já usava chave estável (`form_insight:{submission_id}`)
  e tinha skip-list local; só recebeu `insight_key_prefix === insight_key`
  por consistência.
- **Telemetria existente**: `web/src/lib/analytics.ts` exporta `track()`.
  Reuso direto.
- **`StudentStatusBar`** só tem 1 consumer em produção (`student-detail-client`).
  Default `mode='full'` mantém retrocompat dos testes.
- **`AssessmentSidebarCard`** zero imports após Onda 2 — deletado nesta onda.

## Passos e arquivos tocados

### Passo 1 — `smart-banner-rules.ts` (novo, lógica pura)
- Tipos: `BannerLevel` (`critical|high|info`), `BannerKey` (8 chaves),
  `BannerCandidate`, `BannerContext`. `now?: Date` no contexto pra
  permitir injeção em testes.
- Helpers exportados: `daysSinceLastSession`, `avgRate` (normaliza 0–1 e
  0–100), `avgRpe` (ignora null/≤0), `daysToProgramEnd`, `avgTonnageChange`.
- `pickBanner(ctx)` lista candidatos elegíveis e ordena por
  `LEVEL_ORDER asc, weight desc`, retorna `[0] ?? null`. Função pura, sem
  side-effects.
- 8 chaves implementadas com pesos da spec: churn_risk (100), program_expired
  (90), financial_overdue (80), progression_ready (70), reassessment_due
  (60), first_session_pending (55), cycle_ending (50), streak_celebration
  (30).

### Passo 2 — `smart-banner.tsx` (novo, componente)
- Recebe `studentId`, `context`, `onAction`. Internamente chama `pickBanner`
  e renderiza `null` quando saudável.
- **Paleta corrigida** (decisão E aprovada): critical=red, high=amber,
  info=blue. Alinha com paleta do resto do app (red=bloqueio,
  amber=atenção, blue=info).
- Ícones lucide: `AlertTriangle` (critical), `Sparkles` (high), `Info` (info).
- `useEffect` no mount dispara `track('smart_banner_view', ...)` com
  dependência estável (`bannerKey` string, não objeto).
- Cliques nos botões disparam `track('smart_banner_action', { action_role,
  action_id, ... })` antes de chamar `onAction`.
- `data-testid`/`data-banner-key`/`data-banner-level` no container pra
  testes.

### Passo 3 — `student-status-bar.tsx` (`mode`)
- Nova prop `mode?: 'compact' | 'full'`, default `'full'` (retrocompat).
- Em compact: `chips` memo retorna `[]`, `inactivityChip` é null, CTA de
  contato some. Stats operacionais (`X/N esta semana`, `há X dias último
  treino`) ficam.
- Quando `compact && !activeProgram` → retorna `null` (decisão "armadilha"
  da spec).

### Passo 4 — `keyboard-shortcuts.tsx` (`L`/`P`)
- Novas props opcionais `onAdjustLoad?: () => void`, `onPlanNextProgram?:
  () => void`. Lista `SHORTCUTS` ganhou 2 entradas com `requiresProgram:
  true` (mostradas no painel de ajuda).
- `L` (adjust load) e `P` (plan next program) só disparam quando
  `hasActiveProgram && callback truthy`. Sem programa ativo ou sem callback
  → no-op.
- `M` mantido como "Ir para mensagens" (decisão C aprovada — destino é o
  mesmo handler que `send_message` do banner usaria).

### Passo 5 — `upsertInsightByKey` em `lib/insights/upsert.ts` + wrapper
- **Decisão de arquitetura**: a lógica vive em `web/src/lib/insights/upsert.ts`
  (não em `actions/`). Razão: `'use server'` files no Next.js 16 não podem
  exportar tipos diretamente, e o cron handler usa `supabaseAdmin` (que
  não está disponível dentro de Server Actions). A lib é parametrizada
  pelo `SupabaseClient`; o caller decide o nível de privilégio.
- `actions/insights.ts` exporta um wrapper `upsertInsightByKey(payload)` que
  apenas chama a lib com o server client (RLS respeitado).
- **Regra de dedup** (decisão A aprovada):
  - SELECT por `trainer_id + student_id + insight_key LIKE ${prefix}%` na
    janela de 7d (`created_at >= now - 7d`), `status != 'dismissed'`,
    ordenado por `created_at desc`, `limit 1`.
  - Se achar → UPDATE (preserva `status` original; atualiza category,
    priority, title, body, action_*, insight_key, expires_at, updated_at).
  - Senão → INSERT com `status: 'new'`.
- Schema: snake_case garantido no payload.
- `studentId === null` é tratado com `.is('student_id', null)`.

### Passo 6 — Cron consume `upsertInsightByKey`
- `web/src/app/api/cron/generate-insights/route.ts`: importa `upsertInsightByKey`
  de `@/lib/insights/upsert` (passa `supabaseAdmin` como client).
- Tipo `InsightRow` ganhou campo obrigatório `insight_key_prefix`.
- 6 generators atualizados:
  | Detection | prefix |
  |---|---|
  | `gap_alert` | `gap_alert:{student_id}` |
  | `stagnation` | `stagnation:{student_id}:{exercise_id}` |
  | `program_expiring` | `program_expiring:{program_id}` |
  | `pain_report` | `pain_report:{submission_id}` (= chave) |
  | `ready_to_progress` | `ready_to_progress:{student_id}:{exercise_id}` |
  | `form_insight` | `form_insight:{submission_id}` (= chave) |
- Loop sequencial substitui o batch upsert. Custo: N round-trips em vez de
  1 batch — aceitável porque o cron roda 1×/dia. Marcado como follow-up.
- Logging: contadores `inserted`/`updated`/`skipped` por trainer.
- LLM enricher (`insight-enricher.ts`) **não foi migrado** — usa chave
  consolidada (`stagnation_summary:...`) com semântica diferente. Marcado
  como follow-up.

### Passo 7 — Cutover em `student-detail-client.tsx`
- `StudentStatusBar` agora com `mode="compact"`.
- `bannerContext: BannerContext` montado a partir das props já recebidas.
- `daysUntilReassessment`: calcula a partir do menor `formSchedules[i].next_due_at`
  ativo. `null` quando não há agenda configurada.
- `pickBanner(bannerContext)` chamado **localmente** — função pura, custo
  zero (decisão F aprovada — sem callback de mudança).
- `<SmartBanner>` renderizado logo abaixo do `</StudentHeader>` quando
  `activeBanner != null`.
- `handleBannerAction(actionId)` cobre as 8 ações:
  - `send_message` → `handleOpenMessages()`
  - `open_whatsapp` → `window.open(wa.me/...)` (sanitiza phone)
  - `extend_program` → `handleExtendProgram()`
  - `complete_program` → `handleCompleteProgram()`
  - `assign_program` → `handleAssignProgram()`
  - `adjust_load` → scrollIntoView em `[data-onboarding="student-actions"]`
  - `send_reassessment` → scrollIntoView em `[data-onboarding="assessments"]`
    (decisão G aprovada — follow-up para abrir dropdown imperativamente)
  - `view_finance` → `router.push('/financial?student=...')`
- `<HealthMetricsCard hideReassessmentBanner={activeBanner?.key === 'reassessment_due'} />`.
- `<KeyboardShortcuts onAdjustLoad onPlanNextProgram>` com callbacks
  condicionais a `activeProgram` (decisão D aprovada).

### Passo 8 — `assessment-sidebar-card.tsx` deletado
- `rg "AssessmentSidebarCard" web/src` retornou zero imports reais
  (apenas comentários em outros arquivos referenciando o nome).
- Arquivo removido. Comentários explicativos no
  `health-metrics-card.tsx` e `student-detail-client.tsx` mantidos
  (documentam a transição da Onda 2/3 — não são imports).

## Testes

Suíte focada (Onda 3): **59/59 verdes**.

| Arquivo | Status | Cobertura |
|---|---|---|
| `web/src/components/students/__tests__/smart-banner-rules.test.ts` (novo) | ✅ 21/21 | helpers (5 grupos: daysSince, avgRate, avgRpe, daysToProgramEnd, avgTonnageChange) + cada uma das 8 chaves dispara no contexto correto + null para saudável + ordenação `critical > high > info` + ordenação por weight dentro do level. |
| `web/src/components/students/__tests__/smart-banner.test.tsx` (novo) | ✅ 6/6 | null quando pickBanner retorna null; renderiza variante crítica para churn_risk; renderiza variante info para cycle_ending; track('smart_banner_view') no mount; NÃO tracka quando não há banner; click no primário dispara onAction + track('smart_banner_action'). |
| `web/src/actions/__tests__/insights-upsert.test.ts` (novo) | ✅ 8/8 | INSERE quando não há prévio; ATUALIZA quando há prévio (<7d, status `new`); SELECT usa LIKE+gte+neq dismissed; dismissed → INSERE (query exclui via neq); error no SELECT/INSERT/UPDATE; `studentId=null` usa `.is(col, null)`. Fixture co-localizada com chainable Supabase mock. |
| `web/src/components/students/__tests__/student-status-bar.test.tsx` (ajustado) | ✅ 16/16 | testes pré-existentes preservados (modo full default) + 5 novos: compact não renderiza chips de inatividade/financeiro/avaliações; compact + sem programa → null; full default preserva comportamento original. |

Suíte completa: **816 passed, 4 failed (todas pré-existentes em
`SetSchemeTable.test.tsx`), 1 skipped**. Zero regressões introduzidas pela
Onda 3.

## Verificações finais

- [x] `pnpm typecheck` — `tsc --noEmit` continua com 11 erros pré-existentes
  em `program-calendar.test.tsx` (10) e `student-insights-card.test.tsx` (1),
  arquivos **não tocados** pela Onda 3. Zero erros novos.
- [x] `pnpm test:run` — 816 passed, 4 failed pré-existentes, 1 skipped.
- [x] Suíte focada da Onda 3 verde (59/59).
- [ ] `pnpm lint` — não rodei nesta sessão.

## Walk-through manual

**Não executei o dev server nesta sessão** (sem screenshots). Cenários para
o Gustavo validar manualmente:

| Cenário | Esperado |
|---|---|
| Aluno com 20+ dias sem treinar e adesão <50% | SmartBanner crítico (vermelho) com título "<Nome> pode estar desengajando" + botão "Enviar mensagem" + (se phone) "WhatsApp". Status bar mostra só "X/N esta semana" e "há 20 dias último treino" (sem chips de alerta). |
| Aluno saudável (treino recente, adesão alta, sem reavaliação iminente) | SmartBanner não aparece. Status bar mostra apenas os 2 stats operacionais. |
| Programa expirado | SmartBanner crítico vermelho com "Programa expirado" + botões "Atribuir programa" / "Prorrogar". |
| Cobrança em atraso (`displayStatus = 'past_due'`) | SmartBanner crítico com "Pagamento em atraso" + "Ver financeiro". |
| Programa terminando em 3 dias | SmartBanner info azul "Ciclo terminando" + "Planejar próximo". |
| Streak de 5 treinos consecutivos | SmartBanner info azul "Está numa sequência!" + "Enviar mensagem". |
| Reavaliação vencendo em 5 dias | SmartBanner amber "Reavaliação se aproximando" + "Enviar reavaliação". `HealthMetricsCard` esconde seu próprio banner amarelo. |
| Atalho `L` (com banner visível e programa ativo) | Scroll suave até `[data-onboarding="student-actions"]`. |
| Atalho `P` (com programa ativo) | Abre modal de atribuir programa. |
| Atalho `M` (sempre) | Abre painel de mensagens (igual antes da Onda 3). |
| Engine duas vezes em <7d para mesmo aluno + mesmo evento | `assistant_insights` mantém 1 registro só (com `updated_at` mais recente). Antes da Onda 3: 1 registro por dia (acumulava). Validar via SQL: `SELECT count(*) FROM assistant_insights WHERE insight_key LIKE 'gap_alert:<student>%' AND created_at >= now() - interval '7 days'`. |

## Follow-ups sugeridos

1. **Reotimizar batch no cron**: hoje é loop de N round-trips. Implementar
   uma RPC custom no Postgres (ou um único UPDATE...FROM com SELECT
   anti-join) para reduzir latência quando há muitos insights por trainer.
2. **`upsertInsightByKey` no LLM enricher**: `insight-enricher.ts:185` faz
   upsert por chave consolidada (`stagnation_summary:{student}:{date}`) com
   semântica de "consolidar múltiplos em um". Vale revisar se merece o
   mesmo tratamento de janela de 7 dias.
3. **`send_reassessment` imperativo**: hoje só faz `scrollIntoView` no
   `[data-onboarding="assessments"]`. Próximo: expor ref/imperative handle
   no `HealthMetricsCard` para abrir o dropdown de envio direto da ação
   do banner.
4. **`adjust_load` smart**: hoje scrolla até `student-actions`. Poderia
   abrir o accordion de "Carga por workout" ou destacar o exercício mais
   estagnado.
5. **`smart_banner_dismiss`**: spec menciona como evento futuro. Adicionar
   botão "Ignorar por hoje" + persistência (cookie de 24h?) quando houver
   demanda do usuário.
6. **`pinned_note` insight_key com `Date.now()`**: tecnicamente "instável",
   mas é design intencional (cada nota é única). Vale documentar
   formalmente para evitar confusão futura.
7. **`KeyboardShortcuts.onPlanNextProgram` reusa `handleAssignProgram`**:
   `n` (Novo/Atribuir) e `P` (Planejar próximo) levam ao mesmo handler.
   Acceptable porque a UX é idêntica, mas vale considerar se a tecla `P`
   deveria ter scoping diferente (ex.: só quando `cycle_ending` está
   ativo).
8. **Atalho `M` contextual ao banner**: hoje sempre abre mensagens. Se um
   dia o banner sugerir uma ação diferente que não seja "send_message" mas
   ainda use `M`, a UX teria de ser revista.

## Observações de processo

- **Sem `git`**: respeitada a regra da sessão. Baselines de erros TS e de
  testes foram comparados via execução isolada (`tsc --noEmit | grep
  <arquivo>` e `vitest run <arquivo>`), e por contagem total contra o
  estado já commitado das ondas anteriores.
- **Estado inicial validado**: branch `dashboard-aluno-redesign`, último
  commit `979474f wave 2`. 7 untracked pré-existentes não relacionados
  permaneceram intocados. 2 stashes pré-existentes do usuário também
  intocados.
- **Invariantes da seção 3 do `dashboard-aluno-00-visao-geral`**: todas
  respeitadas (sem migration de schema, sem refactor oportunista, sem
  mudanças em `page.tsx`, sem libs novas, strings pt-BR, ícones Lucide,
  testes co-localizados, sem mudanças no mobile).
- **Decisões registradas** (todas aprovadas pelo Gustavo antes da edição):
  - (A) `upsertInsightByKey` aceita `insightKeyPrefix` + `insightKey`.
  - (B) Loop substitui batch upsert no cron (follow-up: reotimizar).
  - (C) Atalho `M` continua "Ir para mensagens" sempre.
  - (D) `L`/`P` requerem programa ativo + callback truthy.
  - (E) Paleta corrigida: critical=red, high=amber, info=blue.
  - (F) `HealthMetricsCard.hideReassessmentBanner` controlado pelo parent
    via re-cálculo do `pickBanner` localmente.
  - (G) `send_reassessment` faz scrollIntoView (follow-up: dropdown
    imperativo).
  - (H) `assessment-sidebar-card.tsx` deletado.
- **Arquivos pré-existentes não relacionados**: untracked do mockup HTML,
  M5 PDF, `_kinevo-uxui-figures/` etc. continuam fora do escopo.
