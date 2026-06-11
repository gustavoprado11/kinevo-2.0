# Auditoria crítica — Kinevo Mobile (jun/2026)

Auditoria adversarial em dois pilares: **(A) rastreio de código** (7 frentes paralelas, ponta a ponta tela→hook→Supabase→render) e **(B) percurso real pelas telas** via simulador iOS + Maestro + screenshots inspecionados.

- Ambiente B: iPhone 17 Pro (iOS 26.2), dev build `com.kinevo.mobile`, Metro local, conta `gustavoprado11@hotmail.com` (**dual-role**: aluno + treinador PRO). Stripe/Asaas só leitura.
- Screenshots em `mobile/tmp/audit-shots/`, flows Maestro em `mobile/tmp/maestro-flows/`.
- **Nota de método:** a árvore de acessibilidade do RN agrupa cards inteiros num único nó (o "Iniciar" da Home não existe como elemento isolado p/ Maestro). Texto-folha é selecionável; o resto exigiu tap por coordenada. Isso também significa: **o app expõe pouca acessibilidade** — relevante para usuários de VoiceOver (ver Médio M-UX-2).

---

## CRÍTICO

### C1 — Marcar série sem digitar grava 0 kg × 0 reps silenciosamente
`Lógica/Perda de dados · Aluno · Pilar A+B (confirmado visualmente)`
- **Evidência A:** `hooks/useWorkoutSession.ts:171-177` inicializa séries com `weight:'', reps:''`; `persistSetLog` (`:324-325`) faz `parseFloat(setData.weight)||0` e `parseInt(setData.reps)||0`. O alvo/anterior em `SetRow.tsx:84-89,118-122` é só `placeholder`, nunca copiado para `value`.
- **Evidência B:** screenshot `m-31b` do player + dump de acessibilidade: a coluna "Anterior" mostra `25×6`, mas os inputs Peso/Reps **não têm `value`** (TextInput vazio) — o "25"/"6" em cinza é placeholder. "0/23 séries", "Finalizar (0/23)".
- **Repro:** abrir treino, tocar no círculo de check sem digitar. Grava `weight=0, reps_completed=0, is_completed=true`.
- **Impacto:** volume=0, PR nunca detectado, histórico mostra 0×0; o aluno acredita ter registrado a carga do placeholder. Silencioso e irreversível.
- **Correção:** ao marcar com campo vazio, herdar o placeholder (alvo prescrito / `previousSets`) para o `value` antes de persistir, ou bloquear o check enquanto vazio.

### C2 — Desmarcar uma série NÃO remove o registro já gravado
`Integridade/Gravação parcial · Aluno · Pilar A`
- **Evidência:** `useWorkoutSession.ts:753-756` só persiste quando `!wasCompleted`; não há `delete` ao desmarcar. No finish, o loop `:1150-1168` só dá `push` nas `set.completed` e o `upsert` `onConflict` (`:1171-1176`) nunca apaga linhas fora do lote.
- **Repro:** marcar série 3 (grava), perceber erro, desmarcar → a linha continua `is_completed=true` para sempre.
- **Impacto:** treino salvo contém série explicitamente removida → infla volume, PR falso, histórico distorcido.
- **Correção:** ao desmarcar, deletar/`is_completed=false` a linha; ou reconciliar no finish deletando linhas da sessão fora do lote.

### C3 — Falha no upsert final é engolida → sessão "concluída" com 0 séries (treino perdido)
`Erro/Gravação parcial · Aluno · Pilar A`
- **Evidência:** `useWorkoutSession.ts:1171-1181` — em `logsError` apenas `console.error`, não lança; a sessão já foi marcada `status:'completed'` (`:1063-1090`/`:1093-1110`). `executeFinish` (`app/workout/[id].tsx:546-700`) recebe sucesso e mostra a celebração.
- **Repro:** `sessionId` nulo no meio (criação deferida falhou/offline) + oscilação de rede no finish → sessão `completed`, duração correta, **0 séries** no banco. Sem retry (já está completed).
- **Impacto:** treino inteiro perdido mas exibido como concluído (celebração mostra stats da memória).
- **Correção:** se `logsError` com séries a salvar, lançar (cair no catch que preserva a tela) ou marcar a sessão para re-sync em vez de `completed`.

