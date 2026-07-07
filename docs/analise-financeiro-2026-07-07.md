# Análise do Financeiro (web + mobile) — foco em venda via Asaas — 07/jul/2026

> **STATUS 07/jul (mesmo dia):** Fases 1, 2, 3 e a parte fix-shaped da Fase 4 IMPLEMENTADAS no working tree (F1: P1-P5 §6; F2: P7/P8/P10+match por assinatura §7; F3: P13/P14/P15 §8; F4: P12-log/P16/P17/P18 §8). Pendentes de DECISÃO: P6, P9, P11, P12-copy. Pendentes de FEATURE: P19 (MCP Asaas), P20 (export/histórico), paridade mobile (block_on_fail/flags de plano/migrar/KYC upload). Validação: web tsc 0 + 1386 testes; mobile tsc 0 + 374 testes.

**Premissa:** treinadores criam planos e vendem via **Asaas** (PIX, boleto, cartão avulso/parcelado, cartão recorrente). Stripe é legado nesse domínio (segue sendo o rail da assinatura SaaS do próprio treinador — fora de escopo).

**Método:** 3 investigações paralelas (web, mobile, camada Asaas/dinheiro) + dados reais de prod + verificação empírica dos payloads de webhook em prod.

---

## 1. Retrato de produção (escala piloto)

| Métrica | Valor |
|---|---|
| Planos ativos | 3 (de 2 treinadores) |
| Subcontas Asaas | 2 aprovadas (modo `linked`), webhook configurado |
| Contratos ativos | 26 cortesia · **2 asaas_auto** · 1 pending_payment |
| Contratos encerrados | 5 asaas, 1 stripe, 1 manual |
| Transações Asaas | 3 completed, R$15 total (escala de teste), última 10/jun |
| Divergência dinheiro Kinevo×Asaas | Zero até hoje (3 eventos = 3 transações) |

Leitura: o trilho está no ar e íntegro, mas **pré-volume** — é a hora barata de corrigir as armadilhas abaixo, antes de treinador real escalar.

---

## 2. O que EXISTE e funciona

### Web (completo para o fluxo core)
- **Dashboard** `/financial`: saldo Asaas ao vivo, "Cobrar aluno" (avulsa/assinatura/plano), saque PIX, banner de saque aguardando SMS, feed unificado (transações + links pendentes com Copiar/WhatsApp/Sincronizar/Cancelar inline), lista de atenção com "Liberar" (desbloqueio 1-clique).
- **Carteira**: onboarding em 2 modos (criar subconta com KYC nativo + upload de documentos, ou vincular conta Asaas existente por API key), 6 estados de KYC tratados, saldo + "a liberar" com data de crédito, saque PIX com estado MFA/SMS, chaves PIX CRUD, criptografia AES-256-GCM da key (decrypt só server-side).
- **Planos**: CRUD completo com métodos (PIX/cartão/boleto), parcelamento (mín. R$5/parcela), simulador de taxas pré-venda.
- **Venda**: avulsa via Payment Link (aluno digita o próprio CPF no checkout hospedado; parcelado força cartão) e recorrente via link RECURRENT (cartão-only por design — PIX/boleto não têm débito automático).
- **Ativação**: webhook `PAYMENT_RECEIVED` robusto — dual-accept de token, idempotência insert-first, **re-fetch anti-forja** antes de mutar, 3 estratégias de match, upsert de transação com bruto/líquido/parcela/data de crédito, desbloqueio automático do aluno, push ao treinador. Fallback manual "Sincronizar" por cobrança.
- **Inadimplência**: toggle global + carência configurável (1-15d), bloqueio via pg_cron + `check_student_access` + RLS (desde a 162 o conteúdo pago é gated no banco, não só no client).
- **Ciclo manual**: marcar como pago (idempotente por chave determinística), cancelar (Stripe com fim-de-período), migrar contrato legado, arquivar aluno.

