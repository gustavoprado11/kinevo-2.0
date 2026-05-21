# Carteira Asaas no Mobile

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

> Ordem definida: **Fase A (Trainer) primeiro** → Fase B (Aluno) → Fase C (push + biometria).
> Biometria no saque **adiada para Fase C** (requer `expo-local-authentication`).

## Contexto

O financeiro do trainer foi migrado para a Asaas e está **100% funcional no web** (carteira, cobrança PIX/cartão/boleto, saque, chaves PIX, KYC). O app mobile, porém, continua **0% Asaas** — todo o financeiro mobile ainda é Stripe + cobrança manual. Trainers em campo (entre clientes) não conseguem cobrar, ver saldo ou sacar pelo celular, e o aluno não tem como pagar in-app.

**Descoberta que reduz o escopo:** os endpoints `web/src/app/api/wallet/*` já foram construídos *mobile-aware*. `requireTrainer()` (`web/src/lib/asaas/wallet-service.ts`) tenta **Bearer token primeiro (mobile)** e cookie depois (web). Logo, o lado do **trainer é quase 100% trabalho de telas** — sem backend novo.

## Objetivo

Trainer faz pela Carteira no app tudo que faz no web: ativar/vincular carteira, ver saldo, cobrar aluno (avulsa/recorrente), gerir chaves PIX e sacar. Aluno paga a mensalidade in-app (PIX nativo + fallback cartão). O gate de inadimplência (já corrigido na migration 148) passa a ter caminho de pagamento.

## Escopo

### Incluído (Fase A — Trainer)
- Hook `useWallet` (status/summary) e `useWalletBalance`.
- Tela Carteira: saldo (disponível/pendente), badge de status KYC, ações Cobrar/Sacar, pull-to-refresh.
- Wizard de ativação de subconta (3 passos) + tela de vinculação de conta Asaas existente.
- Sheet "Cobrar aluno" (avulsa/recorrente) com share do `invoiceUrl`.
- Saque PIX (sem biometria nesta fase) com tratamento de `awaiting_authorization` (MFA SMS).
- CRUD de chaves PIX com validação ao vivo.
- Entradas de navegação a partir de `app/financial/index.tsx`.

### Incluído (Fase B — Aluno)
- **Novo** endpoint `GET /api/student/payment` (cobrança pendente + PIX `encodedImage`/payload + `invoiceUrl`), autenticado por Bearer do aluno.
- Tela "Pagar mensalidade": QR PIX nativo + copiar código.
- Fallback de cartão via `WebView` do checkout Asaas.
- Confirmação de pagamento (push `PAYMENT_RECEIVED` já existe no webhook).

### Incluído (Fase C — Push & polish)
- Deep links de push: `payout_completed`/`payout_failed`/`kyc_alert`/`chargeback_alert` → `/financial/wallet`; invoice novo → tela de pagamento do aluno.
- Biometria (`expo-local-authentication`) antes de cada saque.

### Excluído
- Mudanças no backend do trainer (já pronto/mobile-aware).
- Relatórios/extrato avançado, saque agendado, IRPF (pós-beta).
- Take rate Kinevo (continua 0%, já suportado por env).

## Arquivos Afetados

**Novos (Fase A):**
- `mobile/hooks/useWallet.ts` — status/summary via `GET /api/wallet/status`.
- `mobile/hooks/useWalletBalance.ts` — saldo via `GET /api/wallet/balance`.
- `mobile/hooks/usePixKeys.ts` — CRUD via `/api/wallet/pix-keys[/id]`.
- `mobile/hooks/usePayouts.ts` — criar/listar via `/api/wallet/payouts`.
- `mobile/app/financial/wallet.tsx` — tela principal da carteira.
- `mobile/app/financial/wallet/activate.tsx` — wizard de ativação.
- `mobile/app/financial/wallet/link.tsx` — vincular Asaas existente.
- `mobile/app/financial/wallet/payout.tsx` — saque PIX.
- `mobile/app/financial/wallet/pix-keys.tsx` — gestão de chaves.
- `mobile/components/financial/ChargeStudentSheet.tsx` — sheet de cobrança (`@gorhom/bottom-sheet`).
- `mobile/components/financial/WalletBalanceHero.tsx`, `WalletStatusBadge.tsx` — UI compartilhada.
- `mobile/lib/wallet-api.ts` — helper fino `walletFetch(path, init)` que injeta o Bearer (centraliza o padrão de `useStripeStatus`).