### C4 — Trocar exercício após concluir séries deixa `set_logs` órfãos misturando dois exercícios
`Corrupção de dados · Aluno · Pilar A`
- **Evidência:** `swapExercise` (`useWorkoutSession.ts:894-933`) só altera estado local; séries já concluídas foram persistidas com o `executed_exercise_id` do exercício **original**. No finish o upsert só sobrescreve os `set_number` que o substituto reusar (`:1171`).
- **Repro:** A com 4 séries; concluir 1–3; trocar por B ("trocar e resetar", `app/workout/[id].tsx:337-346`); concluir só a série 1 de B. Em `set_logs`: série 1=B, séries 2–3=A sob o mesmo `assigned_workout_item_id`.
- **Impacto:** histórico/volume/PR misturam exercício trocado fora.
- **Correção:** no swap com reset, deletar os `set_logs` daquele item antes de liberar a troca.

### C5 — Avaliação física: estratégia média/mediana NÃO é persistida (salva tentativa crua)
`Cálculo de avaliação · Treinador · Pilar A`
- **Evidência:** `components/trainer/assessments/inputs/MultiAttemptInput.tsx:76-117` — `finalValue` usa `applyStrategy` (média/mediana), mas grava `is_selected` na **tentativa mais próxima** do final, não o agregado. Downstream (`lib/assessmentComputed.ts:32-45,173-183`; `[sessionId].tsx:575-581`) lê `is_selected`.
- **Repro:** teste `multi_attempt_numeric` strategy `mean`, tentativas [10,20] → UI mostra "15,0", mas persiste a linha de valor **10**.
- **Impacto:** IMC/RCQ/% gordura e o resumo usam valor diferente do exibido; em dobras cutâneas medidas em N tentativas (uso clássico de média), o % de gordura sai errado. (`best_max/min` coincidem com tentativa real → só morde média/mediana.)
- **Correção:** persistir o agregado computado como a linha selecionada (ou linha sintética com `value_numeric=finalValue`).

---

## ALTO

### A1 — Gate de assinatura do treinador é só client-side (receita do SaaS)
`Segurança/Monetização · Treinador · Pilar A (auth+financeiro)`
- **Evidência:** gate só em `app/index.tsx:70-75`, `(trainer-tabs)/_layout.tsx:140-142` e transições manuais. Rotas de treinador fora de `(trainer-tabs)` (`financial/*`, `student/[id]/*`, `program-builder/*`, `agenda`, `leads`, `program-templates`) **não repetem o gate**; `usePushNotifications.ts:211-251` faz deep-link direto a `/student/[id]` e `/financial/*`. Status vem de `select` direto em `subscriptions` (`RoleModeContext.tsx:138-152`), não de enforcement server-side. **A auditoria de RLS confirmou que NÃO há checagem de assinatura do próprio treinador no servidor** (o bloqueio server-side da migration 162 é de *inadimplência do aluno*, não do trainer).
- **Impacto:** treinador que parou de pagar a Kinevo segue operando o negócio inteiro via Supabase direto. Paywall cosmético.
- **Correção:** enforce server-side (RLS/RPC referenciando assinatura ativa) e/ou mover todas as rotas de treinador para um layout com gate.

### A2 — `catch` do `resolveRole` deixa o gate à deriva: bloqueia pagante ou libera cancelado por blip de rede
`Estado stale/condição invertida · Treinador · Pilar A`
- **Evidência:** `RoleModeContext.tsx:168-179` — no catch restaura `role` mas nunca toca `subscriptionStatus` (inicial `null`). `index.tsx:71` trata `null` como não-ativo → **treinador adimplente vai para a paywall** por erro transitório no boot. O inverso (status `active` stale após cancelamento) mantém acesso até refresh ok.
- **Correção:** distinguir "desconhecido" de "sem assinatura"; preservar último status conhecido; decidir fail-closed/open explicitamente.