### Mobile (bem mais completo que o esperado — trainer-side quase em paridade)
- Dashboard com saldo/feed/atenção, **wizard de cobrança em 4 passos** (avulsa/recorrente/manual/cortesia) com share nativo do link, planos CRUD, carteira (onboarding + vincular conta), **saque PIX com biometria**, chaves PIX, marcar pago, reenviar link, "Já paguei? Verificar", cancelar cobrança/contrato, desbloquear aluno, configurações completas (métodos, carência, notificações).
- Push de pagamento ao treinador 100% ligado (canal `payments`, deep-link para o contrato).
- Higiene de dinheiro: guardas de duplo-toque nas criações e Face ID antes do saque.

### Paridade trainer web × mobile — o que FALTA no mobile
| Capacidade | Web | Mobile |
|---|---|---|
| Toggle `block_on_fail` por contrato | ✅ | ❌ (e cria com `blockOnFail: false` **hardcoded** — `NewSubscriptionSheet.tsx:243`) |
| Migrar contrato legado | ✅ | ❌ |
| Arquivar aluno pela lista financeira | ✅ | ❌ |
| Flags de método/parcelas no form de plano | ✅ | ❌ (lê, não edita — boleto/parcelas só pela web) |
| Upload de documento KYC in-app | ✅ | ❌ (manda pro onboardingUrl externo) |
| Copiar link na linha da lista de contratos | ✅ | ❌ (só no feed e no detalhe) |

---

## 3. Fluxo ponta-a-ponta como está hoje

**Avulsa:** treinador cria cobrança → contrato `pending_payment` + Payment Link → **compartilha manualmente** (WhatsApp/share) → aluno paga no checkout Asaas → webhook ativa contrato + registra transação + desbloqueia + push. Parcelas 2..N registradas por link.

**Recorrente (cartão):** link RECURRENT → 1º pagamento cria a subscription na Asaas (cartão tokenizado) → cada ciclo dispara `PAYMENT_RECEIVED` (verificado em prod: ciclos carregam `paymentLink`) → transação registrada. Cartão falha → dunning da Asaas + `PAYMENT_OVERDUE` → `past_due` + push → **bloqueio imediato** (ver P11). Regularizou → reativa + desbloqueia.

**Experiência do aluno (o elo fraco):**
1. Não existe push nem aviso in-app quando a cobrança é criada — o aluno só sabe se o treinador mandar o link.
2. A tela `/payment` (checkout num WebView, com "Pagar agora") **só é alcançável a partir da tela de bloqueio** — ou seja, o produto só oferece "pagar pelo app" DEPOIS de punir.
3. `/profile/subscription` não mostra contrato `pending_payment` (filtro só `active`/`past_due`) e não tem caminho de pagamento.
4. Pagou no WebView → sem detecção de sucesso; o aluno fecha e aperta "Já paguei? Atualizar".

---

## 4. Problemas encontrados, ranqueados

### Bugs funcionais no fluxo Asaas (quebram ação do treinador)

**P1 — "Copiar Link"/"Reenviar link" da lista de alunos usa o caminho STRIPE e falha para Asaas** `subscriptions-client.tsx:235-258,742` · `student-financial-modal.tsx:202-219`
A principal ação de recuperação de venda na página de alunos chama `generateCheckoutLink` (Stripe, match de plano **por título**) → "Conta Stripe não conectada" para contrato Asaas pendente. O re-share que funciona só existe no feed do dashboard. Endpoint certo já existe (`GET /api/wallet/charges/[id]`).

**P2 — "Marcar pago" é oferecido em recorrência Asaas → dupla cobrança** `subscriptions-client.tsx:753-763` + `contracts-core.ts`
Marca receita local mas NÃO pausa/cancela a subscription na Asaas, que continua debitando o cartão do aluno. Filtro da ação só exclui `stripe_auto`/`courtesy`. Gate ou avisar + cancelar a subscription junto.

**P3 — Cancelamento "ao fim do período" é ignorado no Asaas** `contracts-core.ts:306-327`
`cancelAtPeriodEnd=true` cancela IMEDIATAMENTE na Asaas e localmente — aluno que pagou o mês perde acesso agora. E o preview do MCP promete o contrário (`billing-write.ts:266`).

