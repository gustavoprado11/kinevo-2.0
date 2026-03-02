# ⚡ KINEVO — Módulo Financeiro Redesenhado
> **Product Requirements Document (PRD) v2.0 — Confidencial**

| | |
|---|---|
| Versão | 2.0 |
| Status | Planejamento |
| Autor | Gustavo — Fundador Kinevo |
| Revisão técnica | Análise de arquitetura e mitigação de riscos |
| Dependência | Módulo financeiro atual em produção |
| Data | Março 2026 |

---

## 1. Mudança de Paradigma

### Hoje — Centrado em Assinaturas
O treinador gerencia **contratos**. Um aluno pode aparecer múltiplas vezes na lista — uma linha por contrato criado, incluindo cancelados. A visão principal é poluída e confusa.

### Novo — Centrado em Alunos
O treinador gerencia o **status financeiro de cada pessoa**. Um aluno = uma linha. O histórico completo fica dentro do modal do aluno. A visão principal é sempre limpa e acionável.

**Princípio fundamental:** todo aluno sempre aparece na listagem. Se um contrato é cancelado e expira, o aluno volta automaticamente para cortesia — nunca desaparece.

---

## 2. Regras de Negócio

### 2.1 Todo aluno é cortesia por padrão

Quando um aluno é cadastrado no Kinevo, ele aparece automaticamente no módulo financeiro com status **Cortesia**. O treinador não precisa criar nada — o aluno já está lá.

O treinador decide depois se quer manter como cortesia, criar um plano manual ou cobrar via Stripe. Sem decisão = cortesia indefinidamente.

**Implementação:** Cortesia não é um contrato no banco de dados. Alunos sem contrato ativo são tratados como cortesia pela query (via `COALESCE`). Isso evita poluir a tabela `student_contracts` com registros vazios e elimina a necessidade de backfill para alunos existentes.

### 2.2 Uma linha por aluno

A tela de assinaturas exibe exatamente um registro por aluno — o contrato **atual**. Contratos anteriores (cancelados, migrados) ficam no histórico dentro do modal do aluno.

**Exclusão:** O self-profile do treinador (`is_trainer_profile = true`, criado pela migration 031) nunca aparece na listagem financeira.

### 2.3 Migração entre tipos de cobrança

Quando o treinador troca o tipo de cobrança de um aluno (ex: de Stripe para Manual, ou de Manual para Stripe):
- O sistema exibe um **alerta de confirmação** descrevendo o que vai acontecer
- Ao confirmar, o contrato anterior é **cancelado automaticamente**
- O novo contrato é criado imediatamente
- A mudança é registrada no histórico do aluno com data e tipo de transição

**Alerta para migração de Stripe → Manual:**
> "O aluno [Nome] tem uma assinatura Stripe ativa que vence em [data]. Ao confirmar, a assinatura será cancelada imediatamente no Stripe e substituída por um controle manual. O aluno perderá o acesso automático e você precisará marcar os pagamentos manualmente. Deseja continuar?"

**Alerta para migração de Manual → Stripe:**
> "O aluno [Nome] tem um controle manual ativo. Ao confirmar, o controle manual será encerrado e você precisará enviar um link de pagamento Stripe para o aluno. O acesso continuará ativo até você configurar o bloqueio. Deseja continuar?"

**Segurança na migração envolvendo Stripe:** A operação usa transaction com rollback. A sequência é:
1. Validar que o aluno tem contrato ativo
2. Se envolve Stripe, cancelar a subscription na API do Stripe primeiro
3. Se o Stripe falhar → abortar tudo, exibir erro ao treinador
4. Se o Stripe confirmar → cancelar contrato antigo no banco + criar novo contrato
5. Registrar evento `contract_migrated` em `contract_events`

Se a criação do novo contrato falhar após cancelamento no Stripe, registrar o erro e alertar o treinador para recriar manualmente (o evento de erro fica no histórico).

### 2.4 Controle de acesso por inadimplência

Para cada aluno com plano (manual ou Stripe), o treinador pode definir se o treino aparece ou não em caso de inadimplência. Esse controle fica visível e editável diretamente na linha do aluno — não escondido em configurações.

**Estados possíveis:**
- `Manter acesso` — aluno inadimplente continua com acesso **(padrão)**
- `Bloquear acesso` — aluno inadimplente não vê treinos no app

**Proteção contra clique acidental:** Ao ativar o bloqueio (manter → bloquear), o sistema exibe um mini-confirm inline: "Bloquear acesso de [Nome] se inadimplente?". O inverso (desbloquear) não precisa de confirmação.

