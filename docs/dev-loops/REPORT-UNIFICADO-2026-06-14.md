# Dev Loops — Relatório Unificado — 2026-06-14

## Cobertura (domínios rodados ✓ / falhos ✗)

| Domínio | Status | Verificadas | fixWorthy |
|---|---|---|---|
| security | ✓ rodado | 5 (5 confirmadas, 0 uncertain, 0 refutado) | 3 |
| seo/geo | ✓ rodado | 10 (5 gap_real, 1 ja_ok, 3 low_value) | 3 |

**Sem cobertura nesta rodada:** performance, acessibilidade, qualidade de código/testes, mobile/RN, billing/webhooks Asaas-Stripe, RLS cross-tenant por signup (citado como pendente em memória, não re-rodado aqui). `liveProbe=OFF` no loop de segurança — conclusões por leitura de fonte (determinísticas: ausência de guard é textual). SEO baseado em HTML SSR real de `https://www.kinevoapp.com`.

**Deduplicação:** os 2 domínios não compartilham arquivos nem causa-raiz — security vive em `actions/`, `supabase/functions/`, `lib/rate-limit.ts`; SEO em `components/landing/`, `app/layout.tsx`, `app/*/page.tsx`. **Zero duplicatas.** Todas as linhas abaixo são distintas.

## 🎯 Lista de ação priorizada

Ordenada por severidade×impacto. Esforço: P=pequeno, M=médio, G=grande.

| # | Domínio | Item | Sev/Impacto | Esforço | Evidência (file:line) |
|---|---|---|---|---|---|
| 1 | security | IDOR cross-tenant em `migrateContract`: usa `studentId` do corpo sem validar posse de tenant | 🔴 alto | M | `web/src/actions/financial/migrate-contract.ts` (valida só `fromContractId` .eq trainer_id L70; insere `student_id` via supabaseAdmin L199-219, RLS bypass; stripe `generate-checkout.ts:29-33/71-75` sem coach_id) |
| 2 | security | `oura-webhook-setup` aceita POST anônimo (verify_jwt=false, sem secret/assinatura) | 🟠 medio | P | `supabase/functions/oura-webhook-setup/index.ts:27-30` (vs fail-closed `send-push-notification/index.ts:23-29`) |
| 3 | security | Rate limiter em `Map` por instância — não-global em serverless; orçamento LLM/MCP ilimitado via concorrência | 🟠 medio | G | `web/src/lib/rate-limit.ts:9` (`new Map`); call sites `mcp/auth.ts:118-123`, `assistant/chat/route.ts:44-49`, `oauth/register/route.ts:30-35`; grep upstash/kv/redis=0 |
| 4 | seo | Falta parágrafo definitório "o que é / pra quem" em prosa contínua citável no hero | 🟠 médio | P | `web/src/components/landing/landing-hero.tsx` (H1 L647-658, sub L661-672); `"Kinevo é um sistema"`=0× no corpo visível (só no JSON-LD) |
| 5 | seo | Métodos avançados de prescrição ausentes do SSR e do schema | 🟠 médio | P | grep drop-set/pirâmide/cluster/5x5/backoff/superset/%1RM=0; `web/src/app/layout.tsx:101-110` (featureList) + `landing-pillars.tsx:565-568` |
| 6 | seo | Nenhuma menção nominal a MFIT/Tecnofit/Trainerize no SSR/FAQ | 🟠 médio | P | grep mfit/tecnofit/trainerize=0; `web/src/components/landing/landing-pricing.tsx` + `landing-faq.tsx` |
| 7 | seo | Canonical aponta pro root em TODAS subpáginas (+ og:url /android sem www; /terms+/privacy sem metadata) | 🟠 médio | M | `web/src/app/layout.tsx:22-24` hardcoda canonical=root; `web/src/app/android/page.tsx:11`; `terms/page.tsx`; `privacy/page.tsx` |
| 8 | security | 4 cron functions invocáveis anonimamente (risco residual aceito) | 🟡 baixo | — | `dispatch-scheduled-notifications:33`, `extend-scheduled-notifications:49`, `renew-google-watch-channels:40`, `oura-token-refresh:12`; mitigado por idempotência |
| 9 | security | Lookup de exercício em tools de escrita não filtra `owner_id` — leak de name/equipment (risco residual aceito) | 🟡 baixo | — | `web/src/...workouts-write.ts:311-315/553-557/631-634` (read tool filtra: `exercises.ts:104`) |
| 10 | seo | /android og:url sem www + twitter genéricas (coberto pelo fix #7) | 🟡 baixo | P | `/tmp/kinevo_android.html` (`og:url=https://kinevoapp.com/android`) |

**Itens 8 e 9** são `fixWorthy=false` — aceitos como risco residual (cron tem input ignorado + idempotência; leak exige UUID não-enumerável e expõe só metadado, sem PII). **Item 10** é absorvido pelo fix #7.

## 🛠️ Prompts de fix (consolidados)

### 🔒 Segurança — TODOS REQUEREM REVISÃO HUMANA (não auto-aplicável)
Ver prompts completos em [REPORT-SEGURANCA-2026-06-14.md](./REPORT-SEGURANCA-2026-06-14.md): S1 IDOR migrateContract, S2 oura-webhook-setup, S3 rate limiter global.

### 📈 SEO/GEO (incremental — validar com `tsc --noEmit` + `curl`; não tocar no middleware matcher)
Ver prompts completos em [REPORT-SEO-GEO-2026-06-14.md](./REPORT-SEO-GEO-2026-06-14.md): G1 parágrafo definitório no hero, G2 métodos avançados, G3 concorrentes nomeados via FAQ, G4 canonicals self-referentes.

## Por domínio

**Segurança** — 5 vulns verificadas, todas confirmadas (cada uma com tentativa de refutação; 0 uncertain, 0 refutado). 1 alto = único furo real de cross-tenant (IDOR em `migrateContract` permite que Trainer A mute contratos/stripe_customer_id de aluno de Trainer B). 2 medio = abuso de recurso (webhook Oura anônimo; rate limiter não-global). 2 baixo aceitos como risco residual. Isolamento de tenant no resto: íntegro. **3 fixWorthy, todos requerem revisão humana.**

**SEO/GEO** — a landing root já está sólida para GEO — H1, JSON-LD (`SoftwareApplication`+`FAQPage` 13 Q), tabela comparativa e answerability do hero chegam no HTML estático (confirmado como `ja_ok`, sem ação). Os 5 gaps reais são incrementais (prosa citável, métodos avançados, nomes de concorrentes, canonicals self-referentes), não estruturais — 4 médio, 1 baixo, 0 alto. 3 fixWorthy auto-aplicáveis (texto/metadata, sem mudança de middleware).