**P4 — Cancelar contrato recorrente ainda pendente deixa o link RECURRENT vivo** `contracts-core.ts:306-317`
Só chama a Asaas quando `asaas_subscription_id` existe (pós-1º pagamento). Cancelou antes → aluno paga o link depois → Asaas cria subscription e cobra TODO MÊS contra contrato cancelado; o caminho record-only registra as transações sem filtro de status e ainda **desbloqueia o aluno**. Nenhuma superfície cancela a subscription órfã.

**P5 — Chargeback nunca chega** `webhook-setup.ts:20-34`
A lista de eventos assinados na subconta omite `PAYMENT_CHARGEBACK_*` — o handler e o push "responda pelo painel Asaas" (`route.ts:651-675`) são código morto no rail de subconta. Treinador perde a janela de disputa.

**P6 — Reembolso não mexe no acesso** `route.ts:627-647`
`PAYMENT_REFUNDED` marca a transação e só: contrato segue `active`, aluno reembolsado mantém acesso indefinidamente.

### Confiabilidade do dinheiro

**P7 — Nenhuma reconciliação automática**
Webhook é a única verdade automática; a recuperação é o botão "Sincronizar" POR COBRANÇA. Se a Asaas desabilitar a fila (falhas repetidas), o estado financeiro daquele treinador congela em silêncio. Falta um sweep agendado (`listPaymentsByLink` dos `pending_payment` + re-registro do webhook via `needsRepair`).

**P8 — Contratos Asaas não têm período local** (`current_period_end` sempre null)
"Vencimento —" na tabela para sempre, sem estados expired/grace, projeção de receita mensal inclui recorrências mortas, treinador não vê quando vem a próxima cobrança. O payload do webhook traz `nextDueDate`/`dueDate` — dá para manter o período no RECEIVED de ciclo.

**P9 — PIX mensal não tem máquina de renovação NENHUMA**
Recorrência é cartão-only; plano mensal PIX = treinador gera link avulso todo mês NA MÃO. O contrato `asaas_auto` é "ativo até cancelar": aluno que para de pagar não gera NENHUM sinal (link não pago não vira OVERDUE) e mantém acesso para sempre. Hoje o rail honesto para PIX mensal é `manual_recurring` + marcar pago (tem período + inadimplência) — decidir: (a) recomendar isso no produto, ou (b) cron que gera cobrança mensal por contrato PIX.

**P10 — Duplo-submit cria contratos/links duplicados (server-side)** `charges/route.ts:216-253`
Contrato é criado antes do link → cada request tem seed de idempotência novo → 2 links pagáveis simultâneos (o comentário de "double-click safety" em `payment-links.ts:33-37` é falso). As rotas Asaas também não cancelam contrato anterior do aluno (o `createContractCore` manual cancela). Mobile tem guarda de duplo-toque; web/MCP dependem do servidor.

**P11 — Dois cérebros de inadimplência com semânticas diferentes**
(a) Status: `sync-manual-overdue` usa carência FIXA de 3 dias, ignorando o `overdue_grace_days` configurável (que só governa o bloqueio). Treinador configura 10 dias e vê "Inadimplente" no dia 3.
(b) Asaas recorrente: `past_due` bloqueia IMEDIATO via `check_student_access` (`block_on_fail` default true; o cron com carência não enxerga contratos Asaas por falta de `current_period_end` — depende do P8).
(c) O toggle `block_on_fail` por contrato não é consultado pelo `block_overdue_students()` batch.

**P12 — Verdade da taxa Kinevo em 3 versões**
Servidor aplica split `KINEVO_TAKE_RATE_PCT` (fail-open; e se o pct existir mas `ASAAS_KINEVO_WALLET_ID` faltar, o split cai SEM log — `charges/route.ts:153-162`); o simulador client-side sempre mostra taxa Kinevo 0 (env não é `NEXT_PUBLIC_`, `shared/lib/asaas/fees.ts:62-69`); e o settings afirma "A Kinevo não cobra taxa" (`settings-client.tsx:294`). Quando o split ligar, `amount_net` (netValue da Asaas) também vai SUPERESTIMAR o líquido do treinador (netValue não desconta split). Alinhar as 3 pontas antes do go-live da taxa.