O toggle não aparece para alunos em cortesia (não há inadimplência possível).

### 2.5 Cancelamento pelo aluno via app mobile

Quando o aluno cancela uma assinatura Stripe pelo app mobile, o treinador recebe:
- **Notificação imediata** no painel de notificações do Kinevo
- **Badge destacado** na linha do aluno na tela de assinaturas: "Cancelou pelo app — acesso até [data]"
- O status do aluno muda para "Cancela em [data]" com cor amarela — diferente de inadimplente (vermelho) e ativo (verde)

### 2.6 Ciclo de vida do cancelamento

Quando um contrato é cancelado (por qualquer ator), o ciclo completo é:

**Para contratos Stripe com `cancel_at_period_end = true`:**
1. Status visual muda para "Cancela em [data]" (amarelo)
2. Aluno mantém acesso até a data
3. Webhook `customer.subscription.deleted` confirma o fim
4. Contrato vai para `status = 'canceled'`
5. **Aluno retorna automaticamente para cortesia** (sem contrato ativo = cortesia pela query)
6. Evento `contract_canceled` registrado no histórico

**Para cancelamentos imediatos (pelo treinador):**
1. Contrato vai direto para `status = 'canceled'`
2. Aluno retorna imediatamente para cortesia
3. Evento registrado no histórico

**Invariante:** O aluno nunca some da listagem. Após qualquer cancelamento, ele reaparece como cortesia.

### 2.7 Regra de "Marcar como Pago" (manual)

Quando o treinador marca um pagamento manual como recebido:
- `current_period_end` é renovado **a partir da data de vencimento anterior**, não a partir de hoje
- Isso evita que atrasos encurtem o próximo período
- Se vencia em 10/03 com intervalo mensal, o novo vencimento é 10/04 — mesmo que o treinador marque em 15/03
- Exceção: `manual_one_off` não renova período

**Buffer de graça para inadimplência:** Um contrato manual com vencimento expirado não entra em inadimplência imediatamente. Há um buffer de **3 dias** antes de mudar o status para inadimplente. Durante o buffer, o status visual é "Vence hoje" (cor laranja). Isso cobre atrasos leves sem alarmar o treinador.

---

## 3. Estados do Aluno no Módulo Financeiro

| Status | Cor | Descrição | Ação Disponível |
|---|---|---|---|
| **Cortesia** | Azul | Sem cobrança configurada (padrão) | Configurar cobrança |
| **Aguardando pagamento** | Azul claro | Link Stripe enviado, aguardando checkout | Reenviar link / Cancelar |
| **Ativo — Stripe** | Verde | Pagamento automático em dia | Ver detalhes / Migrar |
| **Ativo — Manual** | Verde | Treinador controla manualmente | Marcar pago / Migrar |
| **Vence hoje** | Laranja | Pagamento manual venceu há ≤3 dias (buffer de graça) | Marcar pago / Contatar |
| **Cancela em [data]** | Amarelo | Aluno cancelou pelo app, acesso até a data | Ver detalhes |
| **Inadimplente** | Vermelho | Pagamento atrasado >3 dias ou falhou no Stripe | Contatar / Marcar pago |
| **Encerrado** | Cinza | Contrato cancelado pelo treinador | Configurar cobrança |

**Sobre "Encerrado":** A ação é "Configurar cobrança" (abre o modal de configuração com o aluno pré-selecionado), não "Reativar". O treinador escolhe o novo tipo de cobrança do zero — sem ambiguidade sobre qual plano ou billing type restaurar.

**Sobre "Aguardando pagamento":** Estado para contratos Stripe com `status = 'pending'`. Entre gerar o link e o aluno pagar podem se passar horas ou dias. O treinador precisa saber que o link foi enviado e poder reenviar se necessário.

---

## 4. Telas

### 4.1 Dashboard (`/financial`)

**Métricas principais — reformuladas:**

| Métrica | O que mostra | Cálculo |
|---|---|---|
| Receita do mês | Soma dos pagamentos registrados no mês | `SUM(amount)` de `financial_transactions` onde `processed_at` está no mês corrente |
| Alunos pagantes | Ativos com plano (Stripe ou Manual) | Count de contratos com `status = 'active'` e `billing_type != 'courtesy'` |
| Alunos em cortesia | Sem cobrança configurada | Count de alunos sem contrato ativo |
| Atenção necessária | Inadimplentes + vencidos + cancelamentos pendentes | Count combinado |