### A3 — Duplo-tap duplica cobrança/assinatura/payout (dinheiro real)
`Idempotência · Treinador · Pilar A`
- **Evidência:** `NewSubscriptionSheet.tsx:149-216` (`handleConfirm` sem `if (submitting) return`, só `disabled` por state) → duas assinaturas Asaas recorrentes / dois charges. `app/financial/wallet/payout.tsx:56-80` (`canSubmit` é closure do render) → dois payouts PIX. Mesmo padrão de duplo-tap aparece em mensagens (H3) e save de programa (A-prog B1).
- **Correção:** guarda idempotente síncrona via `useRef` antes do `await` + chave de idempotência no backend.

### A4 — Formatação monetária inconsistente / sem separador de milhar
`Formatação · Ambos · Pilar A+B (confirmado visualmente)`
- **Evidência A:** família de `formatCurrency` que faz `toFixed(2).replace('.',',')` SEM agrupar milhar em `contract/[id].tsx:59-62`, `ContractCard.tsx:36-39`, `TransactionRow.tsx:6-8`, `PlanCard.tsx:13-15`, `NewSubscriptionSheet.tsx:46-48`. Convive com `formatBRL`/`Intl` corretos noutras telas.
- **Evidência B:** Dashboard treinador mostra "R$ 0"; Financeiro mostra "R$ 0,00". Descrição de transação vaza string crua "1 × Teste (at R$ 1.00 / month)".
- **Impacto:** valores ≥ R$ 1.000 aparecem como "R$ 1234,56".
- **Correção:** centralizar um único `formatBRL`/`Intl` e padronizar.

### A5 — Preço de plano quebra com separador de milhar → plano criado ~1000× menor
`Cálculo monetário · Treinador · Pilar A`
- **Evidência:** `PlanFormSheet.tsx:55` `parseFloat(price.replace(',', '.'))`. "1.500,00" → "1.500.00" → `parseFloat` para em 1.5. (O `payout.tsx:22-26` faz o certo; o form de plano não.) Preço imutável após criação (`:227-235`).
- **Correção:** normalizar como `parseAmount` (strip de milhar) + validar limites.

### A6 — Treinador NUNCA consegue editar/excluir exercício próprio (owner_id ≠ user.id)
`Feature quebrada · Treinador · Pilar A`
- **Evidência:** `exercises/index.tsx:353` e `exercises/[id].tsx:99` comparam `owner_id === user?.id`, mas `useExerciseCrud.ts:26,68` grava `owner_id: trainerId` (id da linha `trainers`, ≠ `auth.users.id` — `RoleModeContext.tsx:103-112`). `isOwner` é sempre `false`.
- **Impacto:** botões editar/excluir e swipe-to-delete nunca aparecem; badge "CUSTOM" aparece mas sem ação. Edição/exclusão de exercício 100% inacessível.
- **Correção:** comparar com `trainerId` do `useRoleMode()`.

### A7 — Detalhe do aluno fica stale após atribuir → risco de atribuição duplicada
`Re-fetch faltando · Treinador · Pilar A`
- **Evidência:** `useStudentDetail.ts:89-94` (`useCachedQuery` sem invalidação); `useProgramBuilder.ts:272-307,589` faz `store.reset()` mas não invalida `STUDENT_DETAIL`; `student/[id]/index.tsx` sem `useFocusEffect`.
- **Impacto:** após atribuir, o detalhe segue "sem programa ativo" → treinador reatribui → segundo programa encerra o primeiro.
- **Correção:** invalidar `CACHE_KEYS.STUDENT_DETAIL` nos saves e/ou `useFocusEffect(refresh)`.