### Experiência do aluno (maior gap de produto)

**P13 — Aluno nunca vê a cobrança proativamente**: sem push na criação, sem banner na home, `/profile/subscription` cego a `pending_payment`, `/payment` só alcançável pela tela de bloqueio. A conversão depende 100% do WhatsApp do treinador. Fix barato de alto impacto: push + banner na home consumindo o endpoint `GET /api/student/payment` que JÁ existe.

**P14 — WebView de pagamento sem detecção de sucesso/erro** `payment.tsx:129-133`: aluno paga e continua vendo-se bloqueado até polling manual; link morto rende página em branco no modal.

**P15 — Tela de bloqueio contradiz o posicionamento**: manda "falar com seu treinador" mas o botão WhatsApp disca o número FIXO da Kinevo (`PaymentBlockedScreen.tsx:7`) — choque com o branding do personal (R$79,90). Também: fundo dark hardcoded fora do tema; aluno Asaas não pode se auto-cancelar (só `stripe_auto`).

### Confiança nos números / UX treinador

**P16 — Erros silenciosos viram zeros**: `useFinancialDashboard.ts:107-112`, `useTrainerContracts.ts:29-31` etc. engolem erro → "Receita R$ 0,00" parece real. Na superfície onde o treinador gere o negócio.
**P17 — Listas velhas pós-mutação no mobile**: sem refetch on-focus no stack financeiro — cancelou/marcou pago no detalhe, volta e a lista mente até pull-to-refresh.
**P18 — Enums vazam na UI**: badge "Ativo — asaas_auto" cru, `BillingTypeBadge` sem entrada Asaas (rende "Manual"), tooltip ainda fala "link Stripe" — treinador não distingue débito automático de cobrança manual (alimenta o P2).
**P19 — MCP/assistente não vende via Asaas**: `kinevo_generate_checkout_link` é Stripe-only e `checkout_ready = stripe_price_id != null` — para treinador Asaas-first, o assistente afirma que os planos "não geram link". Nenhuma tool de carteira/saque/cobrança Asaas.
**P20 — Sem relatórios**: nenhum CSV/export, sem histórico completo de recebimentos, sem filtro de período; e o `kinevo_get_revenue_summary` calcula "MRR" sem normalizar intervalo (anual infla 12×).

### Menores (lista rápida)
- Onboarding do `/financial` reaparece para treinador com carteira ativa mas sem plano (`page.tsx:243` ignora o estado da wallet).
- Settings de métodos-default nunca são lidos pelo form de plano (setting morto).
- 2+ métodos no plano → link `UNDEFINED` → boleto aparece mesmo desabilitado (limitação documentada).
- Retry do client Asaas morto no caso timeout (signal abortado reusado — `client.ts:107-134`); retry sem idempotency key em `createSubaccount`/`createCustomer`/webhooks.
- Saque: idempotência por balde-de-minuto engole 2º saque legítimo de mesmo valor no mesmo minuto; saques não aparecem no feed "Atividade recente".
- Re-link de conta Asaas não checa continuidade de identidade → referências órfãs (cancel 404, renovações dropadas).
- `markAsPaidCore` com `current_period_end` null usa `new Date()` na chave → dedupe degradado.
- Plans page dá `window.location.reload()` pós-save; modais mortos (`contract-detail-modal.tsx`, `new-subscription-modal.tsx`).
- Vocabulário de visibilidade divergente: UI grava `hidden`, MCP grava `private`.
- Mobile: quick-link "Assinaturas N ativas" conta `awaiting_payment`; hexes light-mode hardcoded; nome "Cobrança" para aluno arquivado no feed.
- Renovação recorrente resolve só por `paymentLink` (verdade hoje, verificado em prod) — adicionar `asaas_subscription_id` como estratégia 4 de match dá redundância.

**Nota:** itens já corrigidos na auditoria de ontem (working tree): arquivar aluno agora cancela recorrência Asaas; log alto quando `KINEVO_TAKE_RATE_PCT` falta; `hasOrgCoreAccess` never-throw. Pendências conhecidas não re-reportadas: hardening OVERDUE/REFUNDED/CHARGEBACK anti-forja (aguarda prova por evento), `ASAAS_ENV` default sandbox.

