# Auditoria noturna das funcionalidades principais — 10→11/jul/2026

> Pedido do Gustavo: auditar as principais funcionalidades priorizando o que os usuários
> mais usam; corrigir o que for fácil; relatar o que merece debate.
> Método: (0) uso real medido em prod → (1) saúde de dados/infra em prod → (2) quatro
> auditorias de código em paralelo nos fluxos top → (3) fixes fáceis no working tree
> (validados, **NÃO commitados**) → (4) este relatório.

## 0. Uso real (30 dias, prod)

| Área | Volume 30d | Atores |
|---|---|---|
| Execução de treino (set_logs) | **2.992 séries** / 134 sessões concluídas | 5 treinadores ativos |
| Assistente IA | 121 mensagens / 34 conversas | — |
| Prescrição (programas criados) | 28 | 7 |
| Formulários (respostas) | 28 | 9 alunos |
| Mensagens | 14 | 7 |
| Financeiro (transações) | 1 | 1 |
| Agenda / Avaliações | **0** | — |

80 alunos ativos, 26 treinadores. Prioridade da auditoria seguiu essa ordem; agenda e
avaliações ficaram de fora (zero uso; avaliações já auditadas em 10/jul pela outra frente).

## 1. Saúde de prod (verificada ao vivo)

- ✅ Smoke E2E read-only em 7 telas de produção logadas (dashboard, alunos, página do
  aluno, sala de treino, forms, financeiro, assistente): todas carregando, zero error
  boundaries. Painel de contexto novo comportando-se correto em prod.
- ✅ Motor do assistente VIVO em prod (turno real respondeu, cobrou, persistiu). A
  "mensagem órfã sem resposta" que parecia bug era o **U-STOP funcionando**: abortei um
  turno ao navegar no meio do QA — user message persiste, LLM cancela, não cobra (design).
- ✅ Cron de insights rodando (última atualização 10/jul 09:05 UTC); push pipeline sem
  erros 7d; scheduled_notifications sem pendências vencidas; auth sem erros 24h; logs de
  runtime Vercel sem erros; advisors Supabase **sem nenhum ERROR** (WARNs em §5).
- ⚠️ **12 workout_sessions travadas `in_progress`** (1–2/semana desde maio) — abandonos
  sem limpeza server-side (ver achado T1).
- ⚠️ 19 wearable_connections em erro — JÁ CONHECIDO (auditoria Saúde do aluno 07/jul, tem
  plano de 3 fases próprio; não retrabalhado aqui).

## 2. Fixes aplicados esta noite (working tree, validados, aguardando seu teste + push)

Validação: web `tsc` 0 / **vitest 1414 passed, 0 failed** / lint sem erros novos; mobile
`tsc` 0 / **374 testes passed**. Nada commitado (workflow).

| # | Área | Fix | Arquivo |
|---|---|---|---|
| F1 | Treino mobile | **FINISH offline nunca mais expira**: ops terminais (finish/discard) isentas do TTL de 24h da fila offline — antes, finalizar sem rede e reconectar >24h depois descartava o treino silenciosamente (aluno via "concluído", sessão ficava órfã). Replay é seguro (idempotente + guardado por `status='in_progress'`). | `mobile/lib/pendingSetLogQueue.ts` |
| F2 | Treino mobile | Set fantasma no marcar→desmarcar rápido: `deletePersistedSetLog` agora lê o id via ref e espera criação de sessão em voo (fecha a metade dominante da janela; resíduo raro em T6). | `mobile/hooks/useWorkoutSession.ts` |
| F3 | Sala de Treino web | Finish com **compensação**: se o insert das séries falha, a sessão 'completed' recém-criada é removida — antes ficava um fantasma com 0 séries E o retry criava uma SEGUNDA sessão (histórico duplicado). | `web/src/actions/training-room/finish-training-room-workout.ts` |
| F4 | Sala de Treino web | Refresh não descarta mais série JÁ CONCLUÍDA quando o editor reduz o nº de séries do exercício (4→3 apagava a 4ª executada da tela). | `web/src/stores/training-room-store.ts` |
| F5 | Financeiro | **mark-paid do MOBILE roteado pelo `markAsPaidCore`** — o endpoint Bearer tinha reimplementação própria SEM a idempotência da migration 220 (retry = transação duplicada + período avançado 2×) e SEM a guarda de `asaas_auto_recurring` (cobrança dupla no cartão do aluno). Agora é o mesmo caminho da action web/MCP. | `web/src/app/api/financial/mark-paid/route.ts` |
| F6 | Push | Aritmética do cleanup de tickets: `7*24*60*1000` = **2,8 horas** — corrigido para 7 dias de verdade. | `web/src/app/api/cron/check-push-receipts/route.ts` |
| F7 | Mensagens web | Upload de imagem órfão removido do bucket quando o INSERT da mensagem falha. | `web/src/app/messages/actions.ts` |
| F8 | Mensagens mobile | Idem no envio de imagem do aluno. | `mobile/hooks/useTrainerChat.ts` |
| F9 | Forms mobile | Pergunta de FOTO obrigatória agora passa na validação local (`files` não era considerado; a RPC já validava certo). Preventivo — 0 perguntas photo-required em prod hoje. | `mobile/components/forms/FormRenderer.tsx` |