### A8 — Save de programa não-transacional → árvore órfã + retry duplica tudo
`Gravação parcial/órfã · Treinador · Pilar A`
- **Evidência:** `useProgramBuilder.ts:83-207` (`saveAsTemplate`) cria `program_templates`+workouts+items em awaits sequenciais sem transação; `saveAndAssign` (`:289-313`) chama Edge `assign-program` depois. Falha após criar a árvore → órfãos; cada novo toque em "Salvar" recria a árvore (sem idempotência); falha no meio do loop de template puro → template parcial visível na biblioteca.
- **Correção:** criar+atribuir via RPC/Edge transacional única; reaproveitar `programId` em retry.

### A9 — Erro transitório no fetch de gatilhos zera check-in pré/pós permanentemente
`Falha silenciosa · Aluno · Pilar A`
- **Evidência:** `useWorkoutFormTriggers.ts:71-78` — no catch seta `fetchedRef.current = assignedProgramId` ("não retentar"); `app/workout/[id].tsx:200-206` com `!preWorkoutTrigger` cria sessão direto.
- **Impacto:** blip de rede ao abrir o treino → check-ins pré e pós **nunca** aparecem, sem aviso; treinador deixa de receber readiness/feedback.
- **Correção:** não marcar `fetchedRef` no erro (permitir retry) ou expor erro + 1 retry.

### A10 — "Regenerar métricas" apaga o relatório e descarta as observações (apesar do aviso prometer preservá-las)
`Perda de dados · Treinador · Pilar A`
- **Evidência:** `app/report/[id].tsx:289-327` — alert diz "Suas observações serão preservadas", mas `savedNotes` nunca é usado; faz `DELETE` (304-307) e não regenera.
- **Correção:** preservar `trainer_notes` e reinjetar na regeneração, ou remover a promessa do diálogo.

### A11 — Leak de canais Realtime no logout/login + churn por mensagem
`Subscription leak/Estado · Ambos · Pilar A`
- **Evidência:** `useUnreadCount.ts:124-169` guarda teardown em `cleanupRef` mas o cleanup do `useEffect` só faz `cancelled=true` (nunca `removeChannel`); o ramo `if(!user)` (logout) também não remove. Cada ciclo login→inbox→logout→login orfana 2 canais. Soma-se: `ChatView.tsx:93-146` usa `markAsRead` instável de `useTrainerChat` como dep → **refetch total + flash de loading + re-subscribe do canal a cada mensagem recebida** (H1/H2), com janela onde mensagens reais "somem".
- **Correção:** mover `removeChannel` para o `return` do effect e para o ramo de logout; estabilizar `markAsRead` (ref) e tirá-lo das deps.

### A12 — Auto-retry de keychain bloqueado nunca dispara (stale closure)
`Estado preso · Ambos · Pilar A`
- **Evidência:** `AuthContext.tsx:91-102` — handler de `AppState` captura `error` no 1º render (`null`); deps `[loadSession]` (não `error`). Quando `setError("keychain_locked")` ocorre, o listener continua vendo `null`.
- **Impacto:** cenário de launch em background (Watch) com device bloqueado → usuário preso na tela "Aguardando Desbloqueio" até tocar manualmente.
- **Correção:** incluir `error` nas deps ou ler via `useRef`.

### A13 — Envio de mensagem: duplo-tap duplica e falha é silenciosa
`Race/Erro · Ambos · Pilar A`
- **Evidência:** guard por state, não ref (`ChatView.tsx:162-189`, `messages/[studentId].tsx:89-103`) → duplo-tap insere 2 ids distintos (+2 push). Falha de envio retorna `null` sem feedback (`useTrainerChat.ts:133-136,195-198`) → spinner some, texto fica no input, usuário não sabe se enviou.
- **Correção:** guard idempotente por ref; retornar erro tipado + toast/estado "falha, tocar p/ reenviar".

### A14 — Duração e `started_at` errados ao retomar sessão `in_progress`
`Cálculo de tempo · Aluno · Pilar A`
- **Evidência:** `startTime` fixado no mount (`useWorkoutSession.ts:133`); ao reabrir, `duration_seconds`/`started_at` (`:1036,1095`) usam o mount atual, não o `started_at` do banco.
- **Impacto:** começar, sair 1h, voltar e finalizar em 10min → grava 10min e move `started_at` (corrompe data no calendário/compartilhamento).
- **Correção:** ao reanexar, basear `startTime`/`duration` no `started_at` real.

