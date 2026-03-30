# Kinevo — Relatório de Auditoria Completa

**Data:** 23 de março de 2026
**Escopo:** Código-fonte + Banco de dados (produção) + Interface web
**Método:** Análise estática de 400+ arquivos, 12 queries no Supabase, navegação em 8 páginas do sistema

---

## 1. Score Card Executivo

| Dimensão | Score | Justificativa |
|---|---|---|
| Arquitetura | **85/100** | Monorepo sólido, types compartilhados, Apple Watch. Descontado por componentes >1800 linhas. |
| Segurança | **80/100** | RLS em 34 tabelas, SECURITY DEFINER com search_path fixo, ownership guards consistentes. |
| Performance | **62/100** | N+1 queries no workout (30 queries/10 exercícios). Componentes sem code splitting. |
| Qualidade de Código | **68/100** | 130 usos de `any`, trainer lookup repetido 30x, hooks com 5+ responsabilidades. |
| Engine de IA | **58/100** | 87.5% de violações no modo agent, 54% geral. volume_below_minimum (57x) e duplicate_exercise (28x). |
| Integridade de Dados | **80/100** | Zero órfãos, boa auditoria. 7 sessões stale (mais antiga: 17 dias). 325/435 exercícios nunca usados. |
| UX / Interface | **82/100** | Design limpo e profissional. Tour de onboarding repetitivo. Alertas contextuais excelentes. |

**Score médio ponderado: 74/100**

---

## 2. Auditoria do Banco de Dados (Produção)

### 2.1 Saúde dos Dados

| Verificação | Resultado | Observação |
|---|---|---|
| Sessões abandonadas (in_progress > 24h) | **7** | Mais antiga: 17 dias (DANYELLE). `cleanup_stale_sessions()` existe mas nenhum cron a invoca. |
| Alunos sem programa ativo | **5** | De 18 alunos totais. Podem ser inativos ou aguardando prescrição. |
| Exercícios nunca utilizados | **325/435 (75%)** | Nunca apareceram em templates ou programas atribuídos. |
| Registros órfãos (sessions, set_logs, contracts) | **0** | Integridade referencial perfeita. |
| Programas zumbis (active sem expiração) | **0** | Todos os programas ativos têm `expires_at` definido. |
| Contratos vencidos sem ação | **0** | Nenhum contrato `past_due` pendente. |

### 2.2 Sessões Stale (Detalhes)

| Aluno | Início | Horas travada |
|---|---|---|
| DANYELLE CRISTINA | 06/03/2026 | 406h (~17 dias) |
| Matheus Henrique | 08/03/2026 | 354h (~15 dias) |
| Fernanda Lemos | 17/03/2026 | 159h (~7 dias) |
| Fernanda Lemos | 17/03/2026 | 151h (~6 dias) |
| Fernanda Lemos | 17/03/2026 | 151h (~6 dias) |
| Luana Alves Amaral | 17/03/2026 | 138h (~6 dias) |
| Alysson Lanza | 22/03/2026 | 28h (~1 dia) |

**Causa raiz:** A função `cleanup_stale_sessions()` foi criada na migration 041 e marca sessões com >24h como `abandoned`. Porém não existe nenhum cron job em `/api/cron/` que a invoque. Os 5 crons existentes são: `expire-programs`, `check-manual-overdue`, `check-push-receipts`, `process-form-schedules`, `process-push`.

### 2.3 Métricas de Uso

| Métrica | Valor |
|---|---|
| Treinos concluídos (total) | 80 |
| Duração média de treino | 94.1 minutos |
| Set logs registrados | 1.243 |
| Alunos ativos (últimos 7 dias) | 7 de 18 |
| Contratos ativos | 9 |
| Formulários respondidos | 11 (2 aguardando feedback) |
| Prescrições IA geradas | 48 (16 agent + 31 heurístico + 1 LLM) |

---

## 3. Engine de Prescrição por IA

### 3.1 Taxa de Violações por Fonte

