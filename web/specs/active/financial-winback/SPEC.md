# Winback financeiro — rascunho de reativação com link de pagamento

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto

O painel "Assistente Kinevo" mostra cards de **"Plano expirou"** (badge
Financeiro) para alunos cujo contrato venceu. Hoje a única ação é "Vender plano"
(abre o fluxo manual) e um botão de mensagem que cai no chat vazio. O treinador
tem que pensar e escrever a mensagem de reativação do zero e, separadamente,
gerar e copiar um link de pagamento.

Este é o **mesmo padrão do loop de retenção** (detectar → rascunhar → aprovar →
enviar/executar), agora aplicado a receita: ligar o card de plano expirado a um
agente que rascunha uma mensagem de **winback** ancorada em dados reais (plano,
data de expiração, tempo de casa) e, no envio, **anexa o link de checkout do
mesmo plano** — reusando os cores financeiros que já existem. O treinador nunca
sai do controle: a IA propõe, ele edita e aprova.

**Metade já existe.** A detecção (`expiredPlans` do dashboard) e a geração de
link de pagamento Asaas (`POST /api/wallet/subscriptions`) já estão prontas. Construímos só a
camada de ação que as costura.

## Objetivo

Ao clicar em "Reativar" num card de plano expirado, o treinador recebe em ~2s um
rascunho de mensagem de winback citando o plano e a data reais, edita livremente,
e ao aprovar dispara o envio via `sendMessage`. Se o treinador tiver a carteira
**Asaas** ativa, a mensagem final inclui o **link de renovação** (Payment Link
recorrente Asaas) do mesmo plano — o aluno renova sozinho; o webhook
`PAYMENT_RECEIVED` existente ativa o contrato.

> **Provider = Asaas.** O treinador migrou de Stripe para **Asaas** (jun/2026).
> O app ainda tem código Stripe (Connect), mas o caminho de cobrança vivo é o
> Asaas, sob `/api/wallet/*`. Esta spec usa Asaas; o Stripe fica como fallback
> caso algum treinador ainda esteja em Connect.

---

## Fase 1 — Validação contra o código (achados + divergências)

### 1. O card "Plano expirou" ✅ (com divergência crítica)

- Renderizado em `web/src/components/dashboard/assistant-action-cards.tsx`
  como linha `type: 'expired_plan'` (`:187-192`); ações atuais: botão de mensagem
  (abre painel de mensagens), `onSellPlan` ("Vender plano") e arquivar
  (`:438-460`). **NÃO é um `assistant_insight`** — é um item derivado do
  dashboard, então não há `insight_id` para marcar como tratado.
- Fonte: `web/src/lib/dashboard/get-dashboard-data.ts` — query de
  `student_contracts` com `status='canceled'` e `current_period_end` no passado
  (`:243-252`), mapeada em `ExpiredPlanItem` (`:431-439`).

> **Divergência 1 — `ExpiredPlanItem` NÃO carrega `plan_id`.** O tipo
> (`get-dashboard-data.ts:48-54`) e a construção (`:431-439`) extraem só
> `planTitle` (string). Para regerar o checkout do MESMO plano precisamos do
> `plan_id`. **Mudança requerida:** adicionar `planId` (e `contractId`) ao
> `ExpiredPlanItem`, incluindo `plan_id` no select da query (`:246`).

### 2. Geração de link de pagamento — Asaas ✅ (reutilizável via endpoint)

- O fluxo vivo é **`POST /api/wallet/subscriptions`**
  (`web/src/app/api/wallet/subscriptions/route.ts`). Body
  `{ studentId, planId, billingType?, nextDueDate? }`. Ele:
  - autentica via `requireTrainer(request)` — **cookie OU Bearer**
    (`web/src/lib/asaas/wallet-service.ts:56-72`), então o composer (com sessão
    web) chama direto;
  - valida ownership de aluno (`:74-82`) e plano (`:85-91`);
  - pega a chave da subconta via `getDecryptedApiKey(trainer.id)` (`:100`);
  - cria contrato local `student_contracts` `status='pending_payment'`,
    `provider='asaas'`, `billing_type='asaas_auto_recurring'` (`:111-124`);
  - gera o **Payment Link recorrente Asaas** via `createPaymentLink`
    (`web/src/lib/asaas/payment-links.ts:38`; chamada em `route.ts:133-148`),
    aplica split do take-rate Kinevo;
  - salva `asaas_payment_link_id` (`:156-159`) e retorna `{ contractId, url, … }`.