---

## MÉDIO

- **M1 — Imagem de chat renderiza como bloco verde vazio.** `Mídia/UX · Ambos · Pilar B (visual)` Screenshot `12-aluno-inbox`: mensagem-imagem aparece como retângulo verde sólido sem conteúdo; a lista do treinador mostra "🖼 Imagem". Provável: o build não está lendo via `createSignedUrl`/`image_path` (`ChatImage.tsx:38-39`) ou a imagem falha sem fallback. Sem placeholder/erro de carregamento. Ver também segurança S1.
- **M2 — Bucket público de imagens de chat (PII).** `Segurança/Privacidade · Ambos · Pilar A` `useTrainerChat.ts:167-190` grava `publicUrl`; bucket `messages` segue `public=true` (`090_messages.sql:99`, doc em `163`). Fotos de progresso ficam world-readable por URL permanente, sem expiração. Mitigado por a URL exigir acesso à thread (RLS), mas a URL vazada é eterna. Correção planejada (etapa 3 do runbook A2): flipar bucket para `public=false` após forçar update do mobile.
- **M3 — Escritas de perfil do aluno falham silenciosamente (falta policy UPDATE em `students`).** `Integridade · Aluno · Pilar A` `app/profile/notifications.tsx:62-65` e `(auth)/verify-email.tsx:93-96` fazem `update` em `students`, mas as únicas policies são `students_trainer_all` e `students_self_select` (sem UPDATE para o aluno) → 0 rows, sem erro. Preferências de notificação do aluno provavelmente nunca gravam. Correção via RPC dedicada (evitar escalonamento por coluna).
- **M4 — Tema: app é "dark-locked"; paywall renderiza em light → inconsistente.** `UX/Consistência · Ambos · Pilar B (visual)` Em relaunch a frio com sistema=light, Home/Perfil seguem **escuros**; `trainer-subscription-blocked` renderiza em **light** (`40-paywall`). O seletor "Aparência: Sistema/Claro/Escuro" não troca as telas principais. Confirmar intenção (dark-only?) e alinhar a paywall ao tema dominante / corrigir o seletor.
- **M5 — Método composto com séries não divisíveis por `rounds` esconde séries e trava o 100%.** `Aluno · Pilar A` `ExerciseCard.tsx:118` `Math.floor(setScheme.length/rounds)`; séries excedentes nunca renderizam, mas `totalSets` conta todas (`[id].tsx:293-301`) → progresso preso em "4/5", finish sempre incompleto.
- **M6 — Superset assume nº de séries igual entre exercícios.** `Aluno · Pilar A` `SupersetGroup.tsx:19-32` + `[id].tsx:63-88` → contador "rodada X de Y" e disparo do rest timer inconsistentes quando os exercícios têm contagens diferentes.
- **M7 — Home só reconhece um treino por dia agendado.** `Aluno · Pilar A` `home.tsx:244-247` usa `.find` (primeiro) → 2 sessões no mesmo dia: card mostra só uma e concluir a outra não marca o dia.
- **M8 — `detectProtocol` casa o primeiro protocolo "contido" → roda fórmula errada.** `Avaliação · Treinador · Pilar A` `assessmentComputed.ts:197-223` (só no caminho de inferência sem `ProtocolTest` explícito). Exigir match exato dos sítios.
- **M9 — Voltar no meio da medição numérica descarta o valor não confirmado.** `Perda de respostas · Treinador · Pilar A` `assessments/[sessionId]/measure/[testId].tsx:42,57-60,227`.
- **M10 — `duplicateItem`/`reorderItems` corrompem supersets no builder.** `Treinador · Pilar A` clone de superset vira bloco vazio (`program-builder-store.ts:1377-1404`); arrastar filho reindexa `order_index` global (`:1406-1416`).
- **M11 — Editar programa ativo reescreve `started_at` (date-only) e troca ids das séries (DELETE+INSERT) em dados em uso.** `Treinador · Pilar A` `program-builder-store.ts:944-945` + `useProgramBuilder.ts:370-380,509-540` → drift de semana e risco de órfãos se o aluno estiver em sessão.
- **M12 — Validação ausente de `scheduled_days` na atribuição.** `Treinador · Pilar A` `AssignProgramWizard.tsx` (TODO explícito) → programa pode ser atribuído sem dias → sem lembretes.
- **M13 — `finalize` de avaliação computa métricas do closure, sincroniza do store.** `Treinador · Pilar A` `assessments/[sessionId].tsx:213-254` — última medição pode entrar no banco mas ficar fora de `computed_metrics`.
- **M14 — `Intl.NumberFormat` com `currency` dinâmico pode lançar e quebrar a linha.** `Aluno · Pilar A` `payment-history.tsx:28-33` (currency inválido → RangeError).
- **M15 — Race AuthContext×RoleMode pós-login + `ROLE_KEY` não limpo no logout.** `Treinador · Pilar A+B` `index.tsx:41,70-78` + `RoleModeContext.tsx:61,155-164,205-207`. **Confirmado em B:** após logout/login, a conta dual-role caiu **direto no home do aluno** (pulou `role-select`) por causa do `ROLE_KEY` persistido — mecanismo que, em device compartilhado, faz o usuário B herdar o papel do A. Limpar `ROLE_KEY` no `signOut`.
- **M16 — Efeito colateral (persist/timer) dentro do updater de `setExercises`.** `Aluno · Pilar A` `useWorkoutSession.ts:738-760` — React 19 pode reexecutar o updater → persist/rest-timer/haptics duplicados.
- **M17 — Lista de conversas do treinador stale (sem UPDATE sub / sem refetch no foco).** `Treinador · Pilar A` `useTrainerConversations.ts:155-213`; badge de não-lida persiste errado até pull-to-refresh.
- **M18 — Mensagem própria do treinador sem optimistic.** `Treinador · Pilar A` `messages/[studentId].tsx:89-103` depende do eco do realtime; se perdido, parece que falhou → reenvio (A13).
- **M19 — "Carregar anteriores" rola de volta pro fim.** `Ambos · Pilar A` `ChatView.tsx:379-383` — inviabiliza ler histórico.
- **M20 — Sessões órfãs `in_progress` acumulam no banco.** `Aluno · Pilar A+B` reabrir reanexa; não inflam progresso (verificado), mas ficam linhas. (Esta auditoria criou 1 sessão de teste — ver "Pendências".)

