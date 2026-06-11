# 07 — Oportunidades e Diferenciais (Fase 3 da análise noturna, 09/06/2026)

Derivado dos relatórios 01–06 desta análise, do inventário de roadmap (`docs/` e `_planning/`) e de verificação direta no código. Nada aqui repete o que o roadmap já cobre sem agregar criticamente.

---

## 1. Quick wins (< 1 dia cada)

Ordenados por impacto/esforço. Os seis primeiros formam um "dia de higiene" que elimina os riscos mais baratos de todo o relatório.

| # | O que | Onde | Impacto | Esforço |
|---|-------|------|---------|---------|
| QW-1 | `npm audit fix` do `next` (CVEs de bypass de middleware — a auth do web DEPENDE do middleware) + `fast-uri` | `web/package.json` | Fecha S-A1/S-A2, os 2 achados ALTOS de segurança; fix não-breaking já verificado pelo analista | 1h (rodar fix + smoke test login/landing) |
| QW-2 | Secret na edge function de push: exigir header compartilhado em `send-push-notification` e enviá-lo no trigger | `supabase/functions/send-push-notification/index.ts:20-36` + migration do trigger 098 | Fecha B-C2 (hoje qualquer POST anônimo spamma push para qualquer usuário do app) | 3-4h (código + migration + redeploy + teste) |
| QW-3 | Consertar os 5 testes red (4× SetSchemeTable desatualizado + 1 typecheck) e adicionar CI mínimo (GitHub Actions: lint + typecheck + vitest no push) | `web/src/components/**/set-scheme-table*` + `.github/workflows/` (não existe) | Fecha Q-A2: testes vermelhos há ~6 semanas sem ninguém notar; sem CI todo o resto da suíte é decorativo | 4-6h |
| QW-4 | Corrigir os 3 rules-of-hooks (useState após early return) | `web/src/.../wallet-client.tsx:927`, `form-submissions-card.tsx:68,71` | Fecha Q-A3/F-01: crash real no saque PIX (dinheiro do treinador) e no card de prescrição | 1-2h |
| QW-5 | `global-error.tsx` + `error.tsx` raiz no app web | `web/src/app/` (hoje ZERO error boundaries) | Qualquer throw em produção hoje = tela branca do Next; com financeiro em GA isso é inaceitável | 2h |
| QW-6 | Dedupe do webhook Asaas por `paymentId` em `contract_events('payment_received')` (constraint única + upsert) | `web/src/app/api/webhooks/asaas/route.ts:142-220` | Elimina race de eventos concorrentes duplicando registro de pagamento — bug financeiro silencioso | 2-3h |
| QW-7 | Índices nas 5-6 FKs mais quentes (`workout_sessions.assigned_program_id`, `messages.sender_id`, `student_contracts.plan_id`, `perfect_weeks.*`, `scheduled_notifications.*`) | migration nova (`supabase/migrations/180_*`) | As tabelas de maior crescimento (sessões, mensagens) fazem seq scan em joins frequentes; barato agora, caro depois | 2h |
| QW-8 | Hero da landing pública: `<img>` cru → `next/image` com `priority` | `web/src/app/com/[slug]/page.tsx:241` | Causa provável do LCP 6.08s na página que VENDE o personal (e há plano de GEO ativo nela) | 1-2h |
| QW-9 | `loading.tsx` nas 9 rotas que faltam (financial, schedule, exercises, forms, marketing, settings, training-room, avaliacoes, messages) | `web/src/app/*/` | Percepção de performance em todas as áreas pesadas do painel; esforço quase mecânico | 2-3h |
| QW-10 | Remover anon JWT hardcoded em texto puro dos cron jobs Oura (usar Vault/`current_setting`) | `cron.job.command` dos jobs oura 5/6 em prod | Segredo versionado dentro do banco; rotação de chave hoje quebraria os crons silenciosamente | 2h |
| QW-11 | Corrigir config de coverage do shared (hoje mede só assessment-protocols e reporta 99,1% vs 70,9% real) | `shared/vitest.config.*` | Métrica enganosa orienta decisões erradas; 15 min de config | 0,5h |
| QW-12 | Atualizar doc de paridade web↔mobile (parcelamento Asaas 08/06 é 100% web; "Financeiro ✅" está errado) + fix "Maio De 2026" | `docs/paridade-treinador-web-mobile.md`; `mobile/components/.../SessionHeatmap.tsx:309` | Doc vivo desatualizado induz decisão errada de release mobile; o heatmap é bug visível que o doc CORRECOES afirma corrigido | 1h |

Não promovidos a quick win (parecem, mas não são): atomicidade do `assign-program` (B-C3 exige repensar a edge function em transação/RPC — mais de 1 dia); rate limit distribuído (exige Upstash/KV — tratado nos riscos); substituir os 45 `window.alert` (mecânico porém extenso, ~2-3 dias).