**Nota sobre "Receita do mês":** Usa `processed_at` da tabela `financial_transactions` como referência, não a data de marcação do pagamento. Se o treinador marca 5 pagamentos atrasados de meses anteriores no mesmo dia, cada pagamento é contabilizado no mês do seu respectivo `processed_at` (que é setado na hora da marcação). Isso é simples e honesto — "receita que entrou neste mês". A V1 não distingue competência vs. caixa para evitar complexidade.

**Seção "Atenção necessária"** — substituir o atual "Todas as cobranças em dia" por uma lista acionável:
- Se não há pendências: badge verde "Tudo em dia"
- Se há pendências: lista dos alunos que precisam de ação, com botão direto para o modal de cada um

**Remover** o "R$ 0,57 pendente" do header sem contexto — essa informação vai para dentro do modal de cada aluno inadimplente.

### 4.2 Assinaturas (`/financial/subscriptions`) — Tela Principal Redesenhada

**Tab padrão:** Pagantes (não "Todos")

**Tabs disponíveis (com contadores):**

| Tab | Conteúdo | Contador |
|---|---|---|
| Pagantes | Stripe + Manual ativos + Aguardando pagamento | `Pagantes (12)` |
| Cortesia | Sem cobrança configurada | `Cortesia (38)` |
| Atenção | Inadimplentes + Vence hoje + Cancelamentos pendentes | `Atenção (2)` — badge vermelho se > 0 |
| Encerrados | Contratos cancelados | `Encerrados (5)` |
| Todos | Tudo junto | `Todos (57)` |

A separação entre Pagantes e Cortesia evita que treinadores com muitos alunos gratuitos tenham dificuldade de encontrar seus pagantes na listagem.

**Colunas da tabela:**

| Aluno | Tipo | Valor | Status | Vencimento | Acesso | Ações |
|---|---|---|---|---|---|---|
| [Avatar] Nome | Stripe / Manual / Cortesia | R$ 149,90/mês | [Badge colorido] | 20/03/2026 | [Toggle] | [Botão] |

**Coluna "Tipo":**
- `Stripe` — cobrança automática via Stripe Connect
- `Manual` — treinador controla pagamentos
- `Cortesia` — sem cobrança (sem contrato no banco)

**Coluna "Acesso"** — toggle visível diretamente na linha:
- ON = acesso liberado mesmo se inadimplente (padrão)
- OFF = bloqueia acesso se inadimplente
- Oculto para alunos em cortesia

Ao ativar o bloqueio: mini-confirm inline "Bloquear acesso de [Nome] se inadimplente?"

**Coluna "Ações"** — botão contextual por status:
- Cortesia → "Configurar cobrança"
- Aguardando pagamento → "Reenviar link" / "Cancelar"
- Ativo Manual → "Marcar pago"
- Ativo Stripe → "Ver detalhes"
- Vence hoje → "Marcar pago" / "Contatar"
- Inadimplente → "Contatar" (abre WhatsApp) + "Marcar pago"
- Cancela em [data] → "Ver detalhes"
- Encerrado → "Configurar cobrança"

**Contatar via WhatsApp:** Usa deep link `https://wa.me/55{phone}?text={mensagem}`. Requer que o campo `phone` em `students` esteja preenchido. Se não estiver, o botão fica desabilitado com tooltip "Adicione o telefone do aluno para contatar via WhatsApp".

**Busca** — busca por nome do aluno (já existe, manter).

**Ordenação padrão:** Prioridade de atenção (inadimplentes primeiro, depois vencidos, pendentes, ativos, cortesia).

### 4.3 Modal do Aluno — Visão Completa

Ao clicar em qualquer linha, abre o modal com duas abas:

**Aba 1 — Situação Atual**

```
┌─────────────────────────────────────────────────────┐
│  [Avatar] Marina Lanza                              │
│  Status: Ativo — Stripe  ●  Vence 20/03/2026       │
│  Plano: Consultoria Mensal  ·  R$ 149,90/mês       │
│                                                     │
│  Controle de acesso:  [Toggle] Bloquear se atrasar  │
│                                                     │
│  [Migrar tipo de cobrança ▾]  [Cancelar contrato]   │
└─────────────────────────────────────────────────────┘
```

Para alunos com Stripe, adicionar:
- Data do próximo débito automático
- Último pagamento confirmado
- Se o aluno cancelou pelo app: banner amarelo "Aluno cancelou — acesso garantido até [data]"

Para alunos com status "Aguardando pagamento":
- Link de checkout gerado (com botão copiar)
- Data de geração do link
- Botões: "Reenviar via WhatsApp" / "Gerar novo link" / "Cancelar"