---

## BAIXO

- **B1 — Banner promocional dos Formulários com texto sobreposto/cortado.** `UX · Treinador · Pilar B` (`23-trainer-forms`).
- **B2 — Card de atividade trunca "Inten…" (Intensidade).** `UX · Aluno · Pilar B` (`10-aluno-logs`).
- **B3 — VOLUME exibido sem unidade clara** ("34,0") vs card de treino com "9,4 t". `UX · Aluno · Pilar B`.
- **B4 — Strings cruas/i18n** em descrição de transação ("at R$ 1.00 / month"). `Pilar B`.
- **B5 — OTP/forgot-password sem guarda de in-flight** (`enter-code.tsx:53-80` + `OtpInput.tsx:44-48`; `forgot-password.tsx:166-167`). `Pilar A`.
- **B6 — `dueDate` de cobrança Asaas em UTC** (off-by-one noturno) — `NewSubscriptionSheet.tsx:171`. `Pilar A`.
- **B7 — "Saldo a liberar" zera quando endpoint não retorna `totalBalance`** — `useWalletBalance.ts:45-47`. `Pilar A`.
- **B8 — Bucket `avatars` público; `__DEV__` loga presença de config Supabase** (`020`,`121`; `lib/supabase.ts:49-51`). `Pilar A`.
- **B9 — Duplo-disparo possível no `WorkoutFeedbackModal`** e duplo-prompt "fora de faixa" na medição. `Pilar A`.
- **B10 — Versão exibida "Kinevo v1.4.0"** vs `package.json` 1.1.6 (conferir fonte da string). `Pilar B`.