| Fonte | Total | Com Violações | Taxa | Tempo Médio |
|---|---|---|---|---|
| Agent (Claude) | 16 | 14 | **87.5%** | 124s |
| Heurístico (Builder) | 31 | 12 | **38.7%** | 54s |
| LLM direto | 1 | 0 | 0% | 120s |

### 3.2 Violações Mais Comuns

| Regra Violada | Ocorrências | Auto-fixed | Impacto |
|---|---|---|---|
| `volume_below_minimum` | **57** | 0 (0%) | Aluno recebe volume insuficiente para hipertrofia |
| `duplicate_exercise` | **28** | 0 (0%) | Mesmo exercício aparece 2x no mesmo treino |
| `volume_exceeds_max` | **23** | 1 (4%) | Overtraining: volume acima do máximo recomendado |
| `function_ordering` | **14** | 0 (0%) | Exercícios na ordem errada (isolador antes de composto) |
| `duplicate_movement_pattern` | **7** | 0 (0%) | Mesmo padrão de movimento saturado |
| `missing_compound` | **6** | 0 (0%) | Treino sem exercício composto |

**Conclusão:** Apenas 1 de 135 violações foi auto-corrigida. O rules engine detecta problemas mas quase nunca os conserta. A violação mais comum (`volume_below_minimum`, 57x) indica que a IA sistematicamente prescreve volume insuficiente.

### 3.3 Oportunidades de Melhoria na Engine

- **Stall detection não implementado** (TODO no código em `generate-program.ts:200`). Não detecta quando aluno estagnou em carga.
- **Sem feedback loop.** Confidence score é calculado mas não utilizado. Sem rating do trainer sobre qualidade da geração.
- **161+ console.logs** no engine de prescrição. Deveria usar structured logging para monitoramento.
- **Nomes de exercícios compostos hardcoded** em português na API (`api/prescription/generate:143-148`). Deveria vir do banco.
- **Prompts 12-21** documentam melhorias críticas (propagação de ênfase, variedade, supressão de perguntas redundantes) que parecem pendentes de implementação.
- **Builder-First Migration** (feature flag `ENABLE_BUILDER_FIRST`): reduziria 76% dos tokens LLM e eliminaria violações estruturais. As duas code paths existem, mas otimizações adicionais estão pendentes.

---

## 4. Auditoria da Interface Web

### 4.1 Dashboard

- **Pontos positivos:** Layout limpo, KPIs bem posicionados (alunos ativos, treinos, receita, aderência). Ações pendentes visíveis no topo. Botão "Sala de Treino" bem posicionado.
- **Oportunidade:** Adicionar gráfico de evolução semanal (aderência ao longo das semanas) para visão de tendência.

### 4.2 Lista de Alunos

- **Pontos positivos:** Filtros de status (Atenção 4, Sem programa 0, Online 6, Presencial 1) são úteis. Coluna SEMANA mostra progressão clara (0/5, 1/5, 2/4).
- **Problema:** 4 alunos com semana 0/X e "Último treino: Nunca" em vermelho. Não há ação rápida de nudge/lembrete para esses alunos.
- **Tour repetitivo:** O tour "Cadastrar Alunos" reaparece toda vez que a página é visitada, mesmo após pulá-lo. Deveria gravar preferência.

### 4.3 Perfil do Aluno (Marina Lanza)

- **Pontos positivos:** Visão 360° excelente: heatmap de adesão, calendário semanal, últimas sessões com PSE e variação de carga. Sidebar com programa, financeiro e avaliações.
- **Destaque:** Alerta "Programa termina em 0 semanas! Prepare o próximo ciclo." em laranja é muito útil para o trainer.
- **Métricas ricas:** +20.7% carga, PSE média 7.0, sequência de treinos são dados valiosos.
- **Melhoria:** Botão "Nova Senha" exposto no header do perfil. Considerar mover para menu secundário para evitar cliques acidentais.

### 4.4 Financeiro

- **Pontos positivos:** Status do Stripe Connect visível, KPIs de receita, pagantes, cortesia e atenção claros. Planos e assinaturas bem separados.
- **Alerta eficaz:** "Gustavo Prado — Expirou em 20/03/2026" em destaque vermelho com "Ver detalhes".
- **Oportunidade:** O card "Receita do mês: R$ 0,00" pode desanimar em meses iniciais. Considerar mostrar projeção ou meta.

