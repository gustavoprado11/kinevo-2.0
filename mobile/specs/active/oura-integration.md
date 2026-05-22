# Integração com Oura Ring (Fase 1 de wearables diretos)

## Status
- [x] Rascunho
- [x] Em implementação
- [x] Concluída

> ✅ **FUNCIONAL EM PRODUÇÃO (2026-05-22).** App Oura registrado, config no banco,
> migrations 153/154/155 aplicadas, 6 edge functions v2 ACTIVE (config via DB,
> não Deno.env), crons ativos, `app.json` com clientId, e as **6 webhook
> subscriptions criadas e verificadas** na Oura (handshake do callback passou).
> Falta apenas: cada aluno conectar o próprio anel (Perfil → Conexões → Oura) —
> ação normal do usuário final, não de provisionamento.

## Contexto

Hoje os dados de saúde do aluno vêm do HealthKit/Health Connect (derivados do
celular/Apple Watch), com precisão limitada — daí o esforço de discrepância
(ver [`health-wearables-discrepancia-dados.md`](health-wearables-discrepancia-dados.md)).
Wearables dedicados (Oura, Whoop) entregam dados de **grau research**: HRV
(RMSSD), estágios de sono, FC repouso e um **score de prontidão/recuperação**
calibrado pelo próprio device.

Esta spec cobre **Oura como primeiro provedor direto**. Escolhida antes da Whoop
porque: API sem gate de aprovação, rate limit folgado (5.000 req/5min), registro
simples. Whoop virá em fase separada (tem review mensal de produção e rate limit
de ~60–80 usuários/app que precisa ser negociado).

A integração de **Strava já existente** (`mobile/lib/strava/`, edge functions
`strava-token-*`) é o template de OAuth cloud-to-cloud. A diferença é o **modelo
de sync** (ver decisão abaixo).

## Objetivo

Permitir que o aluno conecte sua conta Oura e tenha sono, HRV, FC repouso,
atividade e o **Readiness Score nativo** sincronizados automaticamente (inclusive
de madrugada, sem abrir o app), exibidos na aba de saúde com a fonte rotulada.

## Decisão de arquitetura — Modelo B (server-side + webhooks)

O Strava é **pull** (sincroniza quando o app abre; token no SecureStore do
device; refresh client-side). Para Oura isso é insuficiente: o valor é o
sono/recuperação que chega **de madrugada** e precisa estar pronto quando o aluno
abre o app, e o refresh de token tem que rodar com o app fechado.

**Adotar Modelo B:**
- Tokens armazenados **no backend** (Supabase), nunca no device.
- **Edge function de webhook** recebe eventos da Oura → busca o dado novo →
  grava nas tabelas de saúde.
- **Cron** (pg_cron) renova tokens e renova as subscriptions de webhook.
- O app só dispara o connect/disconnect e **lê as samples do banco** (a aba de
  saúde já lê de `daily_sleep_samples`/`hrv_samples`/etc).

Trade-off aceito: mais infra que o Strava, mas é o que dá dado fresco e escalável.
A infra de webhook/token será desenhada genérica para reuso na Whoop.

## Escopo

### Incluído
- OAuth 2.0 Authorization Code com Oura (registro de app + scopes).
- Edge functions: exchange, webhook (verify + receive), refresh (cron), disconnect.
- Storage seguro de tokens server-side.
- Backfill de 30 dias no connect + sync incremental via webhook.
- Mapeamento Oura → `daily_sleep_samples`, `hrv_samples`, `hr_resting_samples`,
  `daily_activity_samples` e Readiness Score nativo.
- UI: linha de conexão Oura em `app/profile/connections.tsx` + rótulo de fonte na
  aba de saúde.