Para alunos em cortesia:
- Mensagem simples: "Sem cobrança configurada"
- Botão: "Configurar cobrança"

**Aba 2 — Histórico**

Lista cronológica reversa com dois tipos de evento, unificados em uma timeline:

```
◆ 20/02/2026  Pagamento recebido  +R$ 149,90  (Stripe)
◆ 15/02/2026  Migrou de Manual para Stripe
◆ 10/01/2026  Pagamento recebido  +R$ 99,90  (Manual)
◆ 10/01/2026  Plano alterado: R$ 99,90 → R$ 149,90
◆ 05/12/2025  Contrato criado — Controle Manual
◆ 01/12/2025  Aluno cadastrado — Cortesia
```

O histórico sempre começa com "Aluno cadastrado — Cortesia" como primeiro evento (backfill para alunos existentes na migration).

Ícones visuais por tipo:
- 💰 Pagamento recebido (verde)
- ❌ Pagamento falhou (vermelho)
- 🔄 Migração de tipo (azul)
- 📝 Contrato criado/alterado (cinza)
- 🚫 Contrato cancelado (cinza)

### 4.4 Modal "Configurar Cobrança" (novo aluno ou migração)

Substituir o modal atual de 2 etapas por um único modal contextual:

**Etapa 1 — Escolha o tipo** (igual ao atual, manter)
- Cobrar via Stripe
- Controle Manual
- Acesso Gratuito (Cortesia) — só aparece se está migrando de outro tipo de volta para cortesia

**Etapa 2 — Detalhes** (reformulada)

Para **Stripe**:
```
Aluno: [já pré-selecionado se veio da linha do aluno]
Plano: [dropdown]
─────────────────────────────────────────
[Gerar Link de Pagamento]
─────────────────────────────────────────
Após gerar o link:
"Copie e envie para o aluno via WhatsApp ou e-mail.
O acesso é liberado automaticamente após o pagamento."
[📋 Copiar link]  [💬 Enviar via WhatsApp]
```

Para **Manual**:
```
Plano: [dropdown] ou [+ Valor personalizado]
Recorrência: Mensal / Trimestral / Anual / Único
Primeiro vencimento: [datepicker]
Bloquear acesso se atrasar: [toggle, default OFF]
─────────────────────────────────────────
[Criar contrato]
```

Se o modal foi aberto para **migração** (aluno já tem contrato ativo), a Etapa 1 exibe o alerta de confirmação de migração antes de prosseguir (conforme Seção 2.3).

---

## 5. Fluxo de Onboarding Financeiro (Primeiro Acesso)

O treinador que abre o Financeiro pela primeira vez com alunos cadastrados vê:

```
┌─────────────────────────────────────────────────────┐
│  💡 Seus alunos já estão aqui                       │
│                                                     │
│  3 alunos cadastrados aparecem automaticamente      │
│  como cortesia. Você decide se e como cobrar        │
│  cada um deles.                                     │
│                                                     │
│  Quer cobrar via Stripe (automático) ou controlar   │
│  manualmente? Clique em qualquer aluno para         │
│  configurar.                                        │
│                                                     │
│  [Entendi, vou explorar]  [Configurar Stripe agora] │
└─────────────────────────────────────────────────────┘
```

Se o Stripe não estiver conectado e o treinador tentar criar uma cobrança Stripe, mostrar:
```
"Para cobrar via Stripe, você precisa conectar sua conta.
Leva menos de 5 minutos."
[Conectar Stripe]
```

---

## 6. Notificações

### 6.1 Notificações em tempo real (já existe `student_inbox_items`)

Novos eventos que disparam notificação:

| Evento | Mensagem | Disparo |
|---|---|---|
| Aluno cancela pelo app | "[Nome] cancelou a assinatura pelo app. Acesso garantido até [data]." | Webhook `customer.subscription.updated` com `cancel_at_period_end = true` |
| Pagamento Stripe falhou | "Pagamento de [Nome] falhou. Vence em [data]. Definir bloqueio?" | Webhook `invoice.payment_failed` |
| Pagamento manual venceu | "[Nome] tem pagamento manual vencido há X dias." | CRON job diário (ver Seção 7.6) |
| Pagamento Stripe confirmado | "[Nome] pagou R$ [valor]. Próximo vencimento: [data]." | Webhook `invoice.payment_succeeded` |

### 6.2 Badge de atenção na sidebar

O item "Financeiro" na sidebar recebe um badge numérico quando há alunos que precisam de ação — igual ao padrão do inbox. O badge conta:
- Contratos com `status = 'past_due'`
- Contratos manuais com `current_period_end < now() - interval '3 days'` (após buffer de graça)
- Contratos com `cancel_at_period_end = true` (cancelamento pendente)