---

## 2. Funcionalidades diferenciais

Critério: aproveitar infraestrutura que JÁ existe no código (verificada) e que MFIT, Tecnofit, Hevy Coach e Trainerize não têm ou têm raso. Excluído o que o roadmap já cobre (IA no builder — decisão de 16/abr; vídeos de exercícios; cobertura de push; chat in-app via MCP — ideia documentada do fundador, ver D-5).

### D-1. Painel de prontidão e saúde do aluno no web do treinador — esforço M
- **Problema**: o Kinevo coleta readiness (HealthKit/Oura), FC de treino do Watch e amostras de saúde — mas TUDO morre no mobile do aluno. Verificado: `workout_health_samples` só é consumido por `mobile/hooks/useWorkoutHealthSummary.ts`/`useWorkoutHealthUpload.ts`; zero consumidores em `web/src`. O treinador, que é quem paga, não vê nada disso.
- **Solução**: card "Saúde hoje" na página do aluno e coluna de readiness na lista de alunos do web, lendo as tabelas wearables + `workout_health_samples` já populadas. Alerta no dashboard ("3 alunos com readiness baixo hoje") via `assistant_insights`, que já tem realtime e action cards (`assistant-action-cards.tsx`).
- **Por que é diferencial**: MFIT e Tecnofit não têm wearable nativo; Trainerize integra wearables mas não tem app de Watch próprio nem score de readiness; Hevy Coach é log-first sem camada de saúde. O Kinevo já pagou o custo caro (Watch app, HealthKit, Oura OAuth) — falta só a vitrine para quem decide a renovação da assinatura.

### D-2. Autorregulação: carga do dia ajustada pelo readiness — esforço M
- **Problema**: o aluno chega mal dormido e executa a carga prescrita para um dia bom; ou chega bem e subestimula. Treinador não consegue ajustar 30 alunos diariamente.
- **Solução**: já existem `PreWorkoutReadinessSheet.tsx` + `usePreWorkoutDecision.ts` (decisão pré-treino) e `set_schemes` estruturados com %1RM. Conectar: readiness baixo → sugerir no player redução de % (ex.: −10% nas séries top) ou trocar método (drop-set → straight sets), com aceite em 1 toque e registro no `set_log` do motivo. Regras determinísticas primeiro (sem LLM = custo zero); preferência do treinador em `prescription_preferences` (JSONB já existente em `trainers`).
- **Por que é diferencial**: autorregulação por wearable é discurso de apps de elite (ex.: Juggernaut AI, nicho powerlifting); nenhum concorrente de gestão de personal BR faz. Materializa o pitch "prescrição viva".

### D-3. Substituição inteligente de exercício no player usando o grafo — esforço M
- **Problema**: máquina ocupada/quebrada ou dor no ombro no meio do treino → aluno pula o exercício ou improvisa mal; treinador descobre depois (ou nunca).
- **Solução**: o grafo `exercise_relationships`/`exercise_synergies`/`exercise_condition_constraints` (migrations 070–073) hoje é usado SÓ pela prescrição IA (`web/src/lib/prescription/exercise-graph.ts` — verificado, único consumidor). Expor um RPC `get_substitutes(exercise_id, available_equipment?, condition?)` e um botão "Substituir" no player mobile que respeita relação de equivalência e constraints de lesão, gravando a troca no `set_log` para o treinador revisar.
- **Por que é diferencial**: Hevy tem troca por lista plana de similares; ninguém tem grafo com restrições clínicas. Reaproveita o ativo mais subutilizado do código.

### D-4. Relatório mensal do aluno gerado por IA, com a marca do personal — esforço M
- **Problema**: a renovação do aluno com o personal depende de percepção de progresso; o personal não tem tempo de montar relatório. (Retenção do aluno = retenção do treinador no Kinevo.)
- **Solução**: job mensal (Vercel cron — já há 8) que monta narrativa via `llm-client.ts` (multi-provider, telemetria de custo em `prescription_generations` reutilizável) sobre dados já existentes: tonelagem (`set_logs`), `perfect_weeks`/streaks, aderência ao calendário, evolução de medidas (`assessment_sessions`). Sai como card no inbox do aluno (`student_inbox_items`, realtime) + imagem compartilhável com o branding do personal (infra de branding do reposicionamento R$79,90 já pronta; tabela `program_reports` já existe como base).
- **Por que é diferencial**: MFIT/Tecnofit têm relatórios estáticos de avaliação; ninguém gera narrativa mensal automática white-label. Vira marketing orgânico do personal (aluno posta) E do Kinevo.

