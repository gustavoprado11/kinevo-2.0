# P9 — Máquina de renovação para PIX mensal (spec para decisão)

## Status
- [x] Spec escrita (12/jul/2026)
- [x] DECIDIDA (12/jul/2026): **opção (a) — só manual por ora.** PIX mensal usa o rail
  manual_recurring + "Marcar pago" (máquina existente: período, carência, inadimplência,
  bloqueio). Nenhum cron gerador de cobrança. Reavaliar (c) se o volume de treinadores
  reclamando do trabalho manual justificar.
- [x] Cohort NULL RESOLVIDO (12/jul/2026): os 3 contratos eram TESTES do próprio Gustavo —
  cancelados via kinevo_cancel_contract (core com limpeza Asaas). Zero contratos asaas_auto
  ativos restantes; sem backfill necessário.
- Decisões-irmãs da mesma rodada: P6 = chargeback→past_due imediato + refund só notifica
  (implementado no webhook); P12 = taxa oficial 0% por ora (alarme de env só no estado
  incoerente pct-sem-wallet; copy/simulador já corretos).

## Contexto (o problema)

Recorrência automática na Asaas é **cartão-only**. Plano mensal via PIX hoje significa:
o treinador gera um link avulso TODO MÊS na mão, e o contrato fica "ativo até cancelar" —
aluno que para de pagar **não gera nenhum sinal** (link não pago não vira OVERDUE) e mantém
acesso para sempre. É o maior buraco de integridade do trilho Asaas (P9 da análise 07/jul).

O que já existe ao redor (implementado em jul/2026):
- P8: webhooks/reconcile mantêm `current_period_end` de contratos `asaas_auto_recurring`.
- FIN4 (12/jul): sweep horário no cron de reconciliação — contrato Asaas ATIVO com período
  vencido >1 dia re-verifica o gateway (recupera webhook perdido) e, sem pagamento novo,
  vira `past_due` + evento + notificação ao treinador.
- Carência unificada (migração 242) + bloqueio com opt-in (241): `past_due` entra num funil
  honesto (carência do treinador → bloqueio).
- P13: aluno recebe push/banner de cobrança pendente (endpoint `GET /api/student/payment`).

Ou seja: **assim que um contrato tem `current_period_end` e alguém gera a cobrança do ciclo,
toda a máquina downstream já funciona.** O que falta é QUEM gera a cobrança do próximo ciclo
no PIX mensal.

## Cohort pendente (decisão de dados)

Os **3 contratos `asaas_auto` ativos em prod têm `current_period_end = NULL`** (anteriores ao
P8; última transação 10/jun). Invisíveis ao sweep e a qualquer lógica de expiração local.
Backfill (período = última transação paga + intervalo do plano) os tornaria visíveis — mas
como a última cobrança é de junho, eles virariam `past_due` no primeiro sweep. Antes de
backfillar, confirmar com os treinadores donos se esses contratos são reais/teste e se a
cobrança está acontecendo por fora. **Não backfillar sem essa confirmação.**

## Opções

### (a) Rail manual como recomendação de produto
PIX mensal = `manual_recurring` + "Marcar pago" (máquina existente: período, carência,
inadimplência, bloqueio). O produto passa a recomendar isso na criação do plano PIX.
- ✅ Zero infra nova; estado sempre honesto; já funciona hoje.
- ❌ Trabalho manual mensal do treinador (gerar link + marcar pago); não escala; a proposta
  de valor "automatize sua cobrança" morre no PIX (que é o método dominante no Brasil).

### (b) Cron gerador de cobrança (renovação automática de verdade)
Cron diário: contratos PIX-mensal com `current_period_end` a X dias do vencimento → gera a
cobrança do próximo ciclo via o core Asaas existente (`createAsaasCharge`/payment link),
notifica o aluno (P13), e o não-pagamento cai no funil FIN4→carência→bloqueio.
- ✅ Automação real; usa peças que já existem (charge core, push P13, sweep FIN4, carência).
- ❌ Cria cobranças automaticamente em nome do treinador (artefatos no Asaas dele) — exige
  consentimento explícito; interage com P10 (anti-duplo-link precisa valer aqui); mais
  superfície de dinheiro para manter. Esforço estimado: 2–3 sessões + QA de dinheiro.

### (c) Híbrido com opt-in por plano — **RECOMENDADA**
Flag `auto_renew` por plano (default OFF). Plano PIX mensal com `auto_renew=true` entra no
cron da opção (b); sem a flag, o produto orienta o rail manual (a). Fases:
1. **F1**: flag no plano + cron gerador + push P13 + funil FIN4 (só PIX mensal, só links).
2. **F2**: dunning refinado (lembrete D-3/D0/D+3), UI de próxima cobrança no contrato.
3. **F3**: decidir cohort NULL (backfill pós-confirmação) e migração assistida dos manuais.
- ✅ Consentimento explícito; rollout gradual; não quebra ninguém existente.
- ❌ Mais um conceito no produto (flag) — copy precisa ser clara.

## Decisões pedidas ao Gustavo
1. Opção (a), (b) ou (c)?
2. Se (b)/(c): quantos dias antes do vencimento gerar a cobrança? (sugestão: 5)
3. Cohort NULL: confirmar com os 2 treinadores a realidade dos 3 contratos e autorizar (ou
   não) o backfill.
