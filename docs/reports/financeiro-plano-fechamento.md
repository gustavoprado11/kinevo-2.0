# Plano de fechamento — Módulo Financeiro

> **Versão:** 1.0 — 18/05/2026
> **Objetivo:** levar o módulo Financeiro de "funcionando no web" a "pronto pra beta com trainers reais" e depois "pronto pra produção em escala".
> **Estado atual:** Sprints 1A–2H concluídas. Web 100% funcional, polish aplicado, QA visual fechado.

---

## Mapa geral

```
┌──────────────────────────────────────────────────────────────┐
│  FASE 1: Pré-beta blockers (mobile + limpeza)                │
│  ├─ Sprint 3: Mobile Trainer (replicar web no app)           │
│  ├─ Sprint 4: Mobile Aluno (gate inadimplência + pagar)      │
│  └─ Sprint 5: Cobertura completa de webhooks                 │
├──────────────────────────────────────────────────────────────┤
│  FASE 2: Refinos web + verificação                           │
│  ├─ Sprint 6: Refinos web pendentes                          │
│  └─ Sprint 7: Limpeza + smoke test E2E                       │
├──────────────────────────────────────────────────────────────┤
│  FASE 3: Operacional (não-código)                            │
│  └─ Sprint 8: Docs + T&C + suporte                           │
├──────────────────────────────────────────────────────────────┤
│  FASE 4: Beta launch                                         │
│  └─ Sprint 9: Convidar trainers + monitorar                  │
├──────────────────────────────────────────────────────────────┤
│  FASE 5: Pós-beta polish (opcional)                          │
│  └─ Sprint 10+: Transações, saque agendado, IRPF, etc        │
└──────────────────────────────────────────────────────────────┘
```

**Caminho crítico pra beta beta:** Sprint 3 + 4 + 7 + 8 + 9.
Sprints 5 e 6 podem entrar com beta rodando.

---

# FASE 1 — Pré-beta blockers

## Sprint 3 — Mobile Trainer (replicar Carteira no app Expo)

**Objetivo:** trainer consegue fazer tudo que faz no web pelo app mobile.

**Por quê é blocker:** trainers em campo (entre clientes) precisam cobrar, ver saldo e sacar pelo celular. Web-only inviabiliza uso real.

**Requer:** sessão dedicada com acesso ao repo `mobile/` (Expo/React Native).

### Subtasks

| # | Tela / feature | Escopo | Critério de aceitação |
|---|---|---|---|
| 3A | Tela Carteira (saldo + ações) | `mobile/app/(trainer)/financial/carteira.tsx` — hero com saldo, badge status, botões Cobrar/Sacar | Saldo carrega via API existente `/api/wallet/balance`; pull-to-refresh atualiza; navegação Voltar funciona |
| 3B | Wizard ativação Carteira | 3 telas: dados pessoais → endereço → faturamento. Reusa endpoint `/api/wallet/activate` | Trainer sem carteira ativa vê CTA "Ativar Carteira"; ativação chama API e atualiza estado |
| 3C | Vinculação Asaas existente | Tela com 2 inputs (apiKey + walletId) + tutorial inline igual web | Trainer cola chave Asaas, vincula via `/api/wallet/link`, vê confirmação |
| 3D | Modal Cobrar aluno | Sheet bottom (mobile-native) com aluno/plano/avulsa/recorrente. Reusa `/api/wallet/charges` e `/api/wallet/subscriptions` | Trainer cobra e recebe invoiceUrl pra compartilhar via share-sheet nativo |
| 3E | Saque PIX mobile | Selecionar chave, valor, confirmar. Reusa `/api/wallet/payouts` | Confirma com biometria (FaceID/TouchID) antes de enviar |
| 3F | Gestão de chaves PIX | CRUD: listar, adicionar, definir padrão, remover. Reusa `/api/wallet/pix-keys` | Validação ao vivo igual web (check verde/X vermelho) |
| 3G | Configurações financeiras | Replica `/financial/settings` web — toggles + slider de inadimplência. Reusa `/api/financial/settings` | Auto-save com loader + check verde por toggle |
| 3H | Push notifications setup | Garantir que o app registra `expo_push_token` na tabela `push_tokens` com `role='trainer'` (deve já existir) | Trainer recebe push quando webhook dispara `notifyFinancial` |