---

## Resumo executivo — Top 5 riscos

1. **Perda/corrupção silenciosa de dados de treino (C1–C4).** O caminho mais sensível do app (registrar treino) perde ou corrompe dados sem o aluno perceber: 0×0 ao não digitar (confirmado na tela), desmarcar não apaga, finish engole erro marcando "concluído" vazio, e swap deixa órfãos. **Prioridade máxima.**
2. **Cálculo de avaliação física errado (C5/M8).** % de gordura/IMC calculados sobre valor diferente do exibido — o treinador prescreve sobre número errado.
3. **Financeiro: duplo-tap cobra/saca em dobro e plano cadastrado 1000× menor (A3/A5).** Erros que mexem em dinheiro real do treinador e do aluno; somam-se à formatação de moeda inconsistente (A4, vista na tela).
4. **Gate de assinatura do treinador puramente client-side (A1).** Sem enforcement server-side, treinador inadimplente segue operando via Supabase direto — vazamento de receita do SaaS.
5. **Mensageria: leak de canais + refetch/churn por mensagem + falha de envio silenciosa (A11/A13) e imagem como bloco verde (M1).** Some isolado não derruba o app, mas em conjunto degrada bem a experiência principal de comunicação.

**Nota positiva (auditoria de segurança):** o isolamento multi-tenant é **real e está no banco** (RLS por `current_student_id()`/`current_trainer_id()`, anti-spoof de `trainer_id`, revogação de `anon` nas RPCs, bloqueio de inadimplência do aluno server-side). Não foi encontrado vazamento cross-tenant explorável, `service_role` no client, nem segredo indevido em `EXPO_PUBLIC_*`. Os riscos de segurança restantes são os buckets públicos (M2/B8) e a falta de policy UPDATE do aluno (M3).

---

## O que NÃO foi possível verificar (pontos cegos — exigem teste manual)

- **Apple Watch / WatchConnectivity / HealthKit** — não funciona no simulador (CLAUDE.md). Todo o fluxo `finishWorkoutFromWatch`, frequência cardíaca e o app SwiftUI do Watch ficaram **só no código**.
- **Push notifications reais (APNs/FCM) e deep-link de notificação** — não disparáveis no sim; o gate A1 via push (`usePushNotifications.ts`) é inferência de código.
- **Live Activities (lock screen)** — não verificado no sim.
- **Pagamento/cobrança real (Stripe/Asaas)** — modo teste e sem disparar transações; A3/A5/A4 são análise de código + telas, não execução de cobrança.
- **Gate de assinatura bloqueado na prática** — a conta é PRO ativa; a tela `trainer-subscription-blocked` foi vista (deep-link), mas não o comportamento real de um trainer cancelado batendo nas rotas desprotegidas. **Requer conta de teste com assinatura inativa.**
- **RLS — execução real dos ataques** — confirmado por leitura das 174 migrations, não por tentativas de IDOR autenticadas. ~50 RPCs SECURITY DEFINER foram amostradas, não 100% lidas (a 173 declara as demais "gateadas").
- **Unidade de valores em algumas RPCs financeiras** (`get_financial_students.amount`, `get_financial_dashboard.amount_gross`, `/api/student/payment`) — se alguma guardar centavos, vira erro de 100× (seria Crítico). **Confirmar no banco real `lylksbtgrihzepbteest`.**
- **Login/onboarding em conta nova / verificação de email / OTP** — o fluxo de login foi exercido (logout→login com a conta existente, dual-role caindo direto no home); criação de conta, verify-email e OTP **não** foram percorridos com conta nova.
- **Comportamento offline real e reconexão de Realtime** — simulado por raciocínio de código, não por corte de rede no device.