---

## 7. Arquitetura Técnica

### 7.1 O que NÃO muda no banco de dados

A tabela `student_contracts` continua com a regra de "apenas 1 contrato ativo por aluno". A migração entre tipos já é suportada — o novo contrato cancela os anteriores automaticamente. Isso é suficiente para o novo fluxo.

**Cortesia não gera contrato no banco.** Alunos sem contrato ativo são tratados como cortesia pela query. Isso é mais limpo que criar registros com `billing_type = 'courtesy'` e `amount = 0` para cada aluno.

### 7.2 RPC para listagem financeira

A view de "um aluno por linha" é implementada como uma **RPC no Supabase** (não query direta no frontend). Isso centraliza a lógica de status derivado no banco e garante que frontend, mobile e dashboard calculem de forma idêntica.

```sql
CREATE OR REPLACE FUNCTION get_financial_students(p_trainer_id UUID)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  contract_id UUID,
  billing_type TEXT,
  contract_status TEXT,
  amount NUMERIC,
  current_period_end TIMESTAMPTZ,
  block_on_fail BOOLEAN,
  cancel_at_period_end BOOLEAN,
  canceled_by TEXT,
  canceled_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  plan_title TEXT,
  plan_interval TEXT,
  display_status TEXT
) AS $$
SELECT
  s.id,
  s.name,
  s.avatar_url,
  s.phone,
  sc.id,
  sc.billing_type,
  sc.status,
  sc.amount,
  sc.current_period_end,
  sc.block_on_fail,
  sc.cancel_at_period_end,
  sc.canceled_by,
  sc.canceled_at,
  sc.stripe_subscription_id,
  tp.title,
  tp.interval,
  -- Status derivado para o frontend
  CASE
    WHEN sc.id IS NULL THEN 'courtesy'
    WHEN sc.billing_type = 'courtesy' THEN 'courtesy'
    WHEN sc.status = 'pending' THEN 'awaiting_payment'
    WHEN sc.cancel_at_period_end = true THEN 'canceling'
    WHEN sc.status = 'past_due' THEN 'overdue'
    WHEN sc.status = 'active'
      AND sc.billing_type IN ('manual_recurring', 'manual_one_off')
      AND sc.current_period_end < now()
      AND sc.current_period_end >= now() - interval '3 days'
      THEN 'grace_period'
    WHEN sc.status = 'active'
      AND sc.billing_type IN ('manual_recurring', 'manual_one_off')
      AND sc.current_period_end < now() - interval '3 days'
      THEN 'overdue'
    WHEN sc.status = 'active' THEN 'active'
    ELSE 'courtesy'
  END
FROM students s
LEFT JOIN student_contracts sc ON sc.student_id = s.id
  AND sc.status IN ('active', 'past_due', 'pending')
LEFT JOIN trainer_plans tp ON tp.id = sc.plan_id
WHERE s.coach_id = p_trainer_id
  AND s.status = 'active'
  AND s.is_trainer_profile = false
ORDER BY
  CASE
    WHEN sc.status = 'past_due' THEN 0
    WHEN sc.status = 'active'
      AND sc.billing_type IN ('manual_recurring', 'manual_one_off')
      AND sc.current_period_end < now() - interval '3 days'
      THEN 1
    WHEN sc.cancel_at_period_end = true THEN 2
    WHEN sc.status = 'active'
      AND sc.current_period_end < now()
      THEN 3
    WHEN sc.status = 'pending' THEN 4
    WHEN sc.status = 'active' THEN 5
    ELSE 6
  END,
  s.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**Mapeamento `display_status` → estado visual do frontend:**

| display_status | Estado visual | Cor |
|---|---|---|
| `courtesy` | Cortesia | Azul |
| `awaiting_payment` | Aguardando pagamento | Azul claro |
| `active` | Ativo — Stripe ou Ativo — Manual | Verde |
| `grace_period` | Vence hoje | Laranja |
| `canceling` | Cancela em [data] | Amarelo |
| `overdue` | Inadimplente | Vermelho |

O frontend usa `billing_type` junto com `display_status` para montar o label completo (ex: "Ativo — Stripe" vs "Ativo — Manual").

### 7.3 Novos campos em `student_contracts`

```sql
ALTER TABLE public.student_contracts
  ADD COLUMN canceled_by TEXT
    CHECK (canceled_by IN ('trainer', 'student', 'system')),
  ADD COLUMN canceled_at TIMESTAMPTZ;
