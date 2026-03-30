# PRD - Kinevo Financial Module (Stripe Connect Marketplace)

**Autor:** Claude (Architecture Plan)
**Data:** 2026-02-12
**Status:** Draft
**Versao:** 2.0

---

## 1. Visao Geral

### Objetivo
Permitir que treinadores vendam planos de consultoria para seus alunos pela plataforma Kinevo, usando **Stripe Connect Standard** para pagamentos automatizados, com suporte a **cobranças manuais** e **acessos de cortesia**.

### Modelo de Negocio
- **Marketplace:** Cada treinador conecta sua propria conta Stripe.
- **Fluxo de dinheiro (Stripe):** Aluno paga -> dinheiro vai para conta Stripe do treinador.
- **Manual:** Treinador recebe fora da plataforma, registra no sistema.
- **Cortesia:** Acesso gratuito para familiares/amigos.
- **Taxa da plataforma:** Sem taxa por agora (configuravel no futuro via `application_fee_percent`).
- **Isolamento:** Treinador A nao tem acesso aos dados financeiros do Treinador B.

### Personas
| Persona | Acao |
|---------|------|
| Treinador | Conecta Stripe, cria planos, gera links de cobranca OU registra pagamento manual, monitora assinaturas, controla bloqueio |
| Aluno | Recebe link de pagamento (Stripe), paga, ou e registrado manualmente. Visualiza assinatura no app |
| Kinevo (Plataforma) | Processa webhooks, registra transacoes, monitora status, controla acesso |

---

## 2. Escopo

### Incluido (v1)
- Onboarding Stripe Connect (Standard)
- CRUD de planos de consultoria
- 4 tipos de cobranca: `stripe_auto`, `manual_recurring`, `manual_one_off`, `courtesy`
- Geracao de link de checkout (Stripe)
- Registro manual de pagamento ("Marcar como Pago")
- Processamento de webhooks Connect
- Dashboard financeiro (receita, assinaturas, transacoes)
- Controle de bloqueio por inadimplencia (`block_on_fail`)
- Tela de bloqueio no app mobile
- Visualizacao de assinatura no app mobile
- Historico de pagamentos (aluno)

### Excluido (v1)
- Taxa de plataforma (application_fee_percent)
- Notificacoes push sobre pagamentos
- Faturas PDF customizadas
- Cron job automatico para expirar contratos manuais (v1: treinador controla)
- Stripe Express accounts
- Pagamento in-app (checkout via browser)

---

## 3. Tipos de Cobranca (Billing Types)

### `stripe_auto` — Pagamento Automatizado via Stripe
- Treinador gera link de checkout
- Aluno paga via cartao/Pix no Stripe Checkout
- Renovacao automatica
- Inadimplencia detectada via webhook
- Requer conta Stripe Connect ativa

### `manual_recurring` — Controle Manual Recorrente
- Treinador registra contrato no sistema
- Aluno paga fora da plataforma (Pix direto, dinheiro, transferencia)
- Treinador da baixa manual ("Marcar como Pago")
- Sistema acompanha vencimentos
- Nao requer Stripe Connect

### `manual_one_off` — Pagamento Unico Manual
- Contrato com data de inicio e fim fixos
- Sem renovacao automatica
- Treinador registra manualmente

### `courtesy` — Acesso Gratuito
- Valor zero, sem cobranca
- Acesso sempre liberado (`block_on_fail = false`)
- Para familiares, amigos, parceiros

---

## 4. Arquitetura

### Stack
- **Backend:** Next.js 16 API Routes + Server Actions
- **Database:** Supabase (PostgreSQL) com RLS
- **Pagamento:** Stripe Connect Standard (Stripe SDK v20+)
- **Frontend Web:** React (trainer dashboard)
- **Frontend Mobile:** Expo/React Native (student app)

### Tabelas do Banco de Dados

Todas as tabelas abaixo **ja existem** no Supabase (criadas via Dashboard). A migration 025 adiciona novos campos, RLS policies, indexes, triggers e RPCs.

#### `payment_settings`
Conta Stripe Connect de cada treinador.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| user_id | TEXT (PK) | ID do treinador |
| stripe_connect_id | TEXT | ID da conta Stripe (acct_xxx) |
| stripe_status | TEXT | Status do onboarding |
| charges_enabled | BOOLEAN | Pode receber pagamentos? |
| details_submitted | BOOLEAN | Completou KYC? |
| payouts_enabled | BOOLEAN | Pode receber transferencias? |
| created_at | TIMESTAMPTZ | Data de criacao |
| updated_at | TIMESTAMPTZ | Data de atualizacao |