- **Recorrência = só cartão de crédito** (auto-débito); PIX/boleto não recorrem
  (`route.ts:47-50`). O webhook **`PAYMENT_RECEIVED`** ativa o contrato (já
  existe; ver `web/src/app/api/webhooks/asaas`).
- **Prontidão da carteira:** depende do status Asaas do treinador
  (`KinevoWalletStatus`/`mapAsaasStatusToLocal`, `wallet-service.ts:480`) —
  `approved` + chave decifrável. É o análogo do antigo `charges_enabled` Stripe.

> **Divergência 2 — gerar o link cria um contrato `pending_payment`.** Igual ao
> Stripe: se gerássemos no rascunho e o treinador descartasse, ficaria órfão.
> **Decisão:** gerar o link só no **envio** (após aprovação). Rascunhos
> descartados não criam contrato.

> **Divergência 3 — link só com carteira Asaas ativa.** Treinador sem subconta
> Asaas aprovada (ou em cobrança manual) não tem link: o winback degrada para
> **mensagem sem link**, e a cobrança segue manual ("Vender plano"). O endpoint
> de rascunho devolve `can_attach_link=false` nesse caso.

> **Divergência 4 — o link Asaas NÃO é um core reutilizável; é um route handler.**
> A lógica está inline em `/api/wallet/subscriptions/route.ts` (não há
> `createAsaasSubscriptionLinkCore`). **Decisão:** o composer reusa o endpoint
> via `fetch` (auth por cookie já suportada), sem extrair core agora.

### 3. Contexto financeiro para o rascunho ✅

- O contrato expirado já vem no card; uma query direta a
  `student_contracts`/`trainer_plans` (plano, valor, `current_period_end`,
  `start_date`) basta para o bloco de contexto — sem precisar do agente.

### 4. Gate `confirm=true` ✅ (referência)

- As writes financeiras destrutivas (Stripe-era) usam preview→confirm
  (`billing-write.ts:162-278`). Gerar um **link** Asaas é reversível (não cobra
  ninguém; a cobrança só ocorre quando o aluno paga), então **o gate é a
  aprovação do treinador no "Enviar"** — não precisa de `confirm=true`.

### 5. Envio + medidor ✅ (já prontos, reaproveitar)

- Envio: `sendMessage(studentId, formData)`
  (`web/src/app/messages/actions.ts:213`) — insere em `messages` + push.
- Medidor de custo: tabela `assistant_llm_usage` (migration 207, já em prod) via
  o mesmo padrão do retention. Auth + rate-limit: espelhar
  `/api/assistant/draft-message` (e `/api/assistant/chat`).

---

## Fase 2 — Especificação do MVP

### Contrato do endpoint

```
POST /api/assistant/winback-draft
auth: sessão do treinador
body: { student_id: string, plan_id: string }
resposta 200: {
  draft: { message, references[], confidence:"high"|"low" },
  can_attach_link: boolean,   // true se carteira Asaas aprovada + plano com preço
  cost_usd: number
}
erros: 401 · 404 (trainer/aluno/plano) · 403 (não pertence) · 429 · 502
```

**Fluxo do servidor** (espelha auth/rate-limit do draft-message):
1. Auth → resolver trainer; rate-limit `assistant:winback:${trainer.id}`
   (10/min, 100/dia).
2. Validar UUIDs; carregar o **contrato expirado** do aluno + plano
   (`student_contracts` join `trainer_plans`), confirmando ownership
   (`trainer_id`/`coach_id`).