**Editados (Fase A):**
- `mobile/app/financial/index.tsx` — card/atalho "Carteira".

**Novos/editados (Fase B):**
- `web/src/app/api/student/payment/route.ts` — **novo** endpoint (Bearer aluno).
- `mobile/app/(tabs)/payments/index.tsx` + `checkout.tsx` — pagamento do aluno.
- `mobile/hooks/useStudentPayment.ts`.

**Editados (Fase C):**
- `mobile/hooks/usePushNotifications.ts` — novos deep links.
- `package.json` (mobile) — `expo-local-authentication` (requer autorização).

## Comportamento Esperado

### Fluxo do Usuário (Fase A — trainer)
1. Trainer abre Financeiro → vê card "Carteira".
2. Sem carteira: CTA "Ativar Carteira" → wizard (dados pessoais → endereço → faturamento) **ou** "Já tenho conta Asaas" → cola apiKey + walletId.
3. Status `awaiting`: tela mostra "Em análise (1–3 dias úteis)" + lista de documentos.
4. Status `approved`: hero com saldo disponível + pendente, botões "Cobrar aluno" e "Sacar".
5. "Cobrar aluno": escolhe aluno → avulsa ou recorrente → plano/valor → recebe `invoiceUrl` → compartilha via share-sheet nativo.
6. "Sacar": escolhe chave PIX + valor → confirma. Se a Asaas exigir MFA, vê banner "Confirme o saque por SMS no painel Asaas" (status `awaiting_authorization`).
7. Chaves PIX: adiciona/remove/define padrão, com validação ao vivo (check verde / X vermelho).

### Fluxo Técnico
1. Hooks chamam `walletFetch(path)` → `fetch(`${EXPO_PUBLIC_WEB_URL}${path}`, { headers: { Authorization: `Bearer ${session.access_token}` } })`.
2. Backend `requireTrainer()` resolve o trainer pelo Bearer (já implementado).
3. Tipos vêm de `@kinevo/shared/types/asaas` (`KinevoWalletSummary`, `AsaasBalance`, etc.).
4. QR PIX: a Asaas devolve `encodedImage` (base64) → renderizar com `<Image source={{ uri: `data:image/png;base64,${encodedImage}` }} />` (sem lib de QR). Copiar código via `expo-clipboard`.
5. Push token de trainer já é registrado por `usePushNotifications('trainer')`.

## Critérios de Aceite
- [ ] Trainer com carteira aprovada vê saldo correto (bate com web) e faz pull-to-refresh.
- [ ] Ativação e vinculação funcionam e refletem o status retornado pela API.
- [ ] Cobrança gera `invoiceUrl` compartilhável (avulsa e recorrente).
- [ ] Saque cria payout; estado `awaiting_authorization` é exibido claramente.
- [ ] CRUD de chaves PIX com validação ao vivo.
- [ ] apiKey da Asaas **nunca** é persistida no device (vai direto pro backend).
- [ ] Sem novos erros de TypeScript (`tsc --noEmit`).
- [ ] Retrocompatível: financeiro Stripe existente intacto.
- [ ] Testado no fluxo principal em device real.