```

- `canceled_by` — preenchido ao cancelar: `'student'` quando vem do app mobile (webhook), `'trainer'` quando cancelado pelo painel, `'system'` para cancelamentos automáticos (ex: expiração)
- `canceled_at` — timestamp exato do cancelamento, independente de `updated_at`

### 7.4 Tabela `contract_events` — Histórico de mudanças

```sql
CREATE TABLE public.contract_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.student_contracts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'student_registered',   -- aluno cadastrado (cortesia implícita)
      'contract_created',     -- novo contrato criado
      'contract_migrated',    -- migração entre tipos de cobrança
      'payment_received',     -- pagamento confirmado (Stripe ou manual)
      'payment_failed',       -- pagamento falhou (Stripe)
      'contract_canceled',    -- contrato cancelado
      'plan_changed',         -- valor ou plano alterado
      'access_blocked',       -- treinador ativou bloqueio por inadimplência
      'access_unblocked'      -- treinador desativou bloqueio
    )),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice principal: histórico do aluno no modal (query mais frequente)
CREATE INDEX idx_contract_events_student
  ON contract_events(student_id, created_at DESC);

-- Índice para queries do treinador (dashboard, relatórios futuros)
CREATE INDEX idx_contract_events_trainer
  ON contract_events(trainer_id, event_type, created_at DESC);
```

**Referência de metadata por event_type:**

| event_type | metadata esperado |
|---|---|
| `student_registered` | `{}` |
| `contract_created` | `{ "billing_type": "stripe_auto", "amount": 149.90, "plan_title": "Mensal" }` |
| `contract_migrated` | `{ "from": "manual_recurring", "to": "stripe_auto" }` |
| `payment_received` | `{ "amount": 149.90, "method": "stripe", "stripe_payment_id": "pi_xxx" }` |
| `payment_failed` | `{ "amount": 149.90, "reason": "card_declined" }` |
| `contract_canceled` | `{ "canceled_by": "student", "reason": "app_cancellation" }` |
| `plan_changed` | `{ "from_amount": 99.90, "to_amount": 149.90, "from_plan": "Básico", "to_plan": "Premium" }` |
| `access_blocked` | `{}` |
| `access_unblocked` | `{}` |

**RLS:** Treinador lê apenas eventos dos seus alunos (`trainer_id = auth.uid()`). Escrita via `service_role` (webhooks) e server actions autenticadas.

`contract_id` usa `ON DELETE SET NULL` porque o evento histórico deve sobreviver à exclusão do contrato.

### 7.5 Trigger para evento inicial + Backfill

```sql
-- Trigger: quando aluno é cadastrado, registrar evento de cortesia
CREATE OR REPLACE FUNCTION register_student_registered_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Não registrar para self-profiles de treinador
  IF NEW.is_trainer_profile = true THEN
    RETURN NEW;
  END IF;

  INSERT INTO contract_events (student_id, trainer_id, event_type, metadata)
  VALUES (NEW.id, NEW.coach_id, 'student_registered', '{}');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_student_registered
  AFTER INSERT ON students
  FOR EACH ROW EXECUTE FUNCTION register_student_registered_event();
```

**Backfill para alunos existentes** (na mesma migration):

```sql
-- Backfill: criar evento 'student_registered' para alunos que já existem
INSERT INTO contract_events (student_id, trainer_id, event_type, metadata, created_at)
SELECT s.id, s.coach_id, 'student_registered', '{}', s.created_at
FROM students s
WHERE s.is_trainer_profile = false
  AND NOT EXISTS (
    SELECT 1 FROM contract_events ce
    WHERE ce.student_id = s.id
    AND ce.event_type = 'student_registered'
  );
