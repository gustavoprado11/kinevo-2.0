# Análise: aba Saúde do app do aluno — por que os dados ficam desatualizados

> Data: 07/jul/2026. Queixa: "os dados nem sempre estão atualizados". Método: mapeamento de código (mobile + edge functions) + verificação AO VIVO no banco de produção (frescura por tabela/fonte, estado das conexões, crons pg_cron, respostas pg_net, diff das functions deployadas).

## 0. Sumário executivo

A aba Saúde **nunca lê HealthKit/Strava ao vivo** — ela mostra o retrato que o último sync deixou no Postgres. E esse sync é quase todo **client-side**: roda quando o app está aberto (focus com debounce de 5 min, pull-to-refresh) ou num background fetch de 12h que o iOS executa quando quer (ou nunca). A única fonte com atualização server-side é o Oura (webhook + crons) — **e é justamente a que está morta desde 23/mai**. Para piorar, o indicador "Atualizado há X" mede a última *tentativa* de sync (mesmo vazia ou com erro), então a aba diz "atualizado agora" mostrando dado velho.

**Números de produção (hoje):** dos 8 alunos com dados, só **3 estão atualizados nas últimas 24h**; 3 estão 2-7 dias defasados; 2 há mais de 7 dias. Das 20 conexões HealthKit, **15 estão em `error`** ("Authorization not determined" e "Protected health data is inaccessible" — sync tentado com o iPhone bloqueado). Oura: 1 conexão "active" sem dado desde 23/mai. Strava: 1 conexão "active" sem sync desde 29/mai.

**As 3 correções de maior alavancagem:** (1) honestidade — indicador de frescor real + banner de erro na própria aba (hoje o aluno só descobre problema se navegar até Perfil→Conexões); (2) semântica dos cards — HR/HRV/Passos exigem `sample_date = hoje` e mostram "–" quando o dado legítimo é de ontem; (3) estrutural — webhook do Strava e diagnóstico do webhook Oura, para dado atualizar sem o app aberto.

## 1. Verificado ao vivo (produção, 07/jul)

| Fonte | Conexões | Última amostra | Último sync | Estado |
|---|---|---|---|---|
| HealthKit (iOS) | 5 active + **15 error** | hoje | hoje 14:18 | Funciona p/ quem abre o app com permissão OK |
| Health Connect (Android) | 3 active | — | hoje 10:24 | OK |
| Oura | 1 active | **23/mai** | 23/mai | **MORTO há 6 semanas** |
| Strava | 1 active | — | **29/mai** | **MORTO há 5+ semanas** |

- Frescura por aluno (daily_activity_samples): 3/8 ≤24h · 3/8 entre 2-7d · 2/8 >7d.
- Erros das 15 conexões HealthKit: `Code 5 "Authorization not determined"` (permissão nunca resolvida naquele device/reinstal) e `Code 6 "Protected health data is inaccessible"` (HealthKit criptografado com o aparelho BLOQUEADO — o background fetch de 12h tenta ler com a tela travada e falha).
- **Oura: os crons estão vivos e os tokens também** — `oura-token-refresh-daily` (3h UTC) e `oura-webhook-setup-weekly` rodam e respondem `{"success":true}` (pg_net, últimos 7 dias). O que não chega são os **eventos do webhook**. Suspeitos: assinatura de webhook inválida no lado da Oura apesar do setup "success", ou o único aluno parou de usar o anel (não distinguível de fora — ver §5 probe).
- **Strava functions: hardening ESTÁ deployado** — `strava-token-refresh` v3 (2/jul) é byte-idêntica ao repo (verifiquei por diff). O item R1 do STATUS ("deploy Strava fns — autorizar!") estava obsoleto: já foi. Nota: o Strava morreu em 29/mai, ANTES do hardening — a causa é estrutural (C1), não a function.
- 9 respostas `503 SUPABASE_EDGE_RUNTIME_SERVICE_DEGRADED` na semana — blips do runtime; reforçam a necessidade de retry/resiliência nos callers.

## 2. Pipeline (mapa)

```
Apple Saúde/Health Connect ─┐                                        ┌─ useHealthDashboard (mount/refresh,
Strava API ─────────────────┼─ SYNC CLIENT-SIDE (app aberto):        │   SEM cache; sem realtime)
                            │   focus (debounce 5min) ·              ├─ useHealthInsights (cache MMKV 6h,
                            │   pull-to-refresh ·                    │   chave por dia UTC)
                            │   background fetch 12h (oportunista)   ├─ useStravaWeekSummary (mount)
                            ▼                                        │
                    daily_sleep/activity/hrv/hr_resting_samples ─────┤
                    external_activities · readiness_scores           │
                    wearable_connections.last_sync_at ───────────────┴─ "Atualizado há X" (health.tsx:135-141)
                            ▲
Oura ── webhook + crons (ÚNICA fonte server-side; morta desde 23/mai)
```