## Restrições Técnicas
- Convenções do `mobile/CLAUDE.md`: NativeWind, `useV2Colors()`, Lucide (nunca emoji), Haptics em todo toque, Reanimated 4, `ScreenWrapper`/`SafeAreaView`.
- Mudanças cirúrgicas; não reescrever financeiro Stripe.
- SecureStore só pra sessão (já feito pelo Supabase) — nada de credencial Asaas no client.
- Sem novas dependências na Fase A (todas as libs necessárias já estão instaladas: `@gorhom/bottom-sheet`, `expo-clipboard`, `react-native-webview`).

## Edge Cases
- Carteira não iniciada / rejeitada / bloqueada: cada status tem UI própria (reaproveitar `KinevoWalletStatus`).
- Saldo zero ou só pendente: desabilitar "Sacar" com hint.
- Saque > saldo disponível: erro amigável vindo da API.
- Sem chave PIX cadastrada ao tentar sacar: empurrar pro fluxo de chaves.
- Token expirado: `walletFetch` re-tenta com `supabase.auth.getSession()` atualizado.
- Offline: banner de conexão (componente existente) + estados de erro.
- MFA pendente: não deixar o trainer achar que o saque falhou.

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] `wallet-api.ts`: monta header Bearer e URL corretos; propaga erro tipado.
- [ ] Helpers de formatação de saldo/valor (reusar `formatBRL` do shared se possível).
- [ ] Validação de chave PIX no client (reusar `isPixKeyFormatValid` do shared — já testado).

### Server Actions / Queries
- [ ] (Fase B) `GET /api/student/payment`: retorna cobrança pendente do aluno autenticado; nega aluno de outro trainer; sem cobrança → 200 vazio.

### Componentes (fluxos de receita — opcional)
- [ ] `ChargeStudentSheet`: happy path avulsa + recorrente (mock da API).

## Referências
- Plano macro: `docs/financeiro-plano-fechamento.md` (Sprints 3 e 4 — parcialmente desatualizado).
- Backend pronto: `web/src/app/api/wallet/*`, `web/src/lib/asaas/wallet-service.ts` (`requireTrainer` Bearer-first).
- Tipos: `shared/types/asaas.ts`.
- Padrão de chamada autenticada existente: `mobile/hooks/useStripeStatus.ts`.
- Gate de inadimplência (pré-requisito, já corrigido): migration `148_check_student_access_reads_block.sql`.

## Notas de Implementação

### Rodada 1 (2026-05-21) — Fundação + saldo + saque + chaves PIX
Implementado (working tree, sem commit):
- `mobile/lib/wallet-api.ts` — `walletFetch<T>()` com Bearer da sessão + erro tipado.
- `mobile/hooks/useWallet.ts`, `useWalletBalance.ts`, `usePixKeys.ts`, `usePayouts.ts`.
- `mobile/app/financial/wallet.tsx` — tela principal (badge de status p/ todos os estados; hero de saldo disponível + a liberar; ações Sacar / Chaves PIX; estados não-aprovados linkam pro site).
- `mobile/app/financial/wallet/pix-keys.tsx` — CRUD com validação de formato ao vivo (check verde/X) + definir padrão.
- `mobile/app/financial/wallet/payout.tsx` — saque com "Tudo", seleção de chave, histórico, e tratamento de `awaiting_authorization` (MFA SMS).
- `mobile/app/financial/index.tsx` — card "Carteira" → `/financial/wallet`.

Validação: `tsc --noEmit` limpo nos arquivos novos (12 erros restantes são pré-existentes em arquivos não relacionados).

Decisões: BRL formatado manualmente (Hermes não tem Intl confiável); validação de chave PIX é leve no client (backend valida checksum); `as never` nos `router.push` (regra "sem any").