### 4.5 Programas

- **Alerta útil:** "Hipertrofia 1" mostra "2 treinos sem dia" em laranja e "0 exercícios" — template incompleto sinalizado corretamente.
- **Observação:** Apenas 2 templates de programa. Considerar criar templates pré-prontos para acelerar prescrição.

### 4.6 Avaliações

- **Fluxo claro:** 9 respostas, 2 aguardando feedback. Status "Aguardando" e "Concluído" bem diferenciados visualmente.

---

## 5. Problemas no Código-Fonte

### 5.1 Web App

| # | Sev. | Problema | Local |
|---|---|---|---|
| 1 | CRÍTICO | Componentes monolíticos de 1887 e 1780 linhas sem code splitting. Impacta tempo de carga inicial. | `program-builder-client.tsx`, `edit-assigned-program-client.tsx` |
| 2 | ALTO | Rate limiter in-memory não funciona com múltiplas instâncias (Vercel serverless). Rate limits são efetivamente inúteis. | `lib/rate-limit.ts` |
| 3 | ALTO | Webhook Stripe Connect não valida que `connectedAccountId` pertence a um trainer conhecido. | `api/webhooks/stripe-connect/route.ts` |
| 4 | ALTO | Duas rotas de cancellation com lógica sobreposta. Risco de divergência. | `api/financial/cancel-contract` + `api/stripe/cancel-subscription` |
| 5 | MÉDIO | Webhook helpers (`getPeriodEnd`, `getSubscriptionIdFromInvoice`) duplicados em dois arquivos. | `api/webhooks/stripe/` e `stripe-connect/` |
| 6 | MÉDIO | Padrão de trainer lookup repetido 30+ vezes ao invés de função utilitária. | 52 server actions |
| 7 | MÉDIO | Apenas 5 instâncias de `dynamic`/lazy import. Modais pesados (700+ linhas) carregados upfront. | `student-financial-modal`, `configure-billing-modal` |
| 8 | MÉDIO | `/api/stripe/webhook` é re-export desnecessário de `/api/webhooks/stripe`. Remover. | `api/stripe/webhook/route.ts` |

### 5.2 Mobile App

| # | Sev. | Problema | Local |
|---|---|---|---|
| 1 | CRÍTICO | N+1 queries: `fetchPreviousSets()` chamado individualmente para CADA exercício. 10 exercícios = 30 queries (3 fallbacks cada). | `hooks/useWorkoutSession.ts:443-450` |
| 2 | CRÍTICO | Hook de 1029 linhas com 5+ responsabilidades (fetch, state, persistence, watch, swap). Impossível testar e manter. | `hooks/useWorkoutSession.ts` |
| 3 | CRÍTICO | `persistSetLog()` é fire-and-forget sem retry. Erros logados apenas em `__DEV__`. Produção perde dados silenciosamente. | `hooks/useWorkoutSession.ts:245-273` |
| 4 | ALTO | `JSON.parse(JSON.stringify(prev))` para deep copy de exercícios. Extremamente lento para arrays grandes. | `hooks/useWorkoutSession.ts:522` |
| 5 | ALTO | 130 instâncias de `any` no TypeScript. Bugs escondidos por type assertions. | Múltiplos (26 só no `useWorkoutSession`) |
| 6 | ALTO | Componentes de 967 e 567 linhas sem `React.memo`. Re-renders cascateiam a cada mudança de state. | `CardioCard.tsx`, `WarmupCard.tsx` |
| 7 | ALTO | Training room store sem memoização de selectors. Mudar 1 set de 1 aluno re-renderiza todos os 6. | `stores/training-room-store.ts` |
| 8 | MÉDIO | Sem error boundaries nas telas principais (workout, training-room, report). Crash = tela branca. | `app/workout/[id].tsx`, `training-room.tsx` |
| 9 | MÉDIO | Nenhum timeout em queries Supabase. Podem travar indefinidamente. | Todos os hooks |