Arquivos-chave: `mobile/app/(tabs)/health.tsx` · `mobile/app/health/[metric].tsx` · `hooks/useHealthDashboard.ts` · `hooks/useHealthInsights.ts` · `hooks/useStravaActivities.ts` · `lib/healthSync/{healthKitSync,stravaSync,shared}.ts` · `lib/healthSyncTask.ts` · `app/_layout.tsx:530-539` · `app/profile/connections.tsx` · `supabase/functions/strava-*`, `oura-*` · `supabase/migrations/154_oura_cron_schedule.sql`.

## 3. Causas de dado desatualizado (14, por severidade)

| # | Sev. | Causa | Evidência |
|---|---|---|---|
| C1 | **Crítica** | Sem atualização server-side p/ HealthKit/Strava — sem app aberto, nada atualiza. Só o Oura tem webhook/cron. | ausência de `strava-webhook`/`strava-sync` em `supabase/functions/` |
| C2 | **Crítica** | Background fetch de 12h é piso oportunista do iOS (pode nunca rodar: force-quit, low power). | `healthSyncTask.ts:126` |
| C3 | Alta | Background App Refresh desligado = zero sync em 2º plano, sem aviso ao aluno. | `healthSyncTask.ts:120-124` |
| C4 | Alta | Permissão HealthKit revogada = queries vazias SEM erro → status `active`, dado congela para sempre. | `useHealthKitSync.ts:44-46`, `healthKitSync.ts:301-333` |
| C5 | Alta | "Atualizado há X" mede a última TENTATIVA (grava `last_sync_at` mesmo vazio/erro) — o indicador mente. | `shared.ts:159`, `health.tsx:230` |
| C6 | Média | Frescor agrega conexões em `error`/`revoked` no max() — erro recente mascara dado velho. | `health.tsx:136-141` |
| C7 | Alta | Cards HR/HRV/Passos exigem `sample_date = HOJE`; HR-repouso/HRV do Watch normalmente só existem p/ ontem → card "–"/velho enquanto o detalhe (usa o mais recente) mostra valor. | `useHealthDashboard.ts:69-76` vs `[metric].tsx:172-222` |
| C8 | Média | Backoff exponencial silencioso: 3 falhas → pula ciclos por 12h+. | `healthSyncTask.ts:53-96` |
| C9 | Média | Cache de insights MMKV 6h com chave por dia **UTC** (dashboard usa dia local) — vira o dia em horas diferentes; sem invalidação por sync novo. | `useHealthInsights.ts:18,55-63` |
| C10 | Média | Refresh de token Strava em background exige JWT de usuário válido (hardening); sessão Supabase expirada → 401 silencioso. | `oauth.ts:166-198`, `strava-token-refresh/index.ts:37-53` |
| C11 | ~~Média~~ **VERIFICADO OK** | Functions Strava deployadas == repo (v3, 2/jul, diff idêntico). | `get_edge_function` vs repo |
| C12 | Baixa | Debounce de 5 min no focus — reabrir a aba não força sync. | `health.tsx:101-106` |
| C13 | Baixa | Sem realtime nas tabelas — gravação do webhook/outro device não reflete com a aba aberta. | `useHealthDashboard.ts` |
| C14 | Info | Métricas de "hoje" são parciais por natureza (acumulam no dia) — já tem nota na UI. | `health.tsx:309-312` |

## 4. UX de erro hoje

Falha de sync no focus e TODO o sync do Strava são silenciosos (`health.tsx:85,115,119-121`); pull-to-refresh mostra toast genérico. **A aba nunca sinaliza fonte quebrada** — os estados reais ("Revogado · Reconectar", "Erro na última sync") existem só em Perfil→Conexões (`connections.tsx:195-239`), onde o aluno não vai. Card sem dado mostra "–" sem distinguir "não coletado" de "sync quebrado". Resultado: dado velho com cara de dado atual.

## 5. Plano de melhoria (fases)

**Fase 1 — honestidade + quick wins (S, só mobile, entra no build 1.5.7):**
1. Cards HR/HRV/Passos usam o registro mais recente com rótulo temporal ("· ontem"), como o detalhe já faz (C7).
2. Indicador de frescor real: só conexões `active` + separar `last_data_at` (dado gravado) de `last_sync_at` (tentativa) (C5/C6 — exige coluna nova ou usar `max(synced_at)` dos samples).
3. Sync no cold-start autenticado + debounce de focus 5min→60-90s (C2 parcial/C12).
4. Banner de estado na própria aba quando alguma conexão está em `error`/sem sync há >24h, com CTA "Reconectar" → Conexões (C4/C5/C8 visibilidade). Aproveitar: alertar quando Background App Refresh está desligado (C3, o task já detecta).

