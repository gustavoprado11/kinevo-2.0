# Prompt: Spec de Desenvolvimento — Sistema de Monetização por Indicação (Embaixadores Kinevo)

---

## Contexto do Projeto

O **Kinevo** é uma plataforma SaaS que conecta treinadores pessoais aos seus alunos. O treinador usa a plataforma web para prescrever treinos de forma profissional (com suporte a bi-sets, supersets, periodização, notas técnicas), e o aluno executa os treinos pelo app mobile.

**Stack técnico:**
- Web: Next.js 15 (App Router), TypeScript, Tailwind CSS
- Mobile: React Native (Expo Router)
- Backend: Supabase (Auth + PostgreSQL + RLS)
- Pagamentos: Stripe (Checkout + Billing para assinaturas recorrentes)
- Deploy: Vercel (web), EAS Build (mobile)

**Modelo de negócio:**
- O Kinevo cobra uma assinatura mensal de **R$39,90** dos treinadores (plano Pro)
- O app do aluno é gratuito — quem paga é o treinador
- Existe um plano gratuito com limitações e o plano Pro sem limitações

---

## O que queremos construir

Um **sistema de monetização por indicação** inspirado no modelo de cupons da Growth Suplementos, onde treinadores/influenciadores fitness recebem um cupom personalizado (ex: `LUCAS`, `RAFAEL`) e ganham comissão por cada venda gerada através dele.

### Por que esse modelo?

Estamos lançando um **Programa de Embaixadores Kinevo**, onde convidamos treinadores ativos no Instagram e TikTok para usar o Kinevo gratuitamente em troca de exposição orgânica. Muitos desses treinadores **já possuem cupons na Growth Suplementos** e estão familiarizados com a mecânica de cupom personalizado + comissão. Queremos replicar essa experiência familiar, mas adaptada para SaaS com assinatura recorrente.

A grande vantagem do nosso modelo sobre o da Growth: **a comissão é recorrente**. Na Growth, o treinador ganha uma vez por venda. No Kinevo, ele ganha todo mês enquanto o indicado for assinante — o que cria um incentivo muito mais forte para indicar pessoas que realmente vão usar a plataforma.

---

## Regras de Negócio

### Cupom personalizado
- Cada embaixador recebe um **cupom único** com seu nome ou apelido (ex: `LUCAS`, `RAFAEL`, `ANACOSTA`)
- O cupom é alfanumérico, case-insensitive, sem espaços
- Apenas embaixadores aprovados podem ter cupons ativos

### Benefício para quem usa o cupom (novo treinador)
- **20% de desconto nos 2 primeiros meses** da assinatura Pro
- Valor com desconto: R$31,92/mês nos meses 1 e 2, depois R$39,90/mês normalmente
- O cupom só pode ser usado **uma vez por conta** e apenas por **novos assinantes**
- Não acumula com outras promoções

### Comissão para o embaixador que indicou
- **10% de comissão recorrente** sobre cada pagamento do treinador indicado
- Valor da comissão: ~R$3,19/mês nos 2 primeiros meses, ~R$3,99/mês a partir do 3º mês
- A comissão é paga **enquanto o indicado mantiver a assinatura ativa**
- Comissão cessa imediatamente em caso de cancelamento, reembolso ou inadimplência
- Não há comissão sobre o período de trial gratuito (se houver)

### Pagamento das comissões
- Acúmulo mensal com **saldo mínimo de R$20,00 para saque**
- Pagamento via **Pix** (método preferido no Brasil) ou crédito na própria plataforma
- Ciclo de pagamento: comissões do mês são consolidadas no dia 1 e disponibilizadas para saque até o dia 10 do mês seguinte

### Regras de proteção
- Um treinador **não pode usar seu próprio cupom**
- Cupom expira se o embaixador for desativado do programa
- Indicações feitas antes da desativação continuam gerando comissão por 3 meses (período de transição)
- Sistema de detecção de fraude: alertar se o mesmo IP/dispositivo criar múltiplas contas com o mesmo cupom

---

## Fluxo do Usuário

### Fluxo do novo treinador (quem usa o cupom)
1. Treinador acessa a página de checkout do plano Pro
2. Insere o cupom no campo "Cupom de desconto" (ou chega via link com cupom pré-aplicado)
3. Vê o desconto aplicado: "20% off nos 2 primeiros meses — Cupom LUCAS"
4. Completa o pagamento via Stripe Checkout
5. Assinatura criada com o desconto, atribuída ao embaixador que indicou