#### `trainer_plans`
Catalogo de planos do treinador.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | ID do plano |
| trainer_id | UUID (FK) | Treinador |
| title | TEXT | Nome |
| description | TEXT | Descricao |
| price | NUMERIC | Valor em BRL |
| interval | TEXT | Periodo (month/quarter/year) |
| interval_count | INTEGER | Quantidade |
| is_active | BOOLEAN | Ativo? |
| visibility | ENUM | public/hidden |
| payment_method | TEXT | Metodo (stripe/manual/pix) |
| stripe_product_id | TEXT | Produto na conta conectada |
| stripe_price_id | TEXT | Preco na conta conectada |
| created_at | TIMESTAMPTZ | Data de criacao |
| updated_at | TIMESTAMPTZ | Data de atualizacao |

#### `student_contracts` (com novas colunas v2)
Vinculo entre aluno e plano.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | ID do contrato |
| student_id | UUID (FK) | Aluno |
| trainer_id | UUID (FK) | Treinador |
| plan_id | UUID (FK) | Plano |
| amount | NUMERIC | Valor |
| status | TEXT | active/pending/past_due/canceled |
| **billing_type** | **ENUM** | **stripe_auto / manual_recurring / manual_one_off / courtesy** (NOVO) |
| **block_on_fail** | **BOOLEAN** | **Bloquear acesso se inadimplente? Default: true** (NOVO) |
| **current_period_end** | **TIMESTAMPTZ** | **Fim do periodo atual** (NOVO) |
| **cancel_at_period_end** | **BOOLEAN** | **Cancelar no fim do periodo?** (NOVO) |
| stripe_customer_id | TEXT | Customer na conta conectada |
| stripe_subscription_id | TEXT | Subscription na conta conectada |
| start_date | TIMESTAMPTZ | Inicio |
| end_date | TIMESTAMPTZ | Fim (para one_off) |
| created_at | TIMESTAMPTZ | Data de criacao |
| updated_at | TIMESTAMPTZ | Data de atualizacao |

#### `financial_transactions`
Registro de pagamentos.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | ID |
| coach_id | UUID (FK) | Treinador (recebedor) |
| student_id | UUID (FK) | Aluno (pagador) |
| amount_gross | NUMERIC | Valor bruto |
| amount_net | NUMERIC | Valor liquido |
| currency | TEXT | Moeda (brl) |
| type | ENUM | subscription/payout/refund |
| status | ENUM | succeeded/failed/pending/canceled |
| stripe_payment_id | TEXT | ID pagamento Stripe |
| stripe_invoice_id | TEXT | ID invoice Stripe |
| description | TEXT | Descricao |
| created_at | TIMESTAMPTZ | Data de criacao |
| processed_at | TIMESTAMPTZ | Data de processamento |

### RLS (Row Level Security)

| Tabela | Regra |
|--------|-------|
| payment_settings | Trainer le apenas sua conta. Writes via service_role. |
| trainer_plans | Trainer CRUD nos seus planos. Aluno le planos publicos do seu treinador. |
| student_contracts | Trainer le/escreve contratos dos seus alunos. Aluno le seus proprios. Stripe writes via service_role. |
| financial_transactions | Trainer le suas transacoes. Aluno le suas. Writes via service_role. |

---

## 5. Logica de Bloqueio (Acesso do Aluno)

### Regras

**Aluno BLOQUEADO se:**
1. `students.status` IN ('blocked', 'archived', 'inactive') - treinador desativou
2. OU contrato com `status = 'past_due'` E `block_on_fail = true`
3. OU contrato com `status = 'canceled'` E `block_on_fail = true`

**Aluno LIBERADO se:**
1. Nao tem contrato nenhum - aluno legado, acesso livre (retrocompatibilidade)
2. Contrato `status = 'active'`
3. Contrato `billing_type = 'courtesy'` (qualquer status)
4. Contrato `past_due` mas `block_on_fail = false`

### Implementacao
- RPC PostgreSQL: `check_student_access(student_id)` retorna `{ allowed, reason }`
- Hook mobile: `useStudentAccess()` chama a RPC
- Tela de bloqueio: `PaymentBlockedScreen` com mensagem contextual
- Integrada no home screen

---

## 6. Fluxos

### 6.0 Onboarding Financeiro (Primeira Visita)

Quando o treinador acessa `/financial` pela primeira vez (sem conta Stripe e sem planos criados), ve um fluxo guiado de 3 passos em vez do dashboard vazio.