**Estimativa:** sprint de 3-4 dias intensivos no mobile.

**Riscos:**
- Token Asaas armazenado em SecureStore mobile (não AsyncStorage, dado sensível)
- iOS App Store policy sobre payments — Carteira pode ser flagada como "externa". Pesquisar antes de submeter pra revisão.

---

## Sprint 4 — Mobile Aluno (gate de inadimplência + pagar in-app)

**Objetivo:** o backend já bloqueia inadimplentes (cron + `access_blocked_at`), mas o app do aluno **não checa essa coluna ainda** — aluno bloqueado continua treinando. Sem essa sprint, a feature de inadimplência **não tem efeito real**.

### Subtasks

| # | Feature | Escopo | Critério de aceitação |
|---|---|---|---|
| 4A | Gate de acesso (middleware) | Antes de fetchar workout/program, ler `students.access_blocked_at`. Se != null, redirect pra tela bloqueio | Aluno bloqueado **não** consegue abrir treino do dia |
| 4B | Tela "Pagamento pendente" | Componente com mensagem clara + nome do trainer + botão "Falar com treinador" (abre WhatsApp) | UI bonita, não punitiva; explica que assim que pagar volta automaticamente |
| 4C | Push do invoice pro aluno | Quando trainer gera cobrança via Carteira, dispara push pro aluno com link de pagamento | Aluno recebe notificação "Sua mensalidade tá disponível: clique pra pagar" |
| 4D | Tela QR PIX + copia código | Em vez de WebView, renderizar QR code nativo e botão "Copiar código PIX" | Aluno paga sem sair do app; UX igual Nubank |
| 4E | WebView de fallback | Pra cartão de crédito (não dá pra renderizar form nativo por compliance), WebView do checkout Asaas | WebView com title bar custom; back button volta pro app |
| 4F | Histórico de pagamentos | Tela "Meus pagamentos" com últimas 12 transações | Aluno vê o que pagou, quando, e baixa o recibo da Asaas |
| 4G | Confirmação visual de pagamento | Após webhook PAYMENT_RECEIVED, push pro aluno "Pagamento recebido ✓"; opcionalmente mostrar confetti na próxima abertura do app | Aluno fica seguro de que pagou |

**Estimativa:** 3-4 dias mobile.

**Riscos:**
- Compliance Apple/Google sobre cobranças in-app (essa é cobrança P2P trainer→aluno, não compra digital — deveria estar OK, mas confirmar)
- Aluno pode ter o app cacheado com workout antes do bloqueio — limpar cache na ativação do gate

---

## Sprint 5 — Cobertura completa de webhooks Asaas

**Objetivo:** trainer recebe notificação de **todos** os eventos importantes da Carteira, não só pagamento recebido.

**Por quê não é hard blocker pro beta:** trainer ainda consegue ver o que aconteceu acessando o app, só fica menos proativo. Mas é fortemente recomendado.

### Subtasks