- Resolver de **prioridade de fonte** (causa #6): Oura > Apple Watch/Health
  Connect > celular, por métrica/dia.

### Excluído
- Whoop (fase separada).
- SpO2, temperatura, frequência respiratória, stress, VO2max (fase 2 — só
  armazenar `raw` por ora).
- Compartilhamento dos dados com o treinador (já é regra à parte das tabelas).
- Substituir HealthKit/Health Connect (coexistem; Oura tem prioridade quando
  presente).

## Oura API — referência usada

> ✅ **Verificado contra a OpenAPI 1.29 (Oura API v2.0)** em 2026-05-22. Todos os
> endpoints, modelos e campos abaixo conferem com o spec. Confirmado: respostas
> multi-doc vêm em `{ data: [...], next_token }`; `total_sleep_duration` em
> SEGUNDOS; `efficiency` 1-100; `equivalent_walking_distance` em METROS;
> `readiness.score` 0-100; `average_hrv` integer (ms). `lowest_heart_rate` é o
> melhor proxy de FC repouso no modelo de sono (o spec nota que difere do valor
> exibido no app Oura). Existe ambiente **sandbox** (`/v2/sandbox/usercollection/...`)
> útil pra testar sem anel físico.
>
> **Fora da OpenAPI (confirmar nas docs de Webhooks/Auth da Oura):** URLs de
> OAuth (authorize/token) e scopes, payload do evento de webhook
> (`event_type`/`data_type`/`object_id`/`user_id`), handshake de verificação
> (GET com `challenge`) e o esquema da assinatura `x-oura-signature`. A
> implementação assume os padrões documentados pela Oura — validar no provisionamento.

- **Base:** `https://api.ouraring.com/v2`
- **Authorize:** `https://cloud.ouraring.com/oauth/authorize`
- **Token:** `https://api.ouraring.com/oauth/token`
- **Scopes necessários:** `personal` (personal_info → id do usuário), `daily`
  (sleep/readiness/activity), `heartrate` (série de FC). (`email` opcional.)
- **Endpoints (`/v2/usercollection/...`):**
  - `sleep` — períodos detalhados: `total_sleep_duration`, `time_in_bed`,
    `deep_sleep_duration`, `rem_sleep_duration`, `light_sleep_duration`,
    `awake_time`, `average_hrv` (**RMSSD em ms**), `lowest_heart_rate`,
    `efficiency`.
  - `daily_sleep` — score de sono + contributors.
  - `daily_readiness` — **readiness score** + contributors + temperature_deviation.
  - `daily_activity` — `steps`, `active_calories`, `equivalent_walking_distance`.
  - `heartrate` — série temporal (opcional fase 2).
  - `personal_info` — id do usuário Oura (→ `external_user_id`).
- **Webhooks:** `createSubscription({ callback_url, verification_token,
  event_type, data_type })`. Oura faz GET de verificação (responder o challenge)
  e assina os POSTs com `x-oura-signature` (validar com client_secret).
  `data_type` relevantes: `sleep`, `daily_sleep`, `daily_readiness`,
  `daily_activity`. `event_type`: `create`/`update`/`delete`. Subscriptions
  expiram → precisam de `renewSubscription` (cron).

## Arquivos Afetados

### Banco (migration aditiva, backward-compat)
| Mudança | Detalhe |
|---|---|
| `wearable_connections.source` CHECK | adicionar `'oura'` |
| `daily_sleep_samples.source` / `hrv_samples.source` / `hr_resting_samples.source` / `daily_activity_samples.source` | adicionar `'oura'` (se houver CHECK) |
| `readiness_scores` | adicionar coluna `source text default 'computed'` + (opcional) `native_score int`; permite armazenar o readiness nativo da Oura sem quebrar o computado |
| **Nova tabela** `wearable_oauth_tokens` | `student_id`, `source`, `access_token`, `refresh_token`, `expires_at`, `scope`, `external_user_id`, `webhook_subscription_ids jsonb`. RLS: **somente service_role** (nunca exposto ao client). Cifrar via Supabase Vault/pgsodium. |

### Edge functions (`supabase/functions/`)
| Função | Responsabilidade |
|---|---|
| `oura-oauth-exchange` | code → tokens; grava em `wearable_oauth_tokens`; cria webhook subscriptions; dispara backfill 30d; upsert `wearable_connections` (active) |
| `oura-webhook` | GET verify (challenge) + POST receive (valida `x-oura-signature`, busca o dado do `data_type`/dia, mapeia e grava nas tabelas) |
| `oura-token-refresh` | chamada por **cron** (pg_cron); renova tokens perto de expirar e renova subscriptions |
| `oura-disconnect` | revoga token na Oura, deleta subscriptions e linhas de token, marca conexão `revoked` |
| `_shared/wearableProvider.ts` | abstração genérica (exchange/refresh/mapeamento) reusável p/ Whoop |

### Mobile
| Arquivo | Mudança |
|---|---|
| `lib/oura/oauth.ts` | abre o browser p/ authorize; recebe `code` via deep link; **chama `oura-oauth-exchange`** (token NÃO fica no device) |
| `lib/oura/types.ts` | tipos do payload Oura |
| `hooks/useOuraSync.ts` | connect / disconnect / status (lê `wearable_connections`) |
| `components/oura/ConnectionRowOura.tsx` | linha de conexão (espelha `ConnectionRowStrava`) |
| `app/profile/connections.tsx` | adicionar a linha Oura |
| `lib/hrv.ts` | `hrvMetricFromSource`: `'oura' → 'rmssd'` |
| `hooks/useHealthDashboard.ts` + `app/health/[metric].tsx` | já leem por `source`; ajustar prioridade de fonte e rótulo "Oura" |
| `web/public/oura-callback.html` | página de callback (generalizar a de Strava) |

## Comportamento Esperado

### Fluxo do Usuário
1. Aluno vai em Perfil → Conexões → "Conectar Oura".
2. Abre o browser na tela de autorização da Oura; faz login e autoriza.
3. Volta pro app; vê "Oura conectado" e "Importando últimos 30 dias…".
4. A aba de saúde passa a mostrar sono/HRV/FC/readiness com a fonte **Oura** e
   rótulo de métrica "HRV RMSSD".
5. A cada noite, novos dados aparecem automaticamente (via webhook), sem abrir o app.

### Fluxo Técnico
1. `lib/oura/oauth.ts` abre `authorize` (scopes `personal daily heartrate`),
   recebe `code` via `oura-callback.html` → deep link.
2. App chama `oura-oauth-exchange` com o `code`.
3. Edge function troca por tokens, grava em `wearable_oauth_tokens`, cria webhook
   subscriptions, faz backfill de 30d (sleep/readiness/activity), upsert
   `wearable_connections` (`source='oura'`, `external_user_id`).
4. Oura envia webhook a cada novo dado → `oura-webhook` valida assinatura, busca o
   recurso, mapeia e faz upsert nas tabelas de saúde (respeitando prioridade de
   fonte).
5. `oura-token-refresh` (cron diário) renova tokens e subscriptions.

### Mapeamento de dados
| Origem Oura | Tabela Kinevo | Campo |
|---|---|---|
| `sleep.total_sleep_duration` | `daily_sleep_samples.duration_minutes` | seg→min |
| `sleep.deep/rem/light_sleep_duration` | `deep/rem/light_minutes` | seg→min |
| `sleep.awake_time` | `awake_minutes` | seg→min |
| `sleep.efficiency` | `efficiency_pct` | direto |
| `sleep.average_hrv` | `hrv_samples.value_ms` | RMSSD; `source='oura'` |
| `sleep.lowest_heart_rate` (ou daily) | `hr_resting_samples.bpm` | direto |
| `daily_activity.steps/active_calories/distance` | `daily_activity_samples.*` | direto |
| `daily_readiness.score` | `readiness_scores` (`source='oura'`, score nativo) | exibir no lugar do computado quando presente |
| payload completo | coluna `raw` | auditoria/fase 2 |

## Critérios de Aceite
- [ ] Aluno conecta/desconecta Oura; status reflete em `wearable_connections`
- [ ] Tokens vivem **apenas no backend** (nunca em SecureStore/MMKV/cliente)
- [ ] Backfill de 30 dias popula sono/HRV/FC/atividade/readiness
- [ ] Webhook entrega dado novo de madrugada sem o app aberto; assinatura validada
- [ ] Cron renova token e subscription antes de expirar
- [ ] HRV da Oura rotulado como RMSSD; baseline não mistura com SDNN do Apple
- [ ] Quando há Oura + Apple Watch no mesmo dia, prevalece a fonte de maior prioridade (#6)
- [ ] Readiness nativo da Oura exibido quando disponível
- [ ] Disconnect revoga token na Oura e remove subscriptions
- [ ] Sem novos erros de TypeScript; migrations backward-compat
- [ ] Conformidade LGPD: consentimento explícito + exclusão de dados no disconnect

## Restrições Técnicas
- Seguir CLAUDE.md: zero `any` novo, mudanças cirúrgicas, retrocompat.
- `client_secret` **somente** em edge function (nunca no app).
- Token table acessível só por service_role; cifrar em repouso.
- Funções de mapeamento puras e idempotentes (upsert por `student_id,sample_date`).
- Reaproveitar o padrão de edge function e callback do Strava.

## Edge Cases
- Aluno autoriza mas não tem dados ainda (anel novo) → conexão active, samples vazias.
- Webhook duplicado/reentrega → upsert idempotente.
- Assinatura de webhook inválida → 401, ignora.
- Token revogado pelo usuário no app da Oura → próxima chamada 401 → marcar conexão `error`/`revoked`.
- Subscription expirada → cron renova; se falhar, re-cria no próximo connect.
- Aluno com Oura + Apple Watch → resolver de prioridade por dia/métrica.
- Fuso horário: Oura entrega `day` local; manter bucket em data local (consistente com `toDateOnlyISO`).
- Disconnect com falha remota → limpar local mesmo assim (best-effort, como Strava).

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] Mapeadores Oura→linha (sleep/readiness/activity): seg→min, campos nulos, idempotência.
- [ ] `hrvMetricFromSource('oura') === 'rmssd'`.
- [ ] Resolver de prioridade de fonte: Oura sobrescreve Apple Watch no mesmo dia, e não o contrário.
- [ ] Validação de assinatura de webhook (HMAC com client_secret).

### Server / Edge (recomendado)
- [ ] `oura-oauth-exchange` com Oura mockado: grava token + cria subscription + backfill.
- [ ] `oura-webhook` receive: valida assinatura, busca recurso, upsert correto.

## Dependências / Decisões a confirmar
1. **Cifragem de token**: Supabase Vault/pgsodium vs coluna restrita por RLS. (Recomendado: Vault.)
2. **Readiness**: exibir o score nativo da Oura quando presente e manter o computado como fallback? (Recomendado: sim.)
3. **Registro do app Oura** + aceite do [API Agreement](https://cloud.ouraring.com/legal/api-agreement) (volume/uso comercial).
4. **Prioridade de fonte (#6)**: confirmar ordem Oura > Apple Watch/Health Connect > celular.
5. **LGPD**: texto de consentimento e fluxo de exclusão de dados.

## Referências
- [Oura API v2 docs](https://cloud.ouraring.com/v2/docs) · [Autenticação](https://cloud.ouraring.com/docs/authentication) · [API Agreement](https://cloud.ouraring.com/legal/api-agreement)
- Template interno: `mobile/lib/strava/`, `supabase/functions/strava-token-exchange`, `strava-token-refresh`, `web/public/strava-callback.html`
- Tabelas: `supabase/migrations/129_wearable_data_schema.sql`, `130_external_activities.sql`
- Métrica HRV: `mobile/lib/hrv.ts` (Batch 2 da spec de discrepância)

## Notas de Implementação

### Implementado (2026-05-21) — código completo, validado (tsc 0 / 292 testes)

**Banco** — `supabase/migrations/153_oura_integration.sql`
- Estende CHECK de `source` ('oura'/'whoop') em wearable_connections + 4 tabelas de samples.
- `readiness_scores.source` ('computed'|'oura'|'whoop').
- Nova tabela `wearable_oauth_tokens` (RLS sem policies → só service_role).
- **Prioridade de fonte (#6) via trigger** `guard_wearable_source_priority`
  (BEFORE UPDATE nas 5 tabelas): oura/whoop > healthkit/health_connect >
  computed. Centraliza a regra no banco → vale pra sync mobile E edge sem
  alterar código de app. `recomputeReadinessLastDays` e `useReadinessToday`
  passaram a declarar `source: 'computed'` pra o trigger proteger o score nativo.

**Edge functions** (`supabase/functions/`)
- `_shared/oura.ts` — OAuth (exchange/refresh), Oura API (sleep/readiness/
  activity/personal_info/document), mapeamento → tabelas, `backfillOura`,
  `ensureValidToken`, `verifyOuraSignature`.
- `oura-oauth-exchange` — code→tokens, guarda server-side, backfill 30d, conexão ativa.
- `oura-sync` — sync manual (botão "Sync agora").
- `oura-webhook` — GET handshake + POST evento (valida assinatura, mapeia user→aluno, grava dia).
- `oura-token-refresh` — cron (pg_cron), renova tokens <24h.
- `oura-disconnect` — revoga + apaga tokens + marca revoked.
- `oura-webhook-setup` — idempotente, cria subscriptions de app (rodar 1x).

**Mobile**
- `lib/oura/types.ts`, `lib/oura/oauth.ts` (OAuth via browser + edge functions; **token nunca no device**).
- `hooks/useOuraSync.ts` (connect/sync/disconnect/status).
- `components/oura/ConnectionRowOura.tsx` + seção "Wearables dedicados" em `app/profile/connections.tsx`.
- `lib/hrv.ts`: `oura`/`whoop` → RMSSD. Chip "Oura Ring" na aba de saúde.
- `web/public/oura-callback.html`; `app.json` extra.oura.clientId (vazio — preencher após registro).
- Testes: `lib/hrv.test.ts` cobre oura/whoop.

### Deploy em produção — FEITO via Supabase MCP (2026-05-22)
Projeto **Kinevo 2.0** (`lylksbtgrihzepbteest`):
- ✅ Migration `153_oura_integration` aplicada (schema + 5 triggers de prioridade + função guard). Verificado.
- ✅ Migration `154_oura_cron_schedule` aplicada (pg_cron: `oura-token-refresh-daily` 03:00 UTC, `oura-webhook-setup-weekly` seg 03:30 UTC — ambos `active`).
- ✅ 6 edge functions ACTIVE: `oura-oauth-exchange`, `oura-sync`, `oura-disconnect` (verify_jwt=true); `oura-webhook`, `oura-token-refresh`, `oura-webhook-setup` (verify_jwt=false).

**Falta só (exige conta Oura do usuário):**
1. Registrar app Oura → `client_id`/`client_secret`.
2. `supabase secrets set OURA_CLIENT_ID, OURA_CLIENT_SECRET, OURA_WEBHOOK_VERIFICATION_TOKEN, OURA_WEBHOOK_CALLBACK_URL=https://lylksbtgrihzepbteest.functions.supabase.co/oura-webhook` (posso setar via MCP quando receber os valores).
3. `app.json` → `extra.oura.clientId`.
4. Invocar `oura-webhook-setup` 1x (cria as subscriptions). Os crons cuidam da manutenção.

### Provisionamento automatizado (alternativa ao MCP)
Após registrar o app Oura e ter o `client_id`/`client_secret`, todo o deploy é
um comando: `scripts/provision-oura.sh` (secrets + `db push` + deploy das 6
functions com os flags de JWT corretos + cria subscriptions) e
`scripts/oura-cron.sql` (agenda os 2 crons via pg_cron). Detalhe manual:
preencher `mobile/app.json` → `extra.oura.clientId`.

### Passos de provisionamento (manuais — exigem credenciais/deploy)
1. Registrar app em https://cloud.ouraring.com/oauth/applications
   - Redirect URI: `https://www.kinevoapp.com/oura-callback`
   - Aceitar o [API Agreement](https://cloud.ouraring.com/legal/api-agreement).
2. Preencher `mobile/app.json` → `extra.oura.clientId`.
3. Secrets no Supabase (`supabase secrets set`):
   `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`, `OURA_WEBHOOK_VERIFICATION_TOKEN`,
   `OURA_WEBHOOK_CALLBACK_URL=https://<ref>.functions.supabase.co/oura-webhook`.
4. Aplicar migration 153 (com autorização).
5. Deployar as 6 edge functions (com autorização).
6. Agendar `oura-token-refresh` via pg_cron (diário).
7. Invocar `oura-webhook-setup` uma vez (cria as subscriptions de app) **e
   agendá-la via pg_cron (semanal)** — subscriptions da Oura expiram
   (`expiration_time`) e a função renova as que estão a <7 dias de expirar
   (PUT /v2/webhook/subscription/renew/{id}).
8. (Opcional) `npm run gen:types` — o mobile usa `.from(... as any)` nas tabelas
   wearable, então não bloqueia o build.

### Verificação contra docs de Auth (2026-05-22) — confirmado
- Authorize `https://cloud.ouraring.com/oauth/authorize` e Token
  `https://api.ouraring.com/oauth/token` — batem com o código.
- Scopes: `personal` (personal_info) + `daily` (sleep/readiness/activity) +
  `heartrate` (HRV/série). Mantido `personal daily heartrate` no `oauth.ts`.
- **Refresh tokens são SINGLE-USE** (invalidados após uso). O código persiste o
  novo refresh_token a cada renovação (`ensureValidToken`). Adicionado guard no
  cron `oura-token-refresh`: em falha de refresh, re-checa o row antes de marcar
  erro (evita falso-erro quando o webhook renovou no mesmo intervalo).

### Pendências de produto / hardening
- Cifrar tokens em repouso (Supabase Vault) — hoje em coluna protegida por RLS service-role (consistente com o padrão Google Calendar do repo).
- **Confirmar payload do evento e o esquema da assinatura `x-oura-signature`** na
  doc de Webhooks da Oura (não está na OpenAPI nem em fonte pública estável;
  página de docs JS-rendered/gated). Implementação assume HMAC-SHA256(body).
- LGPD: texto de consentimento + fluxo de exclusão (disconnect já apaga tokens).
- Validação end-to-end em device real com anel Oura.