```
Step 1 - "Bem-vindo ao Financeiro"
  -> Explica os 3 tipos de cobranca (Stripe, Manual, Cortesia)
  -> Cards visuais com icones e descricoes
  -> Botao "Comecar"

Step 2 - "Conectar Stripe (Opcional)"
  -> Explica beneficio do pagamento automatico
  -> Botao "Conectar com Stripe" -> OAuth flow
  -> Link "Pular por agora" (pode usar cobranças manuais)

Step 3 - "Criar Seu Primeiro Plano"
  -> Form inline: titulo, preco, intervalo
  -> Botao "Criar Plano" -> redireciona para dashboard
  -> Link "Criar depois" -> dashboard com empty state
```

**Logica:** Sem `payment_settings` E sem `trainer_plans` = onboarding. Qualquer um deles presente = dashboard normal.

**Empty States:** Cada secao do dashboard tem empty state informativo quando sem dados.

### 6.1 Onboarding Stripe Connect
```
Treinador -> /financial -> "Conectar com Stripe"
  -> API cria Account (Standard) + Account Link
  -> Redirect Stripe OAuth -> Completa KYC
  -> Retorna /financial?connect=success
  -> Webhook account.updated -> sync payment_settings
  -> Dashboard mostra "Conectado"
```

### 6.2 Criar Plano
```
Treinador -> /financial/plans -> "Criar Plano"
  -> Preenche form (titulo, preco, intervalo)
  -> Se tem Stripe Connect: cria Product+Price na conta conectada
  -> Se nao tem Stripe: so salva no DB (para cobranças manuais)
  -> Plano aparece na lista
```

### 6.3 Nova Assinatura (Stripe Auto)
```
Treinador -> /financial/subscriptions -> "Nova Assinatura"
  -> Seleciona aluno + plano + "Cobrar via Stripe"
  -> API cria Checkout Session (stripeAccount = conta conectada)
  -> Retorna URL -> Treinador compartilha com aluno
  -> Aluno paga -> Webhook checkout.session.completed
  -> Cria student_contracts (billing_type=stripe_auto, status=active)
  -> Registra financial_transactions
```

### 6.4 Nova Assinatura (Manual)
```
Treinador -> /financial/subscriptions -> "Nova Assinatura"
  -> Seleciona aluno + plano + "Controle Manual"
  -> Cria student_contracts (billing_type=manual_recurring, status=active)
  -> current_period_end = hoje + interval

[Apos vencimento]
  -> Treinador ve status "Pendente"
  -> Se block_on_fail=true: aluno ve tela de bloqueio
  -> Treinador -> "Marcar como Pago"
  -> status=active, period_end avanca
  -> Registra financial_transaction
```

### 6.5 Nova Assinatura (Cortesia)
```
Treinador -> /financial/subscriptions -> "Nova Assinatura"
  -> Seleciona aluno + "Acesso Gratuito"
  -> Cria student_contracts (billing_type=courtesy, amount=0, block_on_fail=false)
  -> Aluno sempre liberado
```

### 6.6 Inadimplencia (Stripe)
```
Stripe -> invoice.payment_failed (webhook)
  -> student_contracts.status = past_due
  -> Se block_on_fail=true: aluno bloqueado no app
  -> Se block_on_fail=false: aluno continua acessando
```

### 6.7 Cancelamento
```
Stripe -> customer.subscription.deleted (webhook)
  -> student_contracts.status = canceled
```

---

## 7. Interface do Treinador (Web)

### 7.1 Navegacao
"Financeiro" no sidebar (icone Wallet), entre "Programas" e "Configuracoes".

### 7.2 Dashboard (`/financial`)
- Card Stripe Connect (conectar/status)
- Stats: alunos ativos, MRR, transacoes do mes
- Transacoes recentes (ultimas 10)

### 7.3 Planos (`/financial/plans`)
- Tabela: titulo, preco, intervalo, visibilidade, ativo
- Modal criar/editar plano
- Planos para Stripe: cria Product+Price na conta conectada
- Planos para manual: so salva no DB

### 7.4 Assinaturas (`/financial/subscriptions`)

**Tabela:**
| Coluna | Descricao |
|--------|-----------|
| Aluno | Avatar + nome |
| Plano | Titulo |
| Valor | R$ |
| Tipo | Badge: Stripe (roxo) / Manual (azul) / Avulso (cinza) / Cortesia (verde) |
| Status | Badge: Ativo (verde) / Pendente (amarelo) / Cancelado (vermelho) |
| Bloqueio | Toggle block_on_fail |
| Proxima Cobranca | Data |
| Acoes | Pago / Cancelar / Link |

