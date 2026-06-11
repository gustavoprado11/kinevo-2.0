# Resumo Executivo — Análise Noturna Kinevo (09/06/2026)

**Escopo:** análise 100% leitura do monorepo (web, mobile, shared, supabase) + leitura do banco de produção via MCP (somente SELECT/metadados). Relatórios completos: `00` mapa, `01` segurança, `02` backend, `03` web, `04` mobile, `05` qualidade, `06` comparativo, `07` oportunidades.

**Contexto:** dos relatórios anteriores, 70% (mobile) e 78% (web) dos achados já foram corrigidos — a base evoluiu muito. Os achados abaixo são majoritariamente NOVOS. Postura de segurança geral é madura (RLS em todas as tabelas, webhooks verificados, segredos cifrados ou fora do repo); nenhum crítico novo no escopo do relatório 01 (RLS/API/segredos/MCP) — o crítico com impacto de segurança que existe (edge de push aceitando POST anônimo) está classificado no 02-backend e é o achado #1 abaixo.

## Top 10 achados por impacto

| # | Achado | Sev. | Evidência |
|---|--------|------|-----------|
| 1 | **Edge function de push aceita POST anônimo** — `verify_jwt:false` e trigger sem secret; qualquer um spamma push para qualquer usuário | 🔴 Crítico | `supabase/functions/send-push-notification/index.ts:20-36`, trigger migration 098 |
| 2 | **Drift migrations↔produção**: 11 tabelas existem em prod sem CREATE TABLE local (ambassadors×5, organizations/organization_members/appointment_groups [resíduo Estúdios], curso_waitlist, android_tester_queue, feedback); `db reset`/staging geraria schema incompleto | 🔴 Crítico | verificado em prod via MCP `list_tables` + grep nas migrations |
| 3 | **`shared/types/database.ts` desatualizado vs prod** (sem perfect_weeks, access_blocked_at, trainer_payment_accounts; clients web nem usam o generic `<Database>`) → 196 `.from('x' as any)` (todas no mobile; o web nem tem tipagem para precisar do cast), 582 `as any` no total — mascarou bugs reais de coluna/ID no passado | 🔴 Crítico (estrutural) | `shared/types/database.ts` (commit 79b778c não regenerou), `web/src/lib/supabase/server.ts` |
| 4 | **`assign-program` não-atômico**: arquiva o programa anterior e copia treinos/itens em loop sem transação — falha no meio deixa o aluno sem programa válido | 🔴 Crítico | `supabase/functions/assign-program/index.ts:122,166-336` |
| 5 | **`next` com CVEs de bypass de middleware** — toda a auth do web depende do middleware; fix não-breaking disponível | 🟠 Alto | `audit-web.txt` (2 high; + `fast-uri` web/mobile) |
| 6 | **Zero CI; 5 testes red há ~6 semanas sem ninguém notar** (shared 1 + web 4, drift do commit 519ee80) — regressões só são vistas por usuário; webhooks de pagamento e player de treino (1.383 linhas) têm zero teste | 🟠 Alto | `set-type-labels.test.ts`, `SetSchemeTable.test.tsx`; ausência de `.github/workflows` |
| 7 | **Crashes por hooks condicionais** (3× rules-of-hooks): tela de saque PIX ao cadastrar chave e card de respostas de formulário | 🟠 Alto | `wallet-client.tsx:927`, `form-submissions-card.tsx:68,71` |
| 8 | **Player mobile: "Descartar treino" não apaga sessão/set_logs persistidos** (reabrir reanexa e o finish inclui séries descartadas) + reanexo não rehidrata a UI + kill do app perde estado (sem persistência local; o Watch tem, o telefone não) | 🟠 Alto | `app/workout/[id].tsx:408-448`, `useWorkoutSession.ts:491-504,683` |
| 9 | **Webhook Asaas sem dedupe por `paymentId`** em `contract_events('payment_received')` — eventos distintos/concorrentes (RECEIVED+CONFIRMED do mesmo pagamento) duplicam o evento na timeline e em métricas lidas dela (a transação em `financial_transactions` é deduplicada por upsert `onConflict`); + race no dedupe de push | 🟠 Alto | `web/src/app/api/webhooks/asaas/route.ts:142-220,262-277` |
| 10 | **Resiliência/percepção no web**: zero `error.tsx` no app inteiro, `loading.tsx` em só 6 rotas, 45 `window.alert()` em mutations; N+1 de até 32 round-trips no histórico de tonelagem; 33 FKs quentes sem índice | 🟠 Alto | `03-frontend-web.md` F-02/03/05; `get-workout-tonnage-history.ts:42-103`; advisors prod |

## Severidade por área (achados novos)

| Área | Crítico | Alto | Médio | Baixo |
|------|---------|------|-------|-------|
| Segurança (01) | 0 | 2 | 3 | 4 |
| Backend/dados (02) | 3 | 6 | 8 | 5 |
| Frontend web (03) | 0 | 6 | 7 | 3 |
| Mobile (04) | 0 | 6 | 9 | 4+ |
| Qualidade/shared (05) | 0 | 4 | vários | — |

Pendentes herdados relevantes: fila offline do player (parcial), timer de superset com séries desiguais, `as any` massivo, dark mode legado, "presential" (24×), **conta QA em produção** (`qa-teste-kinevo@example.com` — sem evidência de remoção; exige checagem no banco).

## Plano de ação sugerido (sessões de implementação)

**Sessão 1 — Estancar (≈1 dia):** `npm audit fix` do next/fast-uri · secret na edge de push + trigger 098 · 3 rules-of-hooks · dedupe do webhook Asaas · remover anon JWT dos crons Oura · apagar conta QA do banco.

**Sessão 2 — Fundação de confiança (1-2 dias):** consertar os 5 testes red · CI mínimo (typecheck+lint+testes nos 3 workspaces) · regenerar `database.ts` da prod com guarda contra truncamento + adotar generic `<Database>` nos clients · decidir destino das 11 tabelas órfãs (baseline migration ou DROP consciente).

**Sessão 3 — Robustez visível (1-2 dias):** `global-error.tsx` + `error.tsx` + `loading.tsx` nas 9 rotas · trocar alerts por toasts nos fluxos de dinheiro · índices das FKs quentes + fix do N+1 de tonelagem · hero da landing → `next/image` (LCP 6.08s).

**Sessão 4 — Player de treino (2-3 dias):** descartar apaga de verdade · rehidratação ao reanexar · persistência local do estado (espelhar o padrão já existente no Watch) · depois, fila offline completa.

**Sessão 5 — Estratégico (contínuo):** unificar os 2 builders (~5k linhas duplicadas) ANTES das fases de IA no builder (senão cada fase custa 2×) · testes nos webhooks de pagamento e no `useWorkoutSession` · transação no `assign-program` (RPC plpgsql) · mover formatadores duplicados (26 de moeda, 2 fórmulas de 1RM divergentes) para `shared/`.

**Oportunidades de produto** (detalhes em `07-oportunidades.md`): readiness no painel web do treinador, autorregulação de carga, substituição de exercício via grafo no player, relatório mensal IA white-label, "a IA aprende seu método" (patterns já implementados — ligar ao chat MCP planejado), checkout na landing, régua de cobrança pré-bloqueio.

## Verificações que exigem produção/dispositivo (não cobertas por análise estática)
Remoção da conta QA · teste cross-tenant por signup real · exposição real dos tokens Google Calendar (policy de SELECT) · validação do Watch overhaul em device · `get_advisors` recorrente.