### D-5. Fechar o loop de aprendizado da IA como recurso visível ("a IA aprende o SEU método") — esforço P/M
- **Problema**: a IA dos concorrentes (e do mercado) é genérica; o medo do personal é "a IA prescreve diferente de mim".
- **Solução**: o pipeline já existe e está implementado — `capture-post-assignment-edits.ts` grava `trainer_edits_diff` em cada geração e `trainer-patterns.ts` computa padrões (mín. 10 prescrições, janela de 30) injetados no prompt. Falta: (a) tela "O que a IA aprendeu de você" nas settings (lista os patterns detectados, com toggle para aceitar/rejeitar cada um); (b) usar isso no marketing. Agregação ao plano do fundador de chat in-app via MCP: os patterns devem ser injetados também no system prompt da ponte das 27 tools, para o chat prescrever "no estilo" do treinador — o plano atual do chat não menciona isso.
- **Por que é diferencial**: transforma código já escrito em proposta de valor verbalizável; nenhum concorrente tem loop de feedback de edição → prompt.

### D-6. Checkout do aluno direto na landing pública (lead → contrato → PIX sem digitação) — esforço G
- **Problema**: o personal capta o lead na landing, mas o fechamento (criar aluno, criar contrato, mandar cobrança) é manual em 3 telas — atrito onde a venda esfria.
- **Solução**: encadear o que já existe: landing por trainer (`com/[slug]`) → `trainer_leads` → `convert-lead-to-student.ts` (action pronta) → `student_contracts` Asaas com PIX/parcelamento (178). Novo: o personal publica planos na landing (de `trainer_plans`) e o lead escolhe, paga PIX e cai como aluno ativo; criação da conta do aluno reutiliza a edge `create-student`. Gate: só para trainers com `trainer_payment_accounts` KYC-aprovado.
- **Por que é diferencial**: Tecnofit vende para academia (não personal autônomo); MFIT tem venda de consultoria mas com checkout próprio limitado e sem PIX parcelado nativo; Trainerize/Hevy não operam trilho de pagamento BR. Kinevo viraria o único fluxo aquisição→cobrança→treino→retenção 100% integrado para personal BR. Esforço G — mas é a tese de negócio inteira; recomendo constar como "fase 6" do plano financeiro (`docs/financeiro-plano-fechamento.md` para hoje em saque/cobrança e não cobre aquisição).

### D-7. Régua automática de cobrança do aluno (dunning) — esforço P/M
- **Problema**: inadimplência do aluno hoje tem gate punitivo (`access_blocked_at` + RLS 162) mas a cobrança em si é passiva — o personal precisa cobrar pessoalmente (constrangedor, adiado, perdido).
- **Solução**: cron diário (já existe `check-manual-overdue`) que, antes do bloqueio, dispara régua: D-3 lembrete com link PIX por push (`send-push-notification`) + mensagem no chat (`messages`, que o MCP também alcança); D+1 segunda cobrança; D+5 aviso de bloqueio. Tudo com cópia configurável em `trainer_financial_settings`. Zero infra nova.
- **Por que é diferencial**: complementa o gate já construído com o lado "recupera receita sem o personal passar vergonha"; MFIT cobra mas não orquestra régua multicanal dentro do chat do treino.

---

## 3. Riscos estratégicos

Dívidas que, mantidas, travam crescimento. Ordenadas por urgência.

### R-1. Drift migrations↔prod + tipos do banco dessincronizados (B-C1 ⊕ Q-A1) — o mais estrutural
- **Evidência**: prod tem tabelas (`ambassadors`, nutrition, physio, studios) ausentes de `supabase/migrations/`; `shared/types/database.ts` diverge nas duas direções (tem ambassadors, NÃO tem `perfect_weeks`/`access_blocked_at`/`trainer_payment_accounts`); consequência medida: 196 `.from('x' as any)` + 582 `as any` web+mobile. O `gen:types` ainda trunca o arquivo em falha (gotcha conhecido).
- **Como trava o crescimento**: sem migrations fiéis não existe staging nem ambiente de dev confiável → todo teste é em produção, com dados financeiros reais. Cada `as any` é um lugar onde uma mudança de schema quebra em runtime sem o compilador avisar — exatamente quando o time quiser andar rápido (IA no builder, financeiro mobile). Onboarding de qualquer segundo dev fica inviável.
- **Custo agora vs depois**: agora ~2-3 dias (db diff contra prod → migrations de reconciliação → `gen:types` do projeto certo, `lylksbtgrihzepbteest` → queda gradual dos casts). Depois: cresce a cada migration nova (179 e contando) e a reconciliação vira projeto de semanas com risco de perda de objeto em prod.