| # | Evento Asaas | O que falta hoje | Implementar |
|---|---|---|---|
| 5A | `PAYMENT_OVERDUE` | Atualiza contrato pra past_due mas não notifica | Push pro trainer "Maria atrasou a mensalidade — entre em contato" |
| 5B | `PAYMENT_REFUNDED` / `PAYMENT_DELETED` | Atualiza status mas não notifica | Push "Reembolso processado: R$ X devolvidos pro aluno Y" |
| 5C | `TRANSFER_FAILED` / `TRANSFER_CANCELLED` | Marca payout falhou mas trainer fica sem saber | Push crítico "Seu saque de R$ X falhou — motivo: ..." |
| 5D | `TRANSFER_IN_BANK_PROCESSING` | Marca status processing | (Não notifica — barulho desnecessário) |
| 5E | `PAYMENT_CHARGEBACK_REQUESTED` | **Sem handler ainda** | Criar handler + push urgente "Chargeback iniciado por X — responda em N dias" |
| 5F | `PAYMENT_CHARGEBACK_DISPUTE` | Sem handler | Push + UI mostrando prazo de resposta |
| 5G | `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` | Sem handler | Push "Chargeback contestado com sucesso" |
| 5H | `DUNNING_REQUESTED` / `DUNNING_RECEIVED` | Sem handler | Push "Asaas iniciou cobrança automática do aluno X" |

**Implementação:**
- Adicionar branches no switch de `web/src/app/api/webhooks/asaas/route.ts`
- Cada handler chama `notifyFinancial` com o `event` apropriado
- Estender `FinancialEventType` em `lib/financial/notify.ts` com novos tipos
- Adicionar toggles correspondentes em `trainer_financial_settings` (migration 142)

**Estimativa:** 1 dia web.

---

# FASE 2 — Refinos web + verificação

## Sprint 6 — Refinos web pendentes

| # | Refino | Onde | Esforço |
|---|---|---|---|
| 6A | Hero da `/financial/wallet` com dropdown "Cobrar aluno" | `wallet-client.tsx` — replicar dropdown da home | 30min |
| 6B | `student-financial-modal.tsx` mostrar bloqueio + botão Desbloquear | Reusar lógica de `unblockStudent` da home | 1h |
| 6C | Verificar fluxo KYC UI completo (upload documentos) | Testar com trainer subaccount em status PENDING; ver se a lista de docs renderiza | 1h teste + ajustes |
| 6D | Página `/financial/transactions` completa (extrato) | Nova page com filtros, paginação, export CSV. Reusa `financial_transactions` | 3-4h |
| 6E | Migrar contratos Stripe legados pra Asaas (script ou UI) | Verificar se há trainers com contratos Stripe ativos; se sim, criar wizard de migração | Investigar primeiro |

**Estimativa total:** 5-6h.

---

## Sprint 7 — Limpeza + smoke test E2E pré-beta

| # | Item | Comando / passo |
|---|---|---|
| 7A | Apagar trainer de teste do banco | SQL via Supabase MCP: `DELETE FROM trainers WHERE email LIKE 'teste-asaas%'` (ajustar pattern) |
| 7B | Cancelar/excluir subconta Asaas do trainer teste | Via painel Asaas — não tem endpoint público |
| 7C | Build de produção | `cd web && npm run build` — zero erros |
| 7D | Confirmar envs Vercel | `ASAAS_ENV=production`, `ASAAS_MAIN_API_KEY`, `ASAAS_ENCRYPTION_KEY`, `ASAAS_WEBHOOK_TOKEN` setados |
| 7E | Smoke test E2E manual | Roteiro abaixo |

### Roteiro do smoke test (Sprint 7E)

1. Criar trainer novo (não-teste) numa conta limpa
2. Ativar Carteira pelo wizard de subconta — preencher dados reais
3. Aguardar aprovação (ou simular via execute_sql atualizando status pra approved)
4. Criar plano "Mensal R$ 50" com PIX+Cartão
5. Cadastrar aluno fictício
6. Criar assinatura recorrente do aluno nesse plano
7. Pagar a fatura (usar conta Asaas sandbox ou cartão real)
8. Confirmar que webhook chegou → status mudou pra "active" → push chegou no trainer
9. Após 4 dias (ou simular via SQL antecipando current_period_end), confirmar que cron marca como overdue + bloqueia acesso
10. Aluno paga novamente → confirma que cron auto-desbloqueia
11. Trainer cadastra chave PIX
12. Trainer faz saque do saldo
13. Confirma que saque cai e push chega