## 3. Para debater (encontrado e NÃO corrigido — decisão sua ou fix arriscado)

### Treino (fluxo nº 1 em uso)
- **T1 — Sessões órfãs sem limpeza server-side (ALTA)**: a limpeza de sessões `in_progress`
  abandonadas só roda no boot do app iOS do próprio aluno (`cleanupStaleSessions` vive no
  WatchBridge, iOS-only). Android/aluno sumido/troca de aparelho = órfã eterna (as 12 em
  prod). Proposta: cron server-side (pg_cron ou Vercel cron) marcando `abandoned` sessões
  `in_progress` com >48h e sem set_log recente + one-off para as 12 atuais. Decisão: janela
  e critério (não quero abandonar sessão de treino longo legítimo).
- **T2 — Finish da Sala web não é transacional**: F3 mitigou com compensação, mas o
  definitivo é um RPC transacional (sessão+séries num commit), como o mobile-Watch já tem.
- **T3 — Sala web vive 100% em localStorage até o Concluir**: crash/aba fechada/troca de
  máquina no meio = treino do treinador perdido. Arquitetural (persistência incremental
  como o mobile faz). Vale priorizar?
- **T4 — Duplicação entre superfícies**: aluno registrando no celular + treinador na Sala
  do mesmo treino = 2 sessões (1 completed + 1 órfã). Precisa regra de produto (a Sala
  deveria reatar a sessão `in_progress` do aluno?).
- T6 (resíduo) — janela residual do set fantasma (upsert tardio pós-delete na mesma
  corrida); raríssimo, exige sequenciamento por série.

### Financeiro (baixo volume, mas é dinheiro)
- **FIN1 — Webhook Stripe Connect pode duplicar receita em retry**: `handlePaymentSucceeded`
  faz INSERT cego de transação (`inv_<invoice>`) sem unique em `stripe_invoice_id`; se algo
  falha DEPOIS do insert, o Stripe reentrega e duplica. Fix pronto para aplicar quando
  autorizar: unique index em `stripe_invoice_id` (migration) + upsert. Não fiz à noite por
  ser path de dinheiro + migration.
- **FIN2 — Cron de bloqueio por inadimplência NÃO está versionado**: `block_overdue_students()`
  só é agendada por um job manual em prod (o `cron.schedule` está num comentário da
  migration 140). Se o job manual sumir, o bloqueio para silenciosamente (vazamento de
  receita). Fix fácil quando autorizar: migration com o `cron.schedule`.
- **FIN3 — Gate bloqueia aluno Asaas NA HORA do vencimento, ignorando carência** (P11c):
  `check_student_access` passo 7 nega `past_due`+`block_on_fail` sem grace; `block_on_fail`
  defaulta TRUE (a migration 029 que tentava FALSE virou no-op). Cartão em retentativa =
  aluno pagante bloqueado. Decisão de produto: carência unificada no gate.
- **FIN4 — Sem reconciliação para renovação perdida**: contrato Asaas/Stripe `active` com
  `current_period_end` vencido e webhook perdido fica ativo para sempre (classe do
  incidente de abril). Proposta: sweep marcando `past_due` com salvaguardas.
- FIN5 — Carência hardcoded 3d para manuais diverge do `overdue_grace_days` configurável (P11a).

### Mensagens/push
- **M1 — Push duplicado (race)**: rota insere notificação (trigger→edge function envia) E
  chama envio direto — dedup por `push_sent_at` é check-then-act sem lock; sob latência,
  2 pushes idênticos. Fix estrutural: claim atômico como a migration 205, ou matar um dos
  caminhos.
- **M2 — Badge de não-lidas do header infla** (incrementa em INSERT mas não reconcilia se
  a conversa está aberta/já lida; só zera em reload).
- **M3 — Thread aberta não re-busca ao voltar do background** (mobile): realtime não
  reentrega o que perdeu offline; badge atualiza, thread não. Precisa resync em AppState.
- M4 — `sendStudentPush` sem o pré-check de dedup que o lado trainer tem (assimetria que
  amplia M1 no sentido treinador→aluno).

