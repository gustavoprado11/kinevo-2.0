# Carteira Kinevo (Asaas integration)

Módulo de carteira financeira nativo da Kinevo via Asaas marketplace.

## Documentos

- **[SETUP.md](./SETUP.md)** — guia passo a passo para o Gustavo (não-dev) ativar tudo do zero.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — overview técnico para devs.
- **[QUICKSTART.md](./QUICKSTART.md)** — o que fazer nos próximos 7 dias.

## Resumo executivo

A Kinevo hospeda uma "subconta Asaas" para cada treinador (CNPJ Kinevo é o marketplace operator). Cada treinador:

- Tem KYC delegado ao Asaas (1-3 dias úteis).
- Recebe via PIX, Cartão, Boleto direto na subconta dele.
- Saca para qualquer chave PIX dele em segundos via PIX out.
- Kinevo opcionalmente fica com uma % do valor via split (configurável por `KINEVO_TAKE_RATE_PCT`).

Stripe Connect (que já existe) continua intacto. Asaas adiciona em paralelo.

## Stack

- **Cliente Asaas**: `web/src/lib/asaas/` (HTTP, accounts, customers, payments, transfers, pix, balance, webhook, encryption).
- **WalletService**: `web/src/lib/asaas/wallet-service.ts` — auth do treinador + CRUD da `trainer_payment_accounts`.
- **API routes**: `web/src/app/api/wallet/*` (status, activate, sync, balance, charges, pix-keys, payouts).
- **Webhook**: `web/src/app/api/webhooks/asaas/route.ts`.
- **Migration**: `supabase/migrations/132_asaas_wallet.sql`.
- **Tipos compartilhados**: `shared/types/asaas.ts`.
- **Testes**: `web/src/lib/asaas/__tests__/`.
- **Smoke test e2e**: `web/scripts/asaas-smoke-test.ts`.

## Status atual

- ✅ Tipos compartilhados (`@kinevo/shared/types/asaas`)
- ✅ Cliente HTTP do Asaas (com retry, timeout, idempotência, error tipado)
- ✅ Migration SQL (3 tabelas novas, RLS, índices, triggers)
- ✅ WalletService (auth, encryption, ativação, sync)
- ✅ 9 API routes (status/activate/sync/balance/charges/pix-keys × 2/payouts/webhook)
- ✅ Testes unitários (client, encryption, pix, webhook)
- ✅ Smoke test e2e
- ✅ Docs SETUP em PT-BR
- ⏳ UI (Carteira no painel web e mobile)
- ⏳ Smoke test executado em sandbox real
- ⏳ Deploy em produção