### 5.3 Stripe

- **Webhook duplicado:** `/api/stripe/webhook` é re-export de `/api/webhooks/stripe`. Remover.
- **Helpers duplicados:** `getPeriodEnd()` e `getSubscriptionIdFromInvoice()` copiados em ambos webhook handlers. Extrair para `lib/stripe-helpers.ts`.
- **Duas rotas de cancelamento:** `/api/financial/cancel-contract` (trainer cancela) e `/api/stripe/cancel-subscription` (aluno cancela) têm lógica sobreposta. Consolidar.
- **Idempotência:** Ambos handlers verificam `webhook_events` table (bom).
- **Error handling:** Retornam 200 mesmo em erro para evitar retry loops (bom).

### 5.4 Pontos Fortes do Código

- **Monorepo:** Bem estruturado com `web/`, `mobile/`, `shared/`, types compartilhados via `@kinevo/shared`.
- **Segurança:** RLS robusto em todas as 34 tabelas, SECURITY DEFINER com `search_path` fixo em RPCs.
- **Mobile:** Integração Apple Watch + Live Activity é diferencial significativo no mercado fitness.
- **Offline-first:** Idempotência com `UNIQUE(local_id, device_id)` em `set_logs`.
- **Knowledge graph:** `exercise_relationships`, `exercise_synergies`, `exercise_condition_constraints` formam grafo de exercícios para prescrição inteligente.
- **Form versioning:** `form_submissions` guarda `schema_snapshot_json`, imune a mudanças futuras no template.
- **Auditoria financeira:** `contract_events` cria trilha completa para cada operação.

---

## 6. Recomendações Top 10 Priorizadas

| # | Ação | Esforço | Impacto |
|---|---|---|---|
| 1 | **Corrigir auto-fix do rules engine:** `volume_below_minimum` e `duplicate_exercise` devem ser auto-corrigidos | 2-3 dias | Qualidade IA crítica |
| 2 | **Criar cron para `cleanup_stale_sessions()`:** função existe, só falta invocá-la | 1 hora | Integridade de dados |
| 3 | **Criar RPC batch** `get_exercises_with_previous_sets(exercise_ids[])` para eliminar N+1 | 1-2 dias | Performance mobile crítica |
| 4 | **Persistir preferência de "pular tour"** para não reaparecer em cada visita | 2 horas | UX trainer |
| 5 | **Adicionar retry com exponential backoff** em `persistSetLog()` | Meio dia | Integridade de dados |
| 6 | **Criar função `getTrainerByAuthUser()`** e substituir 30+ duplicatas | 2 horas | Qualidade de código |
| 7 | **Extrair helpers Stripe duplicados** para `lib/stripe-helpers.ts` | 1 hora | Manutenção |
| 8 | **Code splitting** nos 3 maiores componentes web (>1000 linhas) com `dynamic()` | 1-2 dias | Performance web |
| 9 | **Revisar biblioteca:** marcar 325 exercícios não-usados como hidden/arquivados | Meio dia | UX + qualidade IA |
| 10 | **Implementar memoização de selectors** no training-room-store (`useShallow`) | Meio dia | Performance mobile |

---

## 7. Números da Auditoria

| Métrica | Valor |
|---|---|
| Arquivos analisados | 400+ TypeScript/TSX |
| Linhas de código | ~80.000+ |
| Migrations Supabase | 86 |
| Tabelas (todas com RLS) | 34 |
| Índices | 121 |
| RPCs/Funções | 43 |
| Server Actions (web) | 52 |
| API Routes (web) | 31 |
| Custom Hooks (mobile) | 28 |
| Componentes web >300 linhas | 24 |
| Engine de prescrição | 27 módulos, 10.662 linhas |
| Queries de auditoria no banco | 12 |
| Páginas web navegadas | 8 |
| Problemas críticos encontrados | 5 (web) + 3 (mobile) + 2 (IA) |
| Problemas de alta severidade | 4 (web) + 4 (mobile) + 1 (dados) |
| Recomendações priorizadas | 10 |