### Fluxo do embaixador (quem indica)
1. Embaixador acessa seu painel na plataforma web do Kinevo
2. Vê seu cupom personalizado e link de indicação (ex: `kinevoapp.com/pro?cupom=LUCAS`)
3. Compartilha o cupom/link nas redes sociais, DMs, stories, etc.
4. Acompanha em tempo real: número de indicações, assinantes ativos, comissão acumulada, histórico de pagamentos
5. Solicita saque quando o saldo atinge o mínimo

---

## Requisitos Técnicos

### Integração com Stripe
- Criar **Stripe Coupons** programaticamente para cada embaixador
- Usar **Stripe Promotion Codes** vinculados ao cupom para rastreabilidade
- Ao criar a subscription via Stripe Checkout, aplicar o cupom e armazenar o `referrer_id` (embaixador) nos metadata da subscription
- Escutar **Stripe Webhooks** para:
  - `invoice.payment_succeeded` → calcular e registrar comissão
  - `customer.subscription.deleted` → cessar comissões futuras
  - `charge.refunded` → reverter comissão do período reembolsado
  - `invoice.payment_failed` → não gerar comissão

### Modelo de Dados (Supabase/PostgreSQL)

Tabelas necessárias (sugestão inicial — refinar durante o spec):

- `ambassadors` — perfil do embaixador (user_id, cupom, status, data de ativação)
- `referrals` — cada indicação (ambassador_id, referred_user_id, cupom usado, data, status)
- `commissions` — cada comissão gerada (referral_id, stripe_invoice_id, valor, status, data)
- `payouts` — solicitações de saque (ambassador_id, valor, método, status, data)

### Painel do Embaixador (nova seção na web)
- Dashboard com métricas: total de indicações, assinantes ativos, comissão do mês, comissão total
- Lista de indicações com status (ativo, cancelado, trial)
- Histórico de comissões e pagamentos
- Cupom e link de indicação com botão de copiar
- Botão de solicitar saque

### Painel Admin (para o Kinevo gerenciar)
- Lista de embaixadores com métricas
- Aprovar/desativar embaixadores
- Criar cupons personalizados
- Visualizar e aprovar solicitações de saque
- Relatórios: CAC por embaixador, LTV dos indicados, ROI do programa

---

## Considerações Importantes

1. **Stripe é a fonte da verdade**: toda comissão deve ser calculada a partir de eventos reais do Stripe (webhooks), nunca a partir de dados locais. Isso evita inconsistências.

2. **Alternativa a construir do zero**: avaliar se faz sentido usar uma plataforma como **Rewardful** (rewardful.com) que se integra nativamente ao Stripe e automatiza todo o tracking de afiliados. Custo começa em ~$49/mês mas elimina semanas de desenvolvimento. Ponderar build vs buy.

3. **RLS (Row Level Security)**: o embaixador só pode ver suas próprias indicações e comissões. O admin vê tudo.

4. **Escalabilidade**: o sistema deve funcionar bem com 10 embaixadores e 50 indicações, mas estar preparado para 200+ embaixadores e milhares de indicações.

5. **Compliance**: exibir termos claros sobre o programa de indicação. O embaixador deve aceitar os termos antes de ativar seu cupom.

---

## Entregável Esperado

Gere uma **spec técnica de desenvolvimento** com:

1. **Arquitetura do sistema** — como os componentes se conectam (Kinevo web ↔ Stripe ↔ Supabase ↔ webhooks)
2. **Modelo de dados detalhado** — tabelas, colunas, tipos, constraints, RLS policies
3. **API endpoints** necessários (Next.js API routes)
4. **Fluxo de webhooks** — quais eventos do Stripe ouvir e o que fazer com cada um
5. **Telas e componentes** — wireframe textual do painel do embaixador e do admin
6. **Decisão build vs buy** — análise se devemos usar Rewardful ou construir internamente, com prós e contras para o estágio atual do Kinevo
7. **Plano de implementação** — fases, prioridades, estimativa de esforço
8. **Edge cases** — cancelamentos, reembolsos, upgrades/downgrades, fraude, embaixador desativado

Considere que somos um time enxuto (1-2 devs) e priorize a solução mais pragmática para o momento.