### Forms/avaliações (frente de ontem — review de regressão dos 12 commits)
- Veredito geral: **sólido** — contratos web↔mobile↔RPC batem, cron ancorado sem drift,
  detecção de insights de check-in corrigida de verdade. 3 ressalvas menores:
  - FO1 — validação single_choice rejeitaria array de opções MISTO string+objeto (hoje **0
    templates mistos em prod** — teórico; alinhar na próxima mexida na RPC).
  - FO2 — dedup idempotente do save de avaliação não remove attempts órfãos quando a
    re-medição manda MENOS tentativas (raro; `assessment_measurements`=0 em prod).
  - FO3 — auto-commit numérico da captura grava valor fora-de-faixa sem a confirmação que
    o aviso âmbar promete (UX; decidir gate duro vs aviso).
  - Verifiquei em prod: a RPC `submit_form_submission` já validava `files`/`scale` antes
    das migrations 238/239 — sem risco de rejeição de dados antigos.

### Higiene/segurança (advisors Supabase — nenhum ERROR)
- Ativar **leaked password protection** no Auth (toggle no dashboard; recomendo).
- Buckets `exercise-library-videos` e `public-assets` permitem LISTAGEM pública (conteúdo é
  público por design; listagem é opcional — fechar?).
- 24 funções SECURITY DEFINER executáveis por `anon` — maioria triggers/helpers inócuos
  (retornam null sem auth), mas vale um passe dedicado; `create_trainer_self_student` é a
  que eu olharia primeiro.
- `rls_policy_always_true` em `android_tester_queue`/`curso_waitlist` = formulários públicos
  intencionais; tabelas com RLS sem policy = service-role-only correto.

## 4. O que está comprovadamente sólido (destaques dos auditores)

- **Treino mobile**: persistência série-a-série + snapshot MMKV + fila offline durável com
  dedup + descarte atômico + finish do Watch idempotente + dedup de criação de sessão +
  supersets/métodos compostos sem colisão de upsert. O núcleo do fluxo nº 1 está bem
  protegido no telefone.
- **Webhooks financeiros**: idempotência insert-first nos 3 webhooks; Asaas PAYMENT_RECEIVED
  reprocessável com segurança; anti-forja forte (re-busca autoritativa); `markAsPaidCore`
  e cancelamento bem feitos.
- **Mensagens**: dedup de mensagens em todos os clients; falha de envio não perde conteúdo;
  signed URLs regeneradas por mount; limpeza de tokens inválidos em 3 pontos.
- **Forms**: os 12 commits de ontem passam no review de regressão; cron de schedules agora
  é à prova de drift e de desativação indevida.

## 5. Rodada de decisões (manhã 11/jul — autorizada pelo Gustavo)

**Diretriz persistida: o treinador gera planos/cobranças de aluno VIA ASAAS, não Stripe.**
Consequência: FIN1 (webhook Stripe Connect) SAI da lista — trilho morto desde 24/02 (zero
contratos; decisão pendente é aposentá-lo, não consertá-lo). Prioridade recaiu em FIN2,
FIN3 e T1, todos EXECUTADOS e APLICADOS EM PROD:

1. **FIN2 → migração 241** (`schedule_block_overdue_students`): o cron de bloqueio por
   inadimplência agora está VERSIONADO (`cron.schedule` idempotente sobre o job manual
   `block-overdue-students-daily`, 06:00 UTC). Não some mais em restore/recriação.
2. **FIN3/P11 → migração 242** (`gate_respects_overdue_grace`): `check_student_access`
   agora respeita a carência (`overdue_grace_days`, fallback 3d) e o opt-in do treinador
   (`block_on_overdue`, fallback no `block_on_fail` do contrato) TANTO no passo 7
   (past_due — antes bloqueava NA HORA do vencimento) quanto no passo 6 (manual ativo
   vencido — antes carência hardcoded 3d). Sem `current_period_end` não bloqueia (critério
   do cron). Aplicada com impacto imediato ZERO (0 past_due / 0 bloqueados em prod);
   autorização do caller verificada intacta pós-migração.
3. **T1 → migração 243** (`abandon_stale_workout_sessions`): cron diário 06:30 UTC marca
   `abandoned` sessões `in_progress` >48h (set_logs preservados; EXECUTE revogado de
   anon/authenticated). Primeira execução varre as 12 órfãs históricas.
   **Complemento mobile (working tree):** o drain do finish offline agora aceita
   `in_progress` OU `abandoned` — finalizar offline e reconectar dias depois RECUPERA a
   sessão que o cron abandonou (compatível com F1; descarte intencional segue protegido
   porque limpa a fila localmente; `completed` nunca é tocado). Testes: +1 novo
   ("finish nunca expira"), mobile 375/375 verde.

Continuam em aberto para debate: FIN4 (sweep de renovação perdida — encaixar no redesenho
P9 da máquina de renovação PIX), M1–M4 (push duplicado/badge/resync — estruturais), T2–T4
(finish transacional, Sala persistente, duplicação entre superfícies), FO1–FO3.

## 6. Custos/resíduos da auditoria

- 2 créditos de IA usados em turnos de teste (1 ontem no QA + 1 esta noite provando o motor);
  conversa de QA arquivada. Nota de QA em aluno criada e removida. Nenhum dado residual.
- Working tree: 9 arquivos alterados (fixes F1–F9), nada commitado.