3. Montar bloco de contexto: nome, plano (título/valor/intervalo), **data de
   expiração**, tempo de casa (desde `start_date`/`created_at`). Sem dados ricos
   → `confidence:"low"`.
4. `callWithRetry(callLLM({ model:'gpt-4.1-mini', json_object_mode:true, … }))`
   → parse `{ message, references, confidence }`.
5. Calcular `can_attach_link`: carteira Asaas do treinador `approved`
   (`wallet-service`) && plano com `price > 0`. (NÃO gera o link aqui — só
   informa que dá.)
6. Logar uso em `assistant_llm_usage` (`feature:'winback_draft'`).
7. Responder `{ draft, can_attach_link, cost_usd }`. **Não envia, não gera link.**

**Envio (ação separada, no clique "Enviar"):**
- Se `can_attach_link` e o treinador manteve "anexar link de renovação":
  `POST /api/wallet/subscriptions { studentId, planId }` (cookie de sessão) →
  cria contrato `pending_payment` + Payment Link Asaas → pega `url` da resposta →
  anexar `\n\nRenove aqui: <url>` ao texto final.
- `sendMessage(studentId, formData{content})` com o texto final.
- (Sem `markInsightActed` — o card não é insight; some quando o contrato
  reativar no próximo load do dashboard, via webhook `PAYMENT_RECEIVED`.)

### System prompt (winback)

```
Você é o assistente do personal trainer escrevendo UMA mensagem curta de
WhatsApp (PT-BR), na VOZ DO TREINADOR (1ª pessoa), para reconectar com um aluno
cujo plano expirou e convidá-lo a voltar.

REGRAS INVIOLÁVEIS:
- Tom caloroso e pessoal, 2–4 frases. Convida, NÃO pressiona; reconecta, não cobra.
- Referencie só o que está no CONTEXTO (nome do plano, há quanto tempo treinava).
  Sem dado → mensagem genérica e calorosa. NUNCA invente valores, datas ou histórico.
- NÃO afirme fato médico nem prescreva treino.
- NÃO escreva link de pagamento nem valor da cobrança — isso é anexado depois
  pelo sistema, se o treinador escolher.
- SAÍDA só em JSON: { "message": "...", "references": [...], "confidence": "high"|"low" }
  Use "low" se o contexto for pobre.
```

### Mudanças no painel/card (`assistant-action-cards.tsx`)

- No card `expired_plan` (e, por extensão, financeiro **vencido/past-due**),
  adicionar ação **"Reativar"** que abre o `WinbackComposer` para
  `{ studentId, planId, studentName, planTitle }`.
- `WinbackComposer` (novo, espelha `DraftMessageComposer`): loading → textarea
  editável com o rascunho, linha de referências, aviso se `confidence:"low"`.
- Se `can_attach_link`: checkbox **"Anexar link de renovação ([Plano])"** (ligado
  por padrão). Se não, nota: "cobrança manual — combine o pagamento."
- Ações: **Enviar** (gera link se marcado → anexa → `sendMessage`) e **Descartar**.
- NÃO remover "Vender plano" nem "Arquivar" (continuam como estão).

### Critérios de aceite

- [ ] **Principal (carteira Asaas ativa):** clico em "Reativar" num card de plano
  expirado → em ~2s aparece um rascunho citando o plano e a expiração reais →
  edito → Enviar → o aluno recebe a mensagem **com um Payment Link Asaas válido do
  mesmo plano** → ao pagar, o webhook `PAYMENT_RECEIVED` ativa o contrato.
- [ ] **Sem carteira Asaas (cobrança manual):** mesmo fluxo, sem checkbox de link;
  a mensagem é enviada sem link e nada é cobrado automaticamente.
- [ ] Rascunho nunca inventa valor/data; sem contexto → `confidence:"low"` + aviso.
- [ ] Rascunho descartado **não** cria contrato `pending` (link só no envio).
- [ ] Cada geração grava `assistant_llm_usage` com `trainer_id` e `feature='winback_draft'`.
- [ ] Endpoint rejeita aluno/plano de outro treinador (403/404) e respeita rate-limit.
- [ ] Sem novos erros de TypeScript; "Vender plano"/"Arquivar" intactos.