---

## 5. Roadmap sugerido

**Fase 1 — Consertar ações do treinador (bugs, dias):** P1 (Copiar Link → rota wallet), P2 (gate/aviso no Marcar pago Asaas), P3 (honrar ou remover fim-de-período no Asaas + corrigir preview MCP), P4 (cancelar → desativar link pendente sempre), P5 (assinar eventos de chargeback — 1 linha + re-registro), P6 (decidir política de reembolso→acesso).

**Fase 2 — Dinheiro confiável (semana):** P7 (cron de reconciliação: sweep de `pending_payment` + saúde do webhook), P8 (manter `current_period_end` dos contratos Asaas a partir do payload), P10 (idempotência de criação + cancelar contrato anterior), P11 (unificar semântica de carência), estratégia 4 de match por subscription.

**Fase 3 — Aluno paga sozinho (maior alavanca de conversão):** P13 (push + banner "Você tem uma cobrança" na home do aluno), P14 (detecção de sucesso no WebView), P15 (WhatsApp do TREINADOR na tela de bloqueio), subscription screen ciente de `pending_payment`.

**Fase 4 — Produto:** P9 (decidir o rail de PIX mensal), P12 (alinhar taxa: simulador/copy/split/net), P19 (tools MCP da carteira Asaas), P20 (export CSV + histórico), paridade mobile (block_on_fail, flags de plano), P16-P18 (estados de erro, refetch on-focus, badges Asaas).

---

## 6. Fase 1 — implementação (07/jul, working tree)

| Item | Fix aplicado | Arquivos |
|---|---|---|
| **P1** | "Copiar Link" (lista) e "Reenviar link" (modal) agora detectam contrato Asaas e buscam a URL viva via `GET /api/wallet/charges/[id]`; caminho Stripe preservado para o legado. Erro do mark-paid também ganhou toast (antes era engolido). | `subscriptions-client.tsx`, `student-financial-modal.tsx` |
| **P2** | `markAsPaidCore` rejeita `asaas_auto_recurring` com mensagem explicando a dupla cobrança (cobre web + MCP + rotas); botões "Marcar pago" do web escondidos para esse tipo (mobile já era manual-only). Teste novo cobrindo o guard. | `contracts-core.ts`, `subscriptions-client.tsx`, `student-financial-modal.tsx`, `contracts-core.test.ts` |
| **P3** | `cancelAtPeriodEnd` + contrato Asaas agora é REJEITADO com mensagem clara em `cancelContractCore`, na rota do mobile e na tool MCP (que antes prometia "mantém acesso até lá" e cancelava na hora). UIs já só mandavam o flag para Stripe — a exposição real era o MCP. | `contracts-core.ts`, `api/financial/cancel-contract/route.ts`, `billing-write.ts` |
| **P4** | Cancelar contrato Asaas agora DESATIVA o Payment Link na Asaas (core + rota mobile). Caso perigoso (recorrente ainda sem assinatura) é fail-closed: se a desativação falhar, o cancel não prossegue; demais casos best-effort. 404 = link já morto = ok. | `contracts-core.ts`, `api/financial/cancel-contract/route.ts` |
| **P5** | Eventos `PAYMENT_CHARGEBACK_REQUESTED/DISPUTE/AWAITING_REVERSAL` + `PAYMENT_RECEIVED_IN_CASH` adicionados ao `KINEVO_WEBHOOK_EVENTS`. **Atenção:** subcontas NOVAS já nascem com a lista completa; as 2 subcontas EXISTENTES em prod vão sinalizar drift `events-incomplete` (needsRepair) — o conserto real é o passo gated `rotateSubaccountWebhook`, que convenientemente coincide com a rotação de tokens já planejada pós-prova-por-evento. | `webhook-setup.ts` (+ fixture do teste) |
| **P6** | NÃO implementado — decisão de produto pendente: reembolso deve revogar acesso automaticamente, ou só alertar o treinador (comportamento atual)? |  |