### R-2. Ausência total de CI com superfícies de dinheiro e de dados sem teste (Q-A2 ⊕ Q-A4)
- **Evidência**: testes red desde 29/04 (commit 519ee80) sem ninguém notar = prova empírica de que regressão hoje só é detectada por usuário. Zero testes em: webhooks Stripe/Asaas (dinheiro), `useWorkoutSession` 1.383 linhas (o produto que o aluno usa), auth mobile. Densidade: web 13%, mobile 6,5%.
- **Como trava o crescimento**: o financeiro Asaas está indo a GA — um deploy que quebre o webhook significa pagamento recebido sem contrato atualizado (ou aluno bloqueado indevidamente), e o histórico mostra que ficaria semanas sem detecção. Cada feature nova aumenta a chance; o medo de quebrar passa a frear o deploy — o oposto de velocidade.
- **Custo agora vs depois**: o quick win QW-3 (1 dia) já dá o piso; +2-3 dias para testes de contrato dos 2 webhooks (fixtures de payload Asaas/Stripe) e do happy path do player. Depois: o custo é pago em incidentes de produção com dinheiro de terceiros — reputacionalmente irrecuperável para um SaaS financeiro.

### R-3. Duplicação dos dois program builders (~5.000 linhas) colidindo com o roadmap de IA (F-04)
- **Evidência**: `program-builder-client.tsx` (2.844) × `edit-assigned-program-client.tsx` (2.133), drift já visível entre eles.
- **Como trava o crescimento**: a decisão de produto nº 1 do roadmap (16/abr) é "IA embutida no builder". Com dois builders, toda fase do plano de IA (1, 1.5, 2…) precisa ser implementada e mantida 2×, ou — mais provável — será feita só no de criação, deixando a edição de programa atribuído (onde o treinador passa a maior parte do tempo) sem IA. A duplicação não é só custo: ela distorce o escopo do roadmap principal.
- **Custo agora vs depois**: agora ~1-2 semanas para extrair o núcleo compartilhado (estado + SetSchemeTable + métodos) ANTES das fases de IA. Depois: cada fase de IA construída em cima dobra o custo da unificação e o drift vira divergência funcional visível ao usuário.

### R-4. Custo de IA sem rate limit efetivo (segurança M ⊕ arquitetura)
- **Evidência**: `web/src/lib/rate-limit.ts:1-9` é um `Map` in-memory — em serverless cada instância tem o seu, ou seja, o limite é decorativo. Superfícies pagas: prescrição (Claude/GPT), assistente (gpt-4.1-mini), forms, parse-workout-text.
- **Como trava o crescimento**: o modelo de negócio quer IA como diferencial nos planos; sem limite real, um único usuário (ou bot, já que a landing é pública e o signup tem rate limit no mesmo Map) pode gerar conta de API ilimitada → o medo do custo trava o lançamento de IA para a base toda. A telemetria em `prescription_generations` já existe; falta o enforcement.
- **Custo agora vs depois**: agora ~1 dia (Upstash Redis/Vercel KV + quota por trainer lida da telemetria existente). Depois: descoberto via fatura, sob pressão, possivelmente com IA já prometida em plano pago.

### R-5. Offline do player = risco de retenção do aluno (M-A4, parcial desde maio)
- **Evidência**: iniciar treino sem rede é impossível; player vive em memória (kill do app = perda); `sync_status` hardcoded `'synced'` em 5 pontos; o Watch tem fila atômica (SecureStore), o telefone não — os blocos existem, falta montar.
- **Como trava o crescimento**: academia brasileira com sinal ruim é o caso médio, não o extremo. Aluno que perde um treino logado culpa o app → pressiona o personal → churn do personal. É a única dívida desta lista que o usuário final sente diretamente, e compete com o ponto forte do Hevy (log offline impecável).
- **Custo agora vs depois**: ~1 semana para fila de sync no telefone reaproveitando o padrão do Watch + `local_id`/`device_id` que o schema já suporta (offline-first foi desenhado no banco, não no client). Depois: cada feature nova do player (D-2, D-3 acima) nasce sobre fundação que perde dados.

### R-6. Realtime sem filtro server-side nas tabelas de maior volume — risco de escala latente
- **Evidência**: verificado nesta fase — `conversation-list.tsx:49` e `use-unread-messages-count.ts:29` assinam `postgres_changes` em `messages` SEM `filter` (só inbox e insights filtram). Cada INSERT em `messages` é avaliado contra RLS para CADA cliente conectado.
- **Como trava o crescimento**: com centenas de treinadores × alunos conectados, o realtime do Supabase degrada (a checagem RLS por assinante é o gargalo documentado) justamente no chat — o recurso "vivo" do produto. Não dói hoje; dói exatamente quando o crescimento chegar, e a degradação é difícil de diagnosticar.
- **Custo agora vs depois**: agora ~0,5-1 dia (adicionar `filter: student_id=eq.X` / migrar contadores para broadcast). Depois: incidente de latência de chat em produção com diagnóstico caro.

---

*Relatório gerado pela Fase 3 da análise noturna somente-leitura de 09/06/2026. Nenhum arquivo de código foi alterado.*