### Arquivos a tocar

**Criar:**
- `web/src/app/api/assistant/winback-draft/route.ts` — endpoint.
- `web/src/lib/assistant/winback-prompt.ts` — system prompt + bloco de contexto +
  parser (pode reusar `parseDraftOutput` de `draft-prompt.ts`).
- `web/src/components/dashboard/winback-composer.tsx` — UI (espelha o composer
  do retention; adiciona checkbox de link).

**Editar:**
- `web/src/lib/dashboard/get-dashboard-data.ts` — adicionar `planId`+`contractId`
  ao `ExpiredPlanItem` e ao select da query (`:246`, `:431-439`); idem para
  `PendingFinancialItem` se estender a past-due.
- `web/src/components/dashboard/assistant-action-cards.tsx` — botão "Reativar" +
  render do `WinbackComposer`.

**Reusar (sem tocar):** `POST /api/wallet/subscriptions` (link Asaas + contrato),
`createPaymentLink`/`wallet-service`, `sendMessage`, `consumeRateLimit`,
`callLLM`/`callWithRetry`, `assistant_llm_usage`, webhook Asaas
`PAYMENT_RECEIVED`.

### Fora de escopo (fases futuras)

- Dunning de inadimplência (past-due) automatizado em lote.
- Recriar contrato **manual** com 1 clique (via `createContractCore` + gate
  `confirm=true`) — fica para quando atacarmos cobrança manual.
- Acompanhamento de "quem reativou" / sequência de follow-up.
- Variação de oferta (desconto de retorno) — exigiria criar plano/cupom.
- O loop agêntico das tools no chat in-app.

---

## Fase 3 — Riscos e bloqueios

- **Dado pessoal → OpenAI (LGPD):** o winback usa nome + plano + datas (dados
  pessoais, porém **não** [S] de saúde — sensibilidade menor que o retention).
  Mesmo gate de DPA/zero-retention da OpenAI vale; o conteúdo é menos sensível.
  Mitigação: enviar só o mínimo (plano, datas, tempo de casa).
- **Contrato `pending_payment` órfão:** mitigado por gerar o link só no envio.
  Se o aluno nunca pagar, fica um `pending_payment` — idêntico ao fluxo
  "Vender plano"/wallet atual (aceitável).
- **Recorrência só no cartão:** o Payment Link recorrente Asaas é `CREDIT_CARD`
  (`route.ts:47-50`); PIX/boleto não auto-debitam. O winback assume renovação
  recorrente no cartão — coerente com o produto atual.
- **Carteira Asaas não aprovada / cobrança manual:** o fluxo degrada para
  "mensagem sem link" sem quebrar; `can_attach_link=false` comunica isso.
- **Dois providers no código:** Asaas (vivo) e Stripe (legado). A spec usa Asaas;
  se um dia coexistirem treinadores nos dois, detectar o provider ativo antes de
  escolher o gerador de link (`/api/wallet/subscriptions` vs. Stripe).
- **Sem `insight_id`:** o card é derivado do dashboard, não some sozinho ao
  enviar; só limpa quando o contrato reativa. Aceitável no MVP (não marcamos
  "tratado"); avaliar um estado "winback enviado" local se incomodar.
- **Premissas/incertezas:** (a) `start_date`/`created_at` do contrato bastam para
  "tempo de casa" — confirmar na implementação; (b) o select da query de expirados
  precisa incluir `plan_id` (hoje só puxa `trainer_plans(title)`); (c) rate-limit
  10/min é chute — calibrar.

## Referências
- Padrão e infra reutilizados: loop de retenção
  (`/api/assistant/draft-message`, `draft-prompt.ts`, `DraftMessageComposer`,
  `assistant_llm_usage`), `POST /api/wallet/subscriptions` (link Asaas +
  contrato), `lib/asaas/payment-links.ts` + `wallet-service.ts`, webhook Asaas
  `PAYMENT_RECEIVED`, auditoria das 55 tools MCP.

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação.)