### Rodada 2 (2026-05-21) — Dashboard financeiro Asaas-first + cobrança Asaas
- `NewSubscriptionSheet` adaptado: opção Stripe substituída por **"Assinatura via Carteira"** e **"Cobrança avulsa via Carteira"** (Asaas, geram Payment Link via `/api/wallet/subscriptions` e `/charges` → Share). Mantidas manual recorrente / pagamento único / cortesia. Prop `hasStripeConnect` → `walletApproved`.
- `mobile/hooks/useHasStripeLegacy.ts` — espelha a regra do web (Stripe só se houver contrato `stripe_auto`/`stripe_subscription_id` ativo).
- `app/financial/index.tsx` — seção "STRIPE CONNECT" agora só aparece (rotulada "LEGADO") se `hasLegacy`; "Nova Cobrança" passa `walletApproved`.
- Call sites atualizados: `contracts.tsx`, `contract/[id].tsx` (useWallet → walletApproved).

Validação: `tsc` limpo nos arquivos tocados (12 erros pré-existentes não relacionados, inalterados).

Limitações desta rodada: cobrança avulsa Asaas exige um plano (sem valor custom ainda); `dueDate` fixo em hoje+3; sem simulação de taxa no sheet (fees.ts é web-only).

### Rodada 3 (2026-05-21) — Detalhe do contrato Asaas-aware
Descoberta: a RPC `get_financial_students` (usada por web **e** mobile) não trata `status='pending_payment'` (classifica contrato Asaas aguardando como "cortesia") nem expõe campos Asaas. Para não arriscar o web, **não** alterei a RPC — fiz a correção isolada no mobile.

- **Backend (aditivo):** `GET /api/wallet/charges/[id]` (`web/.../charges/[id]/route.ts`) → retorna status/billingType/provider/value/asaasPaymentLinkId + **url viva** do Payment Link (via `getPaymentLink`). Bearer-aware.
- `mobile/hooks/useContractDetail.ts` — agora também busca os campos reais do contrato (`status, billing_type, provider, asaas_payment_link_id, asaas_payment_id`) direto via Supabase.
- `mobile/app/financial/contract/[id].tsx`:
  - `effectiveStatus` corrige o badge (Asaas `pending_payment` → "Aguardando", em vez de "Cortesia").
  - Ações para cobrança Asaas aguardando: **"Compartilhar link de pagamento"** (GET → Share) + **"Já paguei? Verificar"** (POST `/sync`). O checkout **Stripe** só aparece para contratos legados.
  - Cancelar cobrança Asaas pendente → `DELETE /api/wallet/charges/[id]` (desativa o link). Labels de billing Asaas adicionados.

Validação: `tsc` limpo nos arquivos tocados (web e mobile).

### Rodada 4 (2026-05-21) — Lista financeira + contadores Asaas-aware
- **Migration 149** (`get_financial_students`): mapeia `status='pending_payment'` → `awaiting_payment` (antes caía em "cortesia"). Mudança mínima/aditiva, mesma assinatura. **Aplicada em prod** e verificada. Beneficia web + mobile (lista, contadores, ordenação).
- `useFinancialDashboard.ts` e `useTrainerContracts.ts`: `awaiting_payment` agora entra no bucket **"Atenção"** (contadores + filtro) — cobrança enviada e não paga precisa de follow-up.
- `ContractCard.tsx`: badge de cobrança **"Carteira"** para `asaas_auto`/`asaas_auto_recurring` (antes não renderizava badge).

Validação: `tsc` limpo nos arquivos tocados. Migration verificada (sem contratos `pending_payment` no momento, risco baixo).