**Modal "Nova Assinatura":**
1. Selecionar aluno
2. Escolher tipo:
   - "Cobrar via Stripe" -> selecionar plano -> gerar link
   - "Controle Manual" -> selecionar plano -> criar contrato
   - "Acesso Gratuito" -> criar cortesia
3. Opcao: `block_on_fail` (default: true, hidden para cortesia)

---

## 8. Interface do Aluno (Mobile)

### 8.1 Tela de Bloqueio
- Exibida quando `check_student_access` retorna `allowed=false`
- Mensagens contextuais por motivo
- Botao "Entrar em contato" (WhatsApp do treinador)

### 8.2 Perfil -> "Minha Assinatura"
- Nome do plano, valor (ou "Cortesia"), status, tipo de cobranca
- Proxima cobranca (se aplicavel)

### 8.3 Historico de Pagamentos
- Lista de financial_transactions

### Nota
Checkout via browser (link compartilhado). Sem Stripe SDK no mobile.

---

## 9. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/stripe/connect/onboard` | Cria conta Connect + Account Link |
| GET | `/api/stripe/connect/status` | Sync status da conta |
| POST | `/api/stripe/connect/checkout` | Checkout na conta conectada |
| POST | `/api/webhooks/stripe-connect` | Webhook handler Connect |

### Server Actions

| Action | Descricao |
|--------|-----------|
| `create-plan.ts` | Cria plano + Stripe Product/Price |
| `update-plan.ts` | Atualiza plano |
| `toggle-plan.ts` | Ativa/desativa plano |
| `create-contract.ts` | Cria contrato (manual/cortesia) |
| `mark-as-paid.ts` | Baixa manual de pagamento |
| `cancel-contract.ts` | Cancela contrato |
| `generate-checkout-link.ts` | Gera URL checkout |

---

## 10. Webhook Events (Connect)

Endpoint: `/api/webhooks/stripe-connect`
Secret: `STRIPE_CONNECT_WEBHOOK_SECRET`

| Evento | Acao |
|--------|------|
| `account.updated` | Sync -> payment_settings |
| `checkout.session.completed` | Criar student_contracts (stripe_auto) |
| `invoice.payment_succeeded` | financial_transactions + sync contracts |
| `invoice.payment_failed` | contracts -> past_due |
| `customer.subscription.updated` | Sync status |
| `customer.subscription.deleted` | contracts -> canceled |

**Idempotencia:** `webhook_events.event_id`.

---

## 11. Seguranca

1. **RLS** em todas as tabelas financeiras
2. **Ownership validation** em todas as server actions
3. **Webhook signature** com secret dedicada
4. **Idempotencia** via webhook_events
5. **Service role** para writes financeiros (webhooks)
6. **check_student_access** como SECURITY DEFINER
7. **Retrocompatibilidade**: alunos sem contrato = acesso livre
8. **block_on_fail**: treinador controla granularmente o bloqueio

---

## 12. Variaveis de Ambiente

### Nova
```
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
```

### Existentes
```
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_... (assinatura Kinevo)
```

---

## 13. Fases de Entrega

| Fase | Escopo | Entregaveis |
|------|--------|-------------|
| 1 | Database + Connect | Migration (RLS, enums, RPC), onboarding API, dashboard minimo |
| 2 | Plans CRUD | Server actions, UI planos, Stripe Product/Price |
| 3 | Contratos + Checkout + Webhooks | 3 tipos de contrato, checkout API, webhook handler |
| 4 | Dashboard + Assinaturas | Stats, transacoes, lista assinaturas completa |
| 5 | Mobile | Bloqueio, assinatura, historico |

---

## 14. Metricas de Sucesso

- Treinador conecta Stripe em < 5 min
- Treinador cria plano e gera link em < 2 min
- Treinador registra pagamento manual em < 30s
- Webhook processa em < 5s
- Aluno bloqueado ve tela correta
- Aluno legado (sem contrato) continua acessando
- Zero vazamento entre treinadores (RLS)

---

## 15. Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|----------|
| Webhook falha | Endpoint /status para sync manual |
| Treinador desconecta Stripe | account.updated sync |
| Aluno legado perde acesso | Regra: sem contrato = liberado |
| Contratos manuais sem cron | v1: treinador controla; v2: cron job |
| RLS mal configurada | Testes de isolamento |