Nota de import: `contracts-core.ts` importa `AsaasApiError`/`deactivatePaymentLink` dos módulos diretos (`client`/`payment-links`), NÃO do barrel `@/lib/asaas` — o barrel puxa `webhook-setup` → `supabase-admin`, que lança fora do runtime server (quebrou o vitest na primeira tentativa).

---

## 7. Fase 2 — implementação (07/jul, working tree)

| Item | Fix aplicado | Arquivos |
|---|---|---|
| **P7** | Lógica de reconciliação extraída para núcleo compartilhado (`lib/asaas/charge-reconcile.ts`): poll de `listPaymentsByLink` + ativação + tx (agora com TODOS os campos da migration 185, que o sync antigo não gravava) + desbloqueio + timeline com dedupe por paymentId. Consumidores: rota de sync manual (virou wrapper fino) e **cron novo horário** `/api/cron/reconcile-asaas-charges` (varre `pending_payment` com link, janela 15min–60d, lote 40, key decriptada 1× por treinador) que também checa a saúde do webhook de cada subconta aprovada (`ensureSubaccountWebhook`: recria se sumiu, loga alto `needsRepair` em drift). Entrada no `vercel.json` (`20 * * * *`). | `lib/asaas/charge-reconcile.ts` (novo), `api/wallet/charges/[id]/sync/route.ts`, `api/cron/reconcile-asaas-charges/route.ts` (novo), `vercel.json` |
| **P8** | Contratos `asaas_auto_recurring` agora mantêm `current_period_end` local: cada ciclo pago avança o vencimento para `dueDate` (autoritativa, pinada no anti-forja) + intervalo do plano. Aplicado no webhook E no núcleo de reconciliação. "Vencimento —" eterno acabou; lógica de expiração/carência passa a enxergar contratos Asaas. One-off (`asaas_auto`) fica como está ("ativo até cancelar" é design da 178 — decisão do P9). | `api/webhooks/asaas/route.ts`, `lib/asaas/charge-reconcile.ts` |
| **Match por assinatura** | `asaas_subscription_id` virou chave redundante de resolução no webhook: no `resolveOwnerContract` (anti-forja), no tie-check, como estratégia 2b de ativação (reativa `past_due` na regularização mesmo sem paymentLink/payment.id backfillado) e no resolve de registro. `payment.subscription` e `payment.dueDate` entraram no pin autoritativo (viraram chave de WHERE/entrada de cálculo). Teste novo cobrindo ativação por assinatura + avanço de período. | `api/webhooks/asaas/route.ts`, `route.test.ts` |
| **P10** | Anti-duplicidade na criação: **avulsa** — cobrança pendente idêntica (aluno+plano+valor) com link vivo → devolve o link existente (`reused: true`) em vez de criar outro; link morto/linha órfã → aposenta o contrato antigo antes de criar. **Recorrente** — só 1 assinatura pendente por aluno: mesmo plano → reusa o link; plano diferente → desativa o link antigo + aposenta o contrato + cria o novo. | `api/wallet/charges/route.ts`, `api/wallet/subscriptions/route.ts` |
| **P11** | NÃO implementado — exige decisões de produto + migration: (a) carência fixa de 3d do status "Inadimplente" vs `overdue_grace_days` configurável; (b) `block_on_fail` por contrato não é consultado pelo `block_overdue_students()` batch; (c) Asaas recorrente bloqueia imediato no `past_due` (via `check_student_access`) ignorando carência. Com o P8 no ar, o cron de bloqueio PASSA a enxergar contratos Asaas — bom momento para unificar. |  |

Extras da Fase 2: `listPaymentsByLink` agora retorna `subscription`/`installmentNumber`/datas de crédito/description (tipo `PaymentLinkPayment`), o que deixou o sync manual em paridade de campos com o webhook.

---

## 8. Fases 3 + 4 (fix-shaped) — implementação (07/jul, working tree)

### Fase 3 — aluno paga sozinho