### Rodada 5 (2026-05-21) — Dashboard financeiro espelhando o web
Objetivo: deixar `app/financial/index.tsx` igual ao `web/.../financial-client.tsx` (adaptado ao mobile).
- **Migration 150** (`get_financial_dashboard`): `monthlyRevenue` soma `status IN ('succeeded','completed')` — antes só Stripe, então a receita mensal aparecia zerada com PIX Asaas. **Aplicada** e verificada (R$5 do mês agora conta).
- **Contadores alinhados ao web** (`useFinancialDashboard`, `useTrainerContracts`): pagantes = `active`+`awaiting_payment`; atenção = `overdue`+`grace_period`+`canceling`+`expired`. Adicionado `expired` ao tipo `DisplayStatus` e aos `STATUS_CONFIG` (ContractCard + detalhe).
- **Dashboard reescrito**: subtítulo; **hero da Carteira** (saldo + badge "Conta vinculada"/"Carteira ativa" + "Ver detalhes da Carteira" + botões "Cobrar aluno" e "Sacar via PIX"; card de status quando não aprovada); stats com redação do web (sentence case); **atalhos 2×2** (Planos, Assinaturas, Chaves PIX, Configurações); "Atividade recente" + subtítulo; pill **"Tudo em dia"**. Moeda agora com 2 casas (R$ 5,00). Removido o botão "Nova Cobrança" do header (cobrança vai pelo hero).

Validação: `tsc` limpo nos arquivos tocados (12 erros pré-existentes não relacionados).

### Rodada 6 (2026-05-21) — Paridade da tela principal + remover "Tudo em dia"
- **Removido "Tudo em dia"** do web (`financial-client.tsx`) e do mobile (`financial/index.tsx`).
- **Card "Precisam de atenção"** (`components/financial/AttentionCard.tsx`): lista até 4 alunos (status + valor), tag "Bloqueado" + botão **"Liberar"** (`PATCH /api/students/[id]/access`), "Ver todos". `useFinancialDashboard` agora retorna `attentionStudents`.
- **Cobranças pendentes no feed** (`components/financial/PendingChargeRow.tsx`): mescladas na "Atividade recente" (ordenado por data), com **Copiar link / WhatsApp / Sincronizar / Cancelar**. URL buscada sob demanda via `GET /api/wallet/charges/[id]`. `useFinancialDashboard` retorna `pendingCharges`.
- **Banner de saque aguardando SMS** (`components/financial/AwaitingPayoutBanner.tsx`): topo do dashboard, com "Já confirmei" (`POST /api/wallet/payouts/[id]/sync`) + "Abrir painel da Asaas". `useFinancialDashboard` retorna `awaitingPayouts`.
- Tipos: `FinancialStudent` ganhou `access_blocked_at`/`access_blocked_reason`. Helper `lib/time.ts` (timeAgo).

Validação: `tsc` limpo (web e mobile) — 12 erros mobile / 11 web pré-existentes não relacionados.

### Rodada 7 (2026-05-21) — Tela de Configurações nativa
- `mobile/hooks/useFinancialSettings.ts` — GET/PATCH `/api/financial/settings` (Bearer), save otimista por campo.
- `mobile/app/financial/settings.tsx` — espelha o web: Carteira (status + Atualizar/sync + modo), Métodos padrão (PIX/Cartão/Boleto), Taxas vigentes (tabela), Inadimplência (toggle + stepper de tolerância), Notificações (4 toggles), atalho Chaves PIX, Avançado (Stripe legado se houver + suporte). Usa `Switch` nativo + stepper (sem dependência nova).
- Atalho "Configurações" do dashboard agora abre a tela nativa (não mais o site).

Validação: `tsc` limpo (11 erros mobile pré-existentes em test files não relacionados).

### Pendente para paridade total com o web
- **Wizard de ativação (`activate`) + vinculação (`link`) no app** — maior item restante; hoje estados não-aprovados abrem a tela da Carteira (que orienta a ativar pelo site). Envolve formulário multi-step + KYC/documentos Asaas; requer conta não-aprovada pra testar.
- **Cancelar assinatura Asaas ativa (recorrente)**: hoje usa `/api/financial/cancel-contract` genérico; precisa de desenho de cancelamento da recorrência na Asaas.
- Tooltips (?) nos stat cards: omitidos de propósito (padrão de hover do web; no mobile os labels já são autoexplicativos).
- Simulação de taxa no sheet (replicar `fees.ts` no `shared`); valor custom + date picker na avulsa.
- Fase B (pagamento do aluno) e Fase C (push deep links + biometria).