**Fase 2 — robustez (M):**
5. Refresh da sessão Supabase antes do `functions.invoke` no background task (C10).
6. Cache de insights: chave por dia LOCAL + invalidação quando um sync grava amostra nova (C9).
7. Marcar `status='error'`+`last_error` também nos caminhos que hoje engolem exceção (HRV, Strava silencioso).
8. **Probe do Oura**: invocar `oura-sync` manualmente p/ o aluno conectado e ver a resposta da API (token vivo ≠ assinatura de webhook viva); se a assinatura estiver morta apesar do setup semanal "success", corrigir o `oura-webhook-setup` (verificar lista de subscriptions de verdade, não só POST cego).

**Fase 3 — estrutural (L):**
9. **Webhook do Strava** (push subscription + edge `strava-webhook`/`strava-sync`) — dado do Strava atualiza sem o app aberto, paridade com o desenho do Oura.
10. Cron de reconciliação diário p/ Strava/Oura (varre conexões `active`, sincroniza server-side, marca `error` com motivo real) — vira também o watchdog que teria pego o Oura morto em maio.
11. Realtime subscription nas tabelas de health p/ a aba refletir gravações externas (C13).

*(HealthKit continua client-side por natureza — Apple não dá API server-side; o teto ali é Fase 1+2 bem feitas + push silencioso para acordar o app, se um dia valer o esforço.)*

---

## 6. ADENDO (07/jul, mesma data) — probe, ROOT CAUSE do Oura e Fase 1 implementada

**Probe do Oura (conclusivo):** token válido (refresh diário ok) e a API da Oura com dados frescos (15 noites/14 dias de atividade nos últimos 14 dias) — o aluno nunca parou de usar o anel. As 6 assinaturas de webhook estão ativas e corretas no lado da Oura (expiram 05/out, renovadas pelo cron semanal).

**ROOT CAUSE (confirmado na doc oficial da Oura, "Security Best Practices → Verify Webhook Signatures"):** a Oura assina **HMAC-SHA256 de `timestamp + body`** (headers `x-oura-signature` + `x-oura-timestamp`); o `verifyOuraSignature` do Kinevo assinava **só o body** → **TODO evento real falhava com 401 `invalid_signature`**. O webhook nunca ingeriu um evento; todas as amostras Oura do banco tinham o MESMO `synced_at` (23/mai 15:37) — vieram de um único sync manual. O comentário no código ("Confirmar esquema exato na doc da Oura") era a confissão.

**Feito em 07/jul:**
- **Backfill de 46 dias executado** (réplica fiel do `backfillOura`, service role): 47 dias gravados; a aba do aluno com Oura voltou a mostrar dados atuais.
- **Fix no repo** (`supabase/functions/_shared/oura.ts` + `oura-webhook/index.ts`): assinatura agora cobre `timestamp + body` (aceita raw e re-serializado), com log estruturado no 401 para nunca mais morrer em silêncio. **⏳ PENDENTE DE DEPLOY (exige autorização).** Sem o deploy, o Oura volta a ficar stale a partir de amanhã.
- **Fase 1 mobile implementada** (working tree; tsc 0, 374 testes): C7 cards usam o registro mais recente com rótulo temporal ("· ontem"/dd/mm — sono/HR/passos/HRV, e o readiness sheet pré-treino ganhou a mesma semântica); C5/C6 frescor honesto ("Dados de há X" = max(`synced_at`) dos registros exibidos, fallback só em conexões ativas); C12 debounce de focus 5min→90s; C2 parcial one-shot de sync no cold-start (`_layout`, +10s, respeita backoff); C3/C4 banner na própria aba (fonte em erro → CTA Conexões; Atualização em 2º plano desligada; sem dado novo >24h).
- **C11/R1 fechado:** functions Strava deployadas == repo (diff idêntico, v3 de 2/jul).

---

## 7. ADENDO — FASE 3 (07/jul, mesma sessão): watchdog + webhook Strava