**Estimativa total Sprint 7:** 3-4h (2h preparação + 2h smoke test).

---

# FASE 3 — Operacional (não-código)

## Sprint 8 — Documentação + T&C + suporte

### 8A — Documentação pro trainer (1-2 páginas PT-BR)

Estrutura sugerida:

1. **O que é a Carteira Kinevo** — 1 parágrafo, mencionar parceria Asaas
2. **Como ativar** — 2 caminhos: criar nova (3 passos) ou vincular Asaas existente (chave + Wallet ID, com onde achar)
3. **Taxas** — tabela atualizada (PIX 1,99% + R$ 0,40; Cartão 2,99% + R$ 0,49; Boleto R$ 1,99)
4. **Prazos de liberação** — PIX 1 dia útil; Cartão 30 dias à vista
5. **Como cobrar um aluno** — fluxo dropdown
6. **O que aparece no extrato do aluno** — "PG ASAAS [seu nome]"
7. **Como sacar** — chave PIX + valor + confirmar
8. **Inadimplência** — período de tolerância + bloqueio automático opcional
9. **Como contestar uma cobrança suspeita** — falar com suporte da Asaas direto

**Formato:** página Notion pública OU PDF do site OU seção em `/help`.

### 8B — Adendo T&C + LGPD

- Que dados são compartilhados com a Asaas (nome, CPF/CNPJ, email, telefone, endereço)
- Retenção: saldo fica na Asaas até saque solicitado pelo trainer
- Política de chargeback: trainer responde via Asaas, Kinevo só intermedia
- Política de bloqueio: Asaas pode bloquear conta por compliance (lavagem, fraude)
- Kinevo não tem acesso ao dinheiro — passa direto Asaas → trainer

Precisa: jurídico revisar. Pode usar template do Asaas como base.

### 8C — Templates de suporte (3-5 cenários)

Casos comuns esperados:
- "Chave Asaas inválida ao vincular" — script de troubleshoot
- "Saldo não bateu com o esperado" — explicar taxa + take rate Kinevo (que é 0% hoje)
- "Aluno reclamou de cobrança duplicada" — investigar via Asaas, possível refund
- "Como mudar conta bancária do saque" — gestão de chaves PIX
- "Aluno disse que pagou mas status tá pendente" — webhook talvez não chegou, manual sync

**Estimativa total Sprint 8:** 1-2 dias trabalho de redação + revisão.

---

# FASE 4 — Beta launch

## Sprint 9 — Convidar trainers reais + monitorar

| # | Item | Esforço |
|---|---|---|
| 9A | Selecionar 2-3 trainers conhecidos pra beta | 1h conversa cada |
| 9B | Sessão de onboarding 1:1 (30min cada) | 1h30 total |
| 9C | Criar canal de feedback (grupo WhatsApp ou Discord) | 15min |
| 9D | Monitorar primeira semana — checar logs do Vercel diariamente | 30min/dia × 7 dias |
| 9E | Iterar baseado em feedback — sprints curtos (1-2h cada) durante essa fase | Variável |
| 9F | Após 2 semanas: decidir se libera pra base toda OU itera mais | — |

**Métricas pra acompanhar:**
- # de carteiras ativadas
- # de cobranças geradas / pagas
- # de saques realizados
- Tempo médio entre cobrança e pagamento
- Taxa de chargeback (deve ser 0% no início)
- Erros nos logs (filtros: `[wallet/`, `[asaas-webhook]`, `[financial/`)

---

# FASE 5 — Pós-beta polish (opcional)

## Sprint 10+ — Features que vão entrar conforme demanda