```

### 7.6 CRON Job — Detecção de vencimento manual

Pagamentos manuais não têm webhook. A detecção de vencimento é feita por um job que roda **diariamente às 08:00 UTC-3** (horário comercial no Brasil):

**Opção preferida: Supabase Edge Function com `pg_cron`**

```sql
-- pg_cron: rodar diariamente às 11:00 UTC (08:00 BRT)
SELECT cron.schedule(
  'check-manual-overdue',
  '0 11 * * *',
  $$
    -- Marcar como past_due contratos manuais vencidos há mais de 3 dias
    UPDATE student_contracts
    SET status = 'past_due'
    WHERE billing_type IN ('manual_recurring', 'manual_one_off')
      AND status = 'active'
      AND current_period_end < now() - interval '3 days';

    -- Inserir notificação para cada treinador afetado
    INSERT INTO student_inbox_items (trainer_id, type, title, body, metadata)
    SELECT
      sc.trainer_id,
      'financial_alert',
      sc.trainer_id || ' tem pagamento vencido',
      format('%s tem pagamento manual vencido há %s dias.',
        s.name,
        EXTRACT(DAY FROM now() - sc.current_period_end)::int
      ),
      jsonb_build_object('student_id', s.id, 'contract_id', sc.id)
    FROM student_contracts sc
    JOIN students s ON s.id = sc.student_id
    WHERE sc.billing_type IN ('manual_recurring', 'manual_one_off')
      AND sc.status = 'past_due'
      AND sc.current_period_end < now() - interval '3 days'
      AND sc.current_period_end >= now() - interval '4 days';  -- só notifica uma vez
  $$
);
```

**Alternativa: Vercel Cron Job** se `pg_cron` não estiver disponível no plano Supabase. Configurar em `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/check-manual-overdue",
    "schedule": "0 11 * * *"
  }]
}
```

### 7.7 Integração com `check_student_access()`

A RPC `check_student_access(p_student_id)` precisa ser atualizada para refletir o buffer de graça:

| Condição | Resultado |
|---|---|
| Aluno não encontrado | `{ allowed: false, reason: 'student_not_found' }` |
| Aluno inativo | `{ allowed: false, reason: 'student_inactive' }` |
| Sem contrato (cortesia implícita) | `{ allowed: true, reason: 'courtesy' }` |
| Contrato `billing_type = 'courtesy'` | `{ allowed: true, reason: 'courtesy' }` |
| Contrato ativo | `{ allowed: true, reason: 'active' }` |
| `cancel_at_period_end = true` + dentro do período | `{ allowed: true, reason: 'canceling' }` |
| Past due + `block_on_fail = false` | `{ allowed: true, reason: 'past_due_allowed' }` |
| Past due + `block_on_fail = true` | `{ allowed: false, reason: 'past_due_blocked' }` |
| Manual vencido ≤3 dias (buffer de graça) | `{ allowed: true, reason: 'grace_period' }` |
| Manual vencido >3 dias + `block_on_fail = true` | `{ allowed: false, reason: 'past_due_blocked' }` |

---

## 8. O Que NÃO Fazer na V1

| Funcionalidade | Por quê não agora |
|---|---|
| Relatórios financeiros avançados (gráficos, projeções) | Dados insuficientes — treinadores ainda não usam. Implementar quando houver volume real |
| Envio automático de boleto/Pix via Stripe | Stripe no Brasil tem limitações para Pix recorrente — validar antes de prometer |
| Split de pagamento entre treinadores | Complexidade de Stripe Connect que não existe no uso atual |
| Lembretes automáticos por WhatsApp/e-mail | Implementar depois que o fluxo manual estiver validado |
| Planos com desconto ou cupom | Fase posterior — foco agora é fazer o básico funcionar bem |
| Distinção receita competência vs. caixa | V1 usa "receita registrada no mês" para simplicidade. Sofisticar quando houver demanda |

---

## 9. Roadmap de Implementação

### Fase 1 — Visão por aluno + Base técnica (Semanas 1-2)
> **Objetivo:** A tela de assinaturas mostra um aluno por linha com status derivado correto, histórico no modal, e badge na sidebar

| Tarefa | Estimativa | Notas |
|---|---|---|
| Criar migration: `contract_events` + índices + backfill | 1 dia | Inclui trigger e backfill de alunos existentes |
| Criar migration: campos `canceled_by` e `canceled_at` em `student_contracts` | 0.5 dia | |
| Implementar RPC `get_financial_students()` | 1 dia | Query com status derivado, ordenação por prioridade |
| Redesenhar tabela com colunas novas (Tipo, Status, Acesso toggle) | 2 dias | Tabs com contadores, confirm no toggle de bloqueio |
| Modal do aluno com abas Situação Atual + Histórico | 2 dias | Timeline unificada, estados visuais por tipo |
| Registrar eventos em todas as server actions existentes | 2 dias | 6 actions + webhook handlers, testar metadata |
| Preencher `canceled_by`/`canceled_at` nos webhooks de cancelamento | 0.5 dia | |
| Badge de atenção na sidebar (financeiro) | 0.5 dia | Count de contratos com problema |

**Total Fase 1: ~9.5 dias úteis**

### Fase 2 — Fluxo de cobrança melhorado (Semanas 3-4)
> **Objetivo:** Treinador configura cobrança em menos de 2 minutos

| Tarefa | Estimativa | Notas |
|---|---|---|
| Modal de configuração com pré-seleção de aluno | 1 dia | Contextual: novo vs migração |
| Pós-geração de link Stripe com botões Copiar + WhatsApp | 0.5 dia | Deep link WhatsApp |
| Alerta de confirmação para migração entre tipos | 1 dia | Textos específicos por direção da migração |
| Migração com transaction + rollback (Stripe → Manual e vice-versa) | 1.5 dias | Tratamento de falha da API Stripe |
| Onboarding para primeiro acesso | 1 dia | |

**Total Fase 2: ~5 dias úteis**

### Fase 3 — Notificações, alertas e CRON (Semanas 5-6)
> **Objetivo:** Treinador é notificado de tudo que precisa de atenção, vencimentos manuais são detectados automaticamente

| Tarefa | Estimativa | Notas |
|---|---|---|
| CRON job para detecção de vencimento manual | 1.5 dias | pg_cron ou Vercel Cron, inclui buffer de graça |
| Atualizar `check_student_access()` com buffer de graça | 0.5 dia | |
| Notificação de cancelamento pelo app (webhook → inbox) | 1 dia | |
| Notificação de pagamento falhou | 0.5 dia | |
| Notificação de vencimento manual (disparada pelo CRON) | 0.5 dia | |
| Dashboard reformulado com "Atenção necessária" | 1 dia | Métricas recalculadas com `processed_at` |

**Total Fase 3: ~5.5 dias úteis**

**Total geral estimado: ~20 dias úteis (4 semanas)**

---

## 10. Server Actions — Registro de Eventos

Todas as server actions que modificam contratos devem registrar em `contract_events`. O insert do evento **nunca deve bloquear a action principal** — se falhar, logar o erro mas não reverter a operação.

| Server Action | event_type | metadata |
|---|---|---|
| `createContract` | `contract_created` | `{ billing_type, amount, plan_title }` |
| `updateContract` | `plan_changed` | `{ from_amount, to_amount, from_plan, to_plan }` |
| `cancelContract` | `contract_canceled` | `{ canceled_by, reason }` |
| `markAsPaid` | `payment_received` | `{ amount, method: 'manual' }` |
| `generateCheckoutLink` | `contract_created` | `{ billing_type: 'stripe_auto', amount, plan_title, status: 'pending' }` |
| Webhook `invoice.payment_succeeded` | `payment_received` | `{ amount, method: 'stripe', stripe_payment_id }` |
| Webhook `invoice.payment_failed` | `payment_failed` | `{ amount, reason }` |
| Webhook `customer.subscription.deleted` | `contract_canceled` | `{ canceled_by: 'system' }` |
| Migração de billing type | `contract_migrated` | `{ from, to }` |

---

## 11. Critérios de Sucesso

| Métrica | Meta em 60 dias após lançamento |
|---|---|
| Treinadores que configuraram ao menos 1 cobrança | > 50% dos ativos |
| Tempo médio para configurar cobrança de um aluno | < 2 minutos |
| Treinadores que relatam confusão na tela de assinaturas | < 10% |
| Adoção do histórico por aluno (modal aberto ao menos 1x) | > 70% dos que usam financeiro |
| Incidentes de aluno sumindo da listagem | 0 (invariante: todo aluno sempre visível) |

---

## 12. Decisões de Design Documentadas

| Decisão | Motivo |
|---|---|
| Cortesia não gera contrato no banco | Evita poluir `student_contracts`, elimina backfill, mais limpo |
| RPC em vez de query direta | Centraliza lógica de status derivado, evita divergência frontend/mobile |
| Buffer de 3 dias antes de inadimplência manual | Cobre atrasos leves sem alarmar o treinador |
| Tabs separadas para Pagantes e Cortesia | Evita que cortesias dominem a listagem |
| "Encerrado" → "Configurar cobrança" (não "Reativar") | Elimina ambiguidade sobre qual plano/tipo restaurar |
| `canceled_at` separado de `updated_at` | Permite métricas de churn precisas |
| `contract_id` em `contract_events` com `ON DELETE SET NULL` | Evento histórico sobrevive à exclusão do contrato |
| Ordenação por prioridade de atenção (não alfabética) | Treinador vê problemas primeiro |
| Migração de tipo com transaction + rollback | Evita estados inconsistentes entre banco e Stripe |
| `processed_at` para receita do mês | Simples e honesto: "quanto entrou neste mês" |

---

*⚡ Kinevo — Módulo Financeiro Redesenhado | PRD v2.0 | Março 2026 | Confidencial*