| Item | Fix aplicado | Arquivos |
|---|---|---|
| **P13a — push ao aluno** | Criar cobrança (avulsa ou assinatura) agora dispara `sendStudentPush` ("Nova cobrança — R$X. Toque para pagar pelo app"), type novo `charge_created` roteado para `/payment` no tap (canal `payments` no Android). Best-effort, respeita as preferências de notificação do aluno. | `api/wallet/charges/route.ts`, `api/wallet/subscriptions/route.ts`, `mobile/hooks/usePushNotifications.ts` |
| **P13b — banner na home** | Banner "Você tem uma cobrança / Pagamento atrasado" no topo da home do aluno → `/payment`. Hook novo `useStudentPendingCharge` (query Supabase direta sob RLS — LEVE, sem tocar a Asaas; o link vivo fica pra tela de pagamento), refetch on-focus. | `mobile/hooks/useStudentPendingCharge.ts` (novo), `mobile/app/(tabs)/home.tsx` |
| **P13c — assinatura ciente de pendente** | `/profile/subscription` agora inclui `pending_payment` (antes mostrava "sem assinatura"), com status "Aguardando pagamento", labels Asaas e botão **Pagar agora** → `/payment` (também para `past_due`). | `mobile/hooks/useStudentSubscription.ts`, `mobile/app/profile/subscription.tsx` |
| **P14 — confirmação no checkout** | Enquanto o WebView está aberto, poll a cada 8s no `GET /api/student/payment`: pagamento confirmado → haptic de sucesso + modal fecha sozinho + estado "Pagamento confirmado". `onError`/`onHttpError` no WebView (fim da página em branco em link morto); pull-to-refresh com spinner real; loader full-screen só no primeiro load. | `mobile/app/payment.tsx`, `mobile/hooks/useStudentPayment.ts` |
| **P15 — tela de bloqueio** | Botão WhatsApp agora disca o **treinador** (telefone via join RLS `students→trainers`, "Falar com meu treinador", mensagem de regularização); suporte Kinevo vira fallback sem telefone. Tema corrigido (tokens em vez de dark hardcoded). | `mobile/components/PaymentBlockedScreen.tsx` |

### Fase 4 — itens fix-shaped

| Item | Fix aplicado | Arquivos |
|---|---|---|
| **P12 (parcial)** | Log alto quando `KINEVO_TAKE_RATE_PCT` está setado mas `ASAAS_KINEVO_WALLET_ID` falta (split caía sem NENHUM log). Alinhamento simulador/copy/netValue segue como decisão de produto. | `api/wallet/charges/route.ts`, `api/wallet/subscriptions/route.ts` |
| **P16 — fim dos zeros falsos** | `useFinancialDashboard` expõe `error`; dashboard mostra banner "Não foi possível carregar… os números podem estar desatualizados — toque para tentar de novo" em vez de fingir R$ 0,00. | `mobile/hooks/useFinancialDashboard.ts`, `mobile/app/financial/index.tsx` |
| **P17 — refetch on focus** | Dashboard e lista de contratos refazem o fetch ao ganhar foco — cancelar/marcar pago no detalhe não deixa mais a lista mentindo até pull-to-refresh. | `mobile/app/financial/index.tsx`, `mobile/app/financial/contracts.tsx` |
| **P18 — badges Asaas no web** | `billingTypeLabel` ganhou "Cobrança Asaas"/"Cartão automático" (fim do enum cru "asaas_auto"); `BillingTypeBadge` ganhou entradas Asaas (fim do fallback "Manual"); tooltip "Link Stripe" virou genérico. | `subscriptions-client.tsx`, `billing-type-badge.tsx` |

### O que resta (não implementado)

- **Decisões de produto:** P6 (reembolso→acesso), P9 (rail do PIX mensal), P11 (unificar carência/block_on_fail — migration), P12-copy (alinhar taxa no simulador/copy/net).
- **Features:** P19 (tools MCP da carteira Asaas — sugerido extrair um `createAsaasChargeCore` da rota e expor via tool), P20 (histórico completo + export CSV), paridade mobile (toggle block_on_fail, flags de método do plano, migrar contrato, upload KYC in-app).