- **Saque agendado**: "todo dia 5 do mês, sacar todo saldo disponível pra chave padrão"
- **Relatórios pra DARF/IRPF**: export CSV com formato Receita
- **Multi-moeda**: USD pra trainers atendendo gringos (requer outro gateway, Asaas só BRL)
- **Dashboard churn/MRR sofisticado**: gráficos, tendências, comparação mês a mês
- **Cupons de desconto**: trainer cria "BLACKFRIDAY10%" e aplica no checkout
- **Adicionais por aluno**: cobrar extra por sessão presencial além da mensalidade
- **Split com Kinevo**: ativar take rate (hoje 0%) — code já suporta via `KINEVO_TAKE_RATE_PCT`

---

# Checklist de execução

## Pra beta funcional completo

- [ ] Sprint 3: Mobile Trainer (8 subtasks)
- [ ] Sprint 4: Mobile Aluno (7 subtasks)
- [ ] Sprint 5: Webhooks cobertura completa (8 subtasks)
- [ ] Sprint 7: Limpeza + smoke test E2E
- [ ] Sprint 8: Docs + T&C + suporte
- [ ] Sprint 9: Beta launch

## Pra beta minimalista (web-only, com limitações)

- [ ] Sprint 6: Refinos web (5 subtasks)
- [ ] Sprint 7: Limpeza + smoke test E2E
- [ ] Sprint 8A: Doc rápida pro trainer (só essencial)
- [ ] Sprint 9: Beta launch com 1-2 trainers + restrições documentadas

## Pra produção em escala

- [ ] Todos acima
- [ ] Sprint 10+: features pós-beta conforme demanda

---

# Decisões em aberto

1. **Beta web-only OU completo (web + mobile)?**
   - Web-only: vai mais rápido (~1 semana) mas trainer não consegue cobrar em campo + aluno não tem gate de inadimplência efetivo
   - Completo: ~3-4 semanas de mobile mas beta tem todas as features
   - **Recomendação:** beta web-only primeiro pra validar UX do trainer; mobile entra pra GA público

2. **Kinevo cobra take rate ou continua 0%?**
   - Hoje 0% — código suporta via env var
   - Take rate ajuda monetizar mas pode espantar trainers vs concorrência
   - **Recomendação:** beta com 0%, decidir após validar adoção

3. **Boleto entra como opção ativa por padrão ou fica desligado?**
   - Hoje toggle ligado em settings + UI no modal de plano
   - Mas o fluxo end-to-end de gerar boleto e webhook handler precisam ser testados
   - **Recomendação:** testar no smoke test (Sprint 7E); se OK, manter ligado

4. **Suporte oficial via WhatsApp Business OU email?**
   - WhatsApp: mais imediato pra trainer; mais caro de manter
   - Email: paciência, async, escalável
   - **Recomendação:** email pra suporte oficial + WhatsApp pra beta-testers

---

# Apêndice — Arquivos críticos por sprint

### Sprint 3 (Mobile Trainer)
- `mobile/app/(trainer)/financial/*.tsx` (criar — várias telas)
- `mobile/components/financial/*.tsx`
- `mobile/lib/api.ts` (já deve existir — endpoints já estão no web)

### Sprint 4 (Mobile Aluno)
- `mobile/app/(student)/index.tsx` (gate middleware)
- `mobile/app/(student)/access-blocked.tsx` (nova tela)
- `mobile/app/(student)/payments/*.tsx`

### Sprint 5 (Webhooks)
- `web/src/app/api/webhooks/asaas/route.ts`
- `web/src/lib/financial/notify.ts` (estender FinancialEventType)
- `supabase/migrations/142_extra_notify_toggles.sql` (novos toggles)

### Sprint 6 (Refinos web)
- `web/src/app/financial/wallet/wallet-client.tsx`
- `web/src/components/financial/student-financial-modal.tsx`
- `web/src/app/financial/transactions/page.tsx` (criar)

### Sprint 7 (Pré-beta)
- Sem arquivos novos — só execução/validação

### Sprint 8 (Operacional)
- `docs/trainer/carteira-kinevo.md` (criar)
- Termos atualizados pelo jurídico

### Sprint 9 (Beta)
- Sem arquivos — só processo

---

**Fim do documento.**