**Implementado e DEPLOYADO em prod:**
- **`wearable-reconcile` (o WATCHDOG) — DEPLOYADO + PROVADO ao vivo + cron diário 04:00 UTC ativo.** É a correção estrutural central: varre as conexões Oura/Strava não-revogadas, sincroniza server-side e grava o desfecho REAL na conexão (status + last_error). No 1º run já (a) re-sincronizou o Oura e (b) **marcou o Strava como `error` com motivo honesto** — exatamente o comportamento que teria pego o Oura mudo em maio no 1º dia, em vez de 6 semanas depois.
- **`strava-webhook` + `strava-webhook-setup` — DEPLOYADAS; handshake PROVADO** (GET ecoa `hub.challenge`; verify_token errado → 403). Segurança: Strava não assina eventos (sem HMAC), então o webhook trata o payload como DICA — usa `owner_id` só para achar o aluno e busca a VERDADE na API com o token dele (payload forjado, no pior caso, dispara re-busca de dado real).
- **Persistência de token server-side**: `strava-token-exchange`/`refresh` agora gravam os tokens em `wearable_oauth_tokens` (antes só no SecureStore do device — por isso webhook/cron eram impossíveis). Conexões antigas ganham token no 1º refresh disparado pelo app.
- **Migration 236** (constraint aceita `source='strava'` em `wearable_oauth_tokens` e `wearable_provider_config`; crons diário+semanal) + linha de config `strava` (verification_token/callback_url/setup_secret gerados). `strava-webhook-setup-weekly` (seg 03:45) também ativo.

**⚠️ BLOQUEADOR EXTERNO (ação manual do Gustavo, não é código):** a criação da push subscription falhou com `403 Application Status: Inactive`. Causa (doc Strava): o app do Developer Program Standard Tier exige que **a conta dona do app tenha uma assinatura Strava (paga) ativa**; sem ela o app fica "Inactive" e o endpoint de webhook (e provavelmente a leitura de atividades server-side) é bloqueado. **Fix:** logar na conta Strava dona do app 244932 → assinar o Strava → reativar o app em https://www.strava.com/settings/api. Depois disso, `strava-webhook-setup` cria a subscription sozinho (o cron semanal já tenta toda segunda) e o reconcile passa a sincronizar. Enquanto isso, o watchdog mantém o status do Strava honesto (marca `error`, o aluno vê o banner).

**Estado da conexão Strava agora:** o único aluno com Strava está `status=error` ("Sem sincronizar há dias — abra o app Kinevo") — correto (parada desde 29/mai). Sequência p/ revivê-lo: (1) Gustavo reativa o app Strava; (2) aluno abre o Kinevo → refresh persiste o token server-side; (3) reconcile diário passa a sincronizar + webhook entrega em tempo real.

**F3 residual (não-bloqueante):** o `mapActivityToRow` do servidor (`_shared/strava.ts`) espelha `mobile/lib/strava/mapping.ts` — manter os dois em sincronia se o schema mudar.

---

## 8. ADENDO — FASE 2 (07/jul, mesma sessão): robustez

Working tree mobile (tsc 0, 374 testes) + migration 237 aplicada:
- **C10 — refresh de sessão no background** (`healthSyncTask.ts`): novo `ensureFreshSession()` antes do sync — em 2º plano o auto-refresh do supabase-js fica pausado e o access_token pode acordar expirado, derrubando silenciosamente as escritas (RLS 401) e o refresh de token do Strava (edge `getUser(jwt)` → 401). Só faz round-trip quando falta <5min p/ expirar; sem sessão → skip limpo (não conta como falha de sync).
- **C9 — cache de insights por dia LOCAL** (`useHealthInsights.ts`): `todayUtcString`→`todayLocalString` (reusa `toLocalDateISO`). O UTC virava o dia na hora errada; a invalidação por sync novo já vinha do refresh no focus/pull + agora do realtime (C13).
- **Item 7 — HRV deixa de engolir exceção** (`healthKitSync.ts`): a falha do HRV agora seta `lastError` como as outras categorias (sem Apple Watch o HealthKit retorna VAZIO, não lança — então chegar no catch é erro real; self-healing no próximo sync ok). Nota: o "Strava silencioso" já estava coberto — `stravaSync` grava `status='error'` no banco e o banner da F1 lê isso; o silêncio era só no toast do caller.
- **C13 — realtime** (`migration 237` + `useHealthDashboard.ts`): as 6 tabelas de saúde entraram na publicação `supabase_realtime`; a aba assina as próprias linhas (RLS filtra por aluno, confirmado) e faz refresh coalescido (debounce 1,2s) quando webhook/reconcile/outro device grava — sem esperar refocus/pull.

Tudo isso é mobile/DB; o realtime (migration 237) está em prod. As Fases 1+2 mobile entram juntas no build EAS 1.5.7. **Frente Saúde: só resta a Fase 3-residual do Strava (bloqueador externo do app Strava) e o commit/build do que está pronto.**
