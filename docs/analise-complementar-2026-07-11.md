# Análise complementar web + mobile — 11/jul/2026

> Pedido do Gustavo: "rode uma análise do sistema web e mobile; tente encontrar melhorias e correções".
> Método: 5 auditores em paralelo nas frentes **NÃO cobertas** pelas auditorias de 07–11/jul
> (entrada/conta web · dia a dia do trainer web incl. agenda · mobile fora do treino incl. modo
> treinador · consistência transversal/shared · performance percebida). **READ-ONLY: nenhum fix
> aplicado** — o working tree segue intacto com os 9 fixes (F1–F9) da auditoria noturna.
> Baseline: web `tsc` 0 erros · mobile `tsc` 0 erros.
> Todos os achados foram confirmados lendo o código (arquivo:linha); o CRÍTICO foi re-verificado
> manualmente por mim. Convenção de IDs desta análise: **AC** (acesso/conta web), **AG** (agenda +
> dia a dia web), **MB** (mobile), **CS** (consistência/shared), **PF** (performance) — sem colisão
> com T/FIN/M/FO/R/P das análises anteriores.

## 1. Top prioridades (CRÍTICO + ALTO)

| # | Sev | Achado | Onde |
|---|---|---|---|
| AG1 | **CRÍTICO** | Remarcar atendimento para fora da semana visível faz ele **sumir de todas as visões semanais** — sozinho explica a desconfiança na agenda (zero uso em prod) | `shared/utils/appointments-projection.ts:101-125` |
| MB1 | ALTO | Financeiro mobile renderiza **R$ 0,00 como dado real** em falha de rede/RPC — a proteção "P16" é código morto (supabase-js não rejeita; ninguém checa `.error`) | `mobile/hooks/useFinancialDashboard.ts:42-62` |
| AC1 | ALTO | **Reset de senha quebra** em outro dispositivo/link expirado: não existe rota de confirm (PKCE sem code_verifier) e o erro só aparece no submit | `web/src/app/auth/update-password/page.tsx:17-51` |
| AC2 | ALTO | `addCoach` **absorve treinador existente sem consentimento** (por e-mail): vira membro `active` na hora, perde direito ao próprio estúdio e pode ser redirecionado a `/estudio/blocked` | `web/src/actions/organizations/add-coach.ts:34-44,99-113` |
| MB2 | ALTO | Troca de e-mail do aluno grava `students.email` **antes** da verificação OTP — abandono/typo deixa auth ≠ students para sempre | `mobile/app/(auth)/verify-email.tsx:81-101` |
| MB3 | ALTO | Sino do treinador roteia notificação de mensagem para o **inbox do ALUNO** (superfície errada, sem trocar role) — o push já faz certo | `mobile/app/notifications/index.tsx:35-38` |
| AG2 | ALTO | Sync Google Calendar é **fire-and-forget em serverless** (função congela após o return; retries `setTimeout` morrem junto) e não há cron reconciliando `google_sync_status='pending'` | `web/src/actions/appointments/core.ts:229-234` + `sync-service.ts` |
| AG3 | ALTO | Agenda web **não tem UI para marcar presença** (concluído/faltou) — `markOccurrenceStatusCore` existe mas só o MCP chama; o card até renderiza o badge "Faltou" que a web nunca seta | `web/src/components/appointments/occurrence-popover.tsx:237-289` |
| CS1 | ALTO | Vencimento de contrato Asaas exibido **1 dia antes** (web E mobile): `current_period_end` gravado UTC-midnight + `toLocaleDateString` sem timeZone | `api/webhooks/asaas/route.ts:558-562` + `financial-sidebar-card.tsx:107` + `mobile/components/financial/ContractCard.tsx:34-36` |
| PF1 | ALTO | Execução de treino re-renderiza a **lista inteira 1×/segundo** (cronômetro no hook da tela + arrow inline quebra o memo de todos os cards) — jank e bateria em treinos de 45-60min | `mobile/hooks/useWorkoutSession.ts:542-547` + `app/workout/[id].tsx:1350` |
| PF2/PF3 | ALTO | Aba Mensagens baixa **TODAS as mensagens de todos os alunos sem `.limit()`** — no mobile a cada foco; no web refeito integralmente a cada INSERT realtime (canal sem filtro). Acima de 1000 linhas o preview ainda fica errado | `mobile/hooks/useTrainerConversations.ts:78-90` + `web/src/app/messages/actions.ts:92-104` |

## 2. AC — Web: entrada e conta (auth, onboarding, checkout, leads, settings)

- **AC1 [ALTO]** Reset de senha sem rota de confirm/verificação — ver tabela. Fix: rota `verifyOtp(token_hash)` ou gate na chegada com "reenviar link" (M).
- **AC2 [ALTO]** addCoach sem consentimento — ver tabela. Fix: membership `status:'invited'` + aceite pelo próprio trainer (M). Compõe com o R4 conhecido (gate no createOrganization).
- **AC3 [MÉDIO]** `signOut()` **global** disparado por erro transitório de DB: `get-trainer.ts:87-91` (e `settings/page.tsx:32-35`, `settings/api-keys/page.tsx:20-23`) desloga TODAS as sessões — inclusive o app mobile — quando `.single()` falha por hiccup, não só por 0 linhas. Fix: só deslogar em `PGRST116` (S).
- **AC4 [MÉDIO]** Política de senha do reset aceita 6 chars sem HIBP, enquanto o signup exige 8 + checagem de vazamento (`update-password/page.tsx:22-24` vs `signup-trainer.ts:65-67,101-104`) — recovery vira bypass. Fix: alinhar (S).
- **AC5 [MÉDIO]** `/subscription/blocked` promete "R$ 39,90/mês após o período de teste" mas o trial foi removido (cobra na hora) e o POST sem body cai no price legado sem escolha de tier (`blocked-client.tsx:54,123` + `api/stripe/checkout/route.ts:68-70,106-108`). Fix: corrigir copy + enviar `{tier}` (S).
- **AC6 [MÉDIO]** `/checkout-bridge` (retorno do Stripe mobile) fora da whitelist do middleware: sem cookie, o pagante volta do Stripe para `/login` em vez do deep link `kinevo://` (`lib/supabase/middleware.ts:48-76`). Fix: whitelist (S).
- **AC7 [MÉDIO]** Editar e-mail do aluno no modal (modo EDIT) atualiza só `students`, nunca `auth.users`: aluno continua logando no e-mail antigo; dedup lead→aluno deixa de casar (`student-modal.tsx:116-128`). Fix: server action com `auth.admin.updateUserById` + `students` juntos (M). Par do MB2 (mesmo problema, outro lado).
- **AC8 [BAIXO]** E-mail duplicado ao criar aluno devolve erro cru do Supabase em inglês na UI (`create-student-core.ts:70-73`). Fix: mapear p/ PT-BR (S).
- **AC9 [BAIXO]** Checkout cria customer Stripe órfão a cada tentativa não concluída (`api/stripe/checkout/route.ts:83-95`). Fix: persistir `stripe_customer_id` (S).
- **AC10 [BAIXO]** `updateLeadStatus` revalida `/leads` (rota que é só redirect) em vez de `/marketing/leads` (`actions/leads/update-lead-status.ts:38`). Fix: 1 linha (S).
- **AC11 [BAIXO]** DCR OAuth aceita `client_name` ilimitado exibido no consent (`oauth/register/route.ts:43`). Fix: cap 100 chars + rótulo "app de terceiro" (S).
- **AC12 [BAIXO]** Branding aceita **SVG** em bucket público (script embutido = stored XSS na origem do storage; avatar só aceita raster) (`actions/trainer/update-branding.ts:14-21,89-94`). Fix: remover svg do allowlist (S).

## 3. AG — Web: dia a dia (dashboard, aluno, agenda, exercícios, mensagens UI)

- **AG1 [CRÍTICO]** Projeção não materializa exceção `rescheduled` cuja data original está fora do range (**verificado por mim**: loop só itera `iterateValidDates(rule, start, end)`; na semana original o `continue` :117-122 remove; o `listAppointmentsCore` até busca exceções por `new_date` no range — intenção morta). "Remarcar pra semana que vem" = atendimento some de todas as semanas; o widget 90d do dashboard ainda mostra, o calendário não. Fix: emitir ocorrências a partir das exceções com `new_date` no range (M).
- **AG2 [ALTO]** Sync GCal nunca garante execução — ver tabela. Fix: `after()` do next/server + cron de reconciliação dos `pending` (M).
- **AG3 [ALTO]** Sem UI de presença — ver tabela. Fix: "Marcar concluído/faltou" no popover chamando a action existente (S). **Registrar presença é o fluxo diário nº 1 de um personal presencial; sem isso a agenda é só visualização.**
- **AG4 [MÉDIO]** Encerrar rotina entre 21h e 00h BRT deixa 1 dia extra ativo: `todayDateKey()` usa UTC (`core.ts:103-105,712`; idem `cancel-all-for-student.ts:19-25`). Fix: date key em America/Sao_Paulo (S).
- **AG5 [MÉDIO]** Coluna "Semana x/y" da lista de alunos deduplica dias enquanto dashboard/página do aluno contam ocorrências → números divergem (`students/page.tsx:110-115` vs `get-dashboard-data.ts:385-394`). Fix: alinhar com as outras telas (S).
- **AG6 [MÉDIO]** Remarcar A→B e voltar B→A: exceção órfã redireciona de novo para B (branch `once` move `starts_on` sem limpar exceções — `core.ts:345-359,396-411`). Fix: deletar exceções `rescheduled` ao atualizar `starts_on` (S).
- **AG7 [MÉDIO]** Conversa de aluno `pending`/arquivado é invisível (lista filtra `status='active'`; a thread só abre se está na lista) — dá pra enviar do perfil, não pra ver (`messages/actions.ts:85` + `messages-panel-content.tsx:43,68`). Fix: incluir pending/resolver alvo fora do filtro (S).
- **AG8 [MÉDIO]** Erros engolidos: `chat-panel.tsx:56-69` (`getMessages` sem `.catch` → spinner infinito) e `create-appointment-modal.tsx:242-284` (`try/finally` sem catch → falha silenciosa). Fix: catch + estado de erro (S).
- **AG9 [BAIXO]** `setState` dentro de `useMemo` na biblioteca de exercícios — único mecanismo de ressincronia pós `router.refresh()`; com React Compiler o corpo é assumido puro e pode ser descartado ("arquivar não faz nada") (`exercises-client.tsx:170-172`). Fix: remover o estado ou `useEffect` (S).
- **AG10 [BAIXO]** Descobribilidade da agenda: sem botão "+ Novo agendamento" (criar exige adivinhar clique no slot vazio) e o empty state do widget não linka `/schedule` (`schedule-client.tsx:244-268`, `upcoming-appointments-widget.tsx:103-108`). Fix: botão + link (S).
- **AG11 [BAIXO]** `/messages` é `redirect('/dashboard')` deixando `messages-client.tsx` morto — limpeza (S).

> **Leitura de produto (agenda, zero uso):** AG1 (dados somem) + AG3 (sem presença) + AG10
> (criação escondida) + AG2 (GCal não confiável) formam um ciclo de desconfiança completo.
> Corrigir AG1/AG3/AG10 é pouco esforço (1 M + 2 S) e muda a proposta da agenda.

## 4. MB — Mobile fora do treino (modo treinador + conta do aluno)

- **MB1 [ALTO]** Financeiro com zeros em falha — ver tabela. Mesmo padrão em `useContractDetail.ts:31-41` ("Contrato não encontrado" para contrato existente num blip de rede). Fix: checar `res.error` de cada RPC e lançar (S).
- **MB2 [ALTO]** `students.email` gravado antes do OTP — ver tabela. Fix: mover a RPC para depois do `verifyOtp` em `enter-code.tsx` (S).
- **MB3 [ALTO]** Sino roteia mensagem para superfície do aluno — ver tabela. Fix: espelhar o resolver do push (`usePushNotifications.ts:192-203`) (S).
- **MB4 [MÉDIO]** `notification-settings.tsx` 100% travada em light mode (tema legacy estático + hex hardcoded; :142-308). Fix: migrar p/ `useV2Colors` (S/M).
- **MB5 [MÉDIO]** Dark mode quebrado por mistura hex-claro + token de texto: feedback do treinador ilegível (`inbox/[id].tsx:451,481`), `role-select.tsx:51,96`, `financial/contract/[id].tsx:40-49`. Fix: pares `semantic.*.bg/fg` (S).
- **MB6 [MÉDIO]** Falha de rede em Leads renderiza "Nenhum lead ainda" (hook expõe `error`, tela não consome — `leads/index.tsx:77,194-200`). Fix: banner com retry, padrão do financeiro (S).
- **MB7 [MÉDIO]** Lead arquivado é irrecuperável (ação existe, filtro "archived" é inalcançável — `leads/index.tsx:44-49,107,627-637`). Fix: aba "Arquivados" (S).
- **MB8 [MÉDIO]** Race de range na Agenda ao navegar dias rápido (resposta antiga sobrescreve — `useAgendaOccurrences.ts:75-147`). Fix: `requestSeq` (S).
- **MB9 [MÉDIO]** Toggles de notificação otimistas sem checar `res.ok` (+ revert por closure desfaz o 2º toggle — `notification-settings.tsx:96-107`). Fix: `if (!res.ok) throw` + updater funcional (S).
- **MB10 [MÉDIO]** Teclado cobre o campo Instagram no perfil do treinador (ScrollView sem `automaticallyAdjustKeyboardInsets` — `trainer-profile.tsx:208-213,300-334`; o próprio repo documenta o fix em `report/[id].tsx:429-434`). Fix: 1 prop (S).
- **MB11 [BAIXO]** LayoutAnimation no-op no Fabric — 2 ocorrências novas (`(tabs)/logs.tsx:462`, `components/home/MonthCalendar.tsx:80`): expand do HistoryCard e troca de mês pulam sem animar. Fix: colapsável Reanimated existente (M).
- **MB12 [BAIXO]** Pressable com flex props em style-função (gotcha do projeto) no botão voltar da agenda (`agenda/index.tsx:74-87`). Fix: View interna (S).
- **MB13 [BAIXO]** `SectionLabel` do dashboard do treinador lê paleta light module-level → títulos com cor errada em dark (`(trainer-tabs)/dashboard.tsx:432-447`; `more.tsx:64-83` faz certo). Fix: `useV2Colors()` no componente (S).
- **MB14 [BAIXO]** Acesso não guardado a `m.volume` no relatório derruba a tela com `metrics_json` antigo sem volume (`report/[id].tsx:475-491`; todas as outras seções guardam). Fix: early return (S).

## 5. CS — Consistência transversal (shared, datas, busca, erros)

- **CS1 [ALTO]** Vencimento Asaas −1 dia (web+mobile) — ver tabela. `format-br-date.ts` existe exatamente pra isso e é importado em **1 arquivo** do monorepo. Fix: ancorar meio-dia no webhook ou `formatBrDate`/timeZone nos displays (também `mobile/app/financial/contract/[id].tsx:65-72`, `AttentionCard.tsx:29`) (S).
- **CS2 [MÉDIO]** Semana domingo-based em `useTrainerNotifications.ts:35` (única violação real da regra segunda; no domingo, a semana inteira cai em "Anteriores"). Fix: `getWeekRange` do shared (S).
- **CS3 [MÉDIO]** Treino iniciado 21h–24h BRT grava `scheduled_date` de **amanhã** (dow local + date key UTC — `useWorkoutSession.ts:670-672,1377-1379`). Dado errado persistido. Fix: `toDateKey` local (S).
- **CS4 [MÉDIO]** "Sessões esta semana" do MCP diverge do dashboard web (getDay cru no fuso do servidor vs `getISOWeekRange` com TZ — `lib/mcp/tools/dashboard.ts:18-21`). Fix: usar o helper do shared (S).
- **CS5 [MÉDIO]** `startOfDayTz` ancora meia-noite no fuso do RUNTIME (`schedule-projection.ts:83-86`): na Vercel, a semana do dashboard começa domingo 21h BRT → treino de domingo à noite cai na semana seguinte no web, mas não no mobile. Fix: construir instante com offset real (M).
- **CS6 [MÉDIO]** Agendamento mensal em dia 29–31 **deriva permanentemente** (rolagem do `setUTCMonth` sem clamp e o cursor itera sobre a data rolada: 31/jan → 03/mar → dia 3 pra sempre — `appointments-projection.ts:50-59,246-258`). Fix: clamp preservando dia-âncora (M).
- **CS7 [MÉDIO]** ~15 buscas client-side ignoram `matchesSearch` (acento quebra "João"/"Léo") nos pickers de aluno da agenda **das duas plataformas**, programas, leads, templates, grupos musculares, lista de conversas (lista completa no achado — `student-picker.tsx:78`, `create-appointment-modal.tsx:170`, `StudentPickerModal.tsx:128`, `CreateAppointmentSheet.tsx:159`, `programs-client.tsx:199,361`, `leads-client.tsx:125-128`, `program-templates/index.tsx:47`, `muscle-group-manager-modal.tsx:39`, `conversation-list.tsx:64-67`). Fix mecânico (S/M).
- **CS8 [MÉDIO]** Autosave de notas do relatório falha em **silêncio total** em produção (`report/[id].tsx:220-227` — `if (error && __DEV__)`). Nota digitada se perde. Fix: erro visível + reter texto (S).
- **CS9 [BAIXO]** markAsRead/markAllAsRead otimistas sem rollback (`useTrainerNotifications.ts:114-140`) (S).
- **CS10 [BAIXO]** "Cancelar agendamentos" no arquivamento degrada silenciosamente para "manter" em erro (`archive-student.ts:53-63`). Fix: warning no resultado (S).
- **CS11 [BAIXO]** "Segunda da semana" reimplementado 7× fora do shared (hoje consistentes; foi essa cópia que gerou o CS2). Fix: consolidar em helper (M).
- **CS12 [BAIXO]** Componente morto com streak hardcoded "2 semanas" pronto pra enganar se religado (`weekly-performance-tracker.tsx:80`). Fix: deletar (S).

## 6. PF — Performance percebida

Contexto verificado: React Compiler **desligado** no mobile (sem `experiments.reactCompiler` no app.json) → memoização manual importa.

- **PF1 [ALTO]** Timer 1s re-renderiza a execução inteira — ver tabela. Fix: cronômetro em componente-folha (padrão `ElapsedTimer` já existe em `training-room.tsx:57-85`) + `useCallback` no `onToggleExpand` (S).
- **PF2 [ALTO]** Mensagens mobile sem `.limit()` — ver tabela. Fix: RPC `DISTINCT ON` + count agregado (M).
- **PF3 [ALTO]** `getConversations` web idem + canal INSERT sem `filter:` refaz tudo a cada mensagem (`conversation-list.tsx:46-59`). Fix: mesmo RPC + filtro no canal + update incremental (o mobile já faz — `useTrainerConversations.ts:169-207`) (M).
- **PF4 [MÉDIO]** Stagger por índice sem cap: linhas invisíveis por 1-2s ao rolar 50+ alunos/conversas (`(trainer-tabs)/students.tsx:154`, `messages.tsx:126`; o cap certo já existe em `logs.tsx:379`). Fix: `Math.min(index, 8)` (S).
- **PF5 [MÉDIO]** Histórico de treinos: 100 sessões com árvore completa, sem cache/paginação, a cada mount (`useWorkoutHistory.ts:94-128`). Fix: paginar + `useCachedQuery` (M).
- **PF6 [MÉDIO]** Home do aluno: waterfall de 4 roundtrips sequenciais sem cache (~700-900ms de skeleton na tela mais aberta do app — `useActiveProgram.ts:175-238`). Fix: RPC única ou paralelizar + cache (M).
- **PF7 [MÉDIO]** `ChatImage`: signed URL nova por mount anula o cache de imagens — 20 fotos = 20 assinaturas + re-download integral por abertura (`ChatImage.tsx:31-49`). Fix: cache de signed URL por path com TTL (S).
- **PF8 [MÉDIO]** Biblioteca 500+: card sem `React.memo` + renderItem inline → cada tecla re-renderiza as células montadas (`exercises/index.tsx:380-387`; idem `ExercisePickerModal.tsx:263`). Fix: memo + useCallback (S).
- **PF9 [MÉDIO]** Perfil do aluno assina o training-room store **inteiro** (sem selector): cada toque de série na Sala re-renderiza a tela de perfil montada abaixo (visível lado a lado no iPad) (`student/[id]/index.tsx:90`). Fix: selectors granulares (S).
- **PF10 [BAIXO]** Avatares sem resize no upload + RN `Image` puro: fotos de 1-3MP decodificadas para thumbs de 42px (`AvatarPicker.tsx:30-35`, `v2/Avatar.tsx:70-78`). Fix: resize ~256px no upload ou transform do Storage (S/M).
- **PF11 [BAIXO]** `students/[id]` web: 2 queries independentes fora do `Promise.all` (+40-80ms TTFB — `page.tsx:201-206,456-460`). Fix: mover pro Stage 1 (S).

## 7. O que está comprovadamente sólido (destaques dos 5 auditores)

- **signupTrainer é defesa em camadas exemplar** (honeypot, rate-limit durável com advisory lock, Turnstile com degradê, HIBP fail-open, cron de órfãos) e o **OAuth MCP é bem construído** (PKCE com consumo atômico, tokens só como hash com rotation, redirect_uri validado 2×, sem open redirect).
- **Captação pública de leads anti-abuso e anti-enumeração** (success fake indistinguível, IP hasheado, dedup soft, push fire-and-forget que nunca bloqueia).
- **Dinheiro no mobile tratado com cuidado real**: saque PIX com guard anti duplo-tap + biometria; conversão de lead idempotente com dedup por e-mail.
- **`get-dashboard-data` web é exemplar** (14 queries paralelas, TZ com truque de DST, aderência alinhada ao mobile) e a **camada de appointments tem boa arquitetura** (núcleo compartilhado web/MCP, ownership check defensivo, drag&drop otimista com revert correto) — os bugs AG1/AG4/AG6 são pontuais, não estruturais.
- **shared/ é de alta qualidade e testado** (format-br-date, currency, search-text, 1RM unificado, hydrate-workout-sets, projeção de recorrência) — o problema do CS1/CS7 é **adoção**, não qualidade.
- **Regra "semana começa na segunda" globalmente respeitada** (únicas violações: CS2 real, CS4/CS5 de fuso) e a convenção `day_of_week` 0=domingo é consistente ponta a ponta.
- **Padrões de referência para os fixes de perf já existem no próprio repo**: ElapsedTimer folha, stagger capado, FlatList tunada, realtime incremental — os fixes PF1/PF3/PF4 são cópia de padrões internos.

## 8. Sequência sugerida

1. **Lote quick-win S (1 sessão):** AG3 (presença na agenda) · MB3 (roteamento do sino) · MB1 (checar `.error` no financeiro) · MB2 (RPC pós-OTP) · CS1 (vencimento −1 dia) · CS8 (autosave visível) · MB6/MB7 (leads) · AC10 · PF4 · MB10 · MB12 · AG10 (descobribilidade agenda) · CS7 (matchesSearch mecânico) · PF1 (timer folha).
2. **Lote M com decisão técnica:** AG1 (projeção de remarcadas — o CRÍTICO) · AG2 (`after()` + cron GCal) · AC1 (rota de confirm no reset) · PF2/PF3 (RPC de conversas) · CS5/CS6 (fusos/clamp mensal na projeção) · PF6 (home do aluno).
3. **Decisões de produto antes de codar:** AC2 (fluxo de convite/aceite p/ treinador existente) · AC5 (copy/tier da reativação) · AC7+MB2 (política única de troca de e-mail: quem pode, o que sincroniza) · AG7 (conversas de alunos pending/arquivados).

— Nenhuma migration necessária nos lotes 1; AG1/AG2 pedem cron/infra leve. Working tree preservado (F1–F9 da noturna intactos); typecheck baseline 0/0.

---

## 9. EXECUÇÃO — lote quick-win + AG1 aplicados (11/jul, madrugada)

Autorizado pelo Gustavo ("Vamos iniciar"; **Estúdios congelado → AC2 descartado**).
Tudo no **working tree, NÃO commitado** (workflow). Os F1–F9 da noturna foram
commitados em separado às 06:50 (`4fbb552`…`6cf7077`, com migrations 241–243 —
que também resolvem T1 cron de órfãs, FIN2 cron versionado e FIN3 carência no
gate); o working tree atual contém APENAS este lote: 38 arquivos + este relatório.

### Aplicado

| ID | Fix | Arquivos-chave |
|---|---|---|
| **AG1** | **Projeção materializa remarcadas vindas de fora do range** (2º passe com guarda de órfãs + dedup por regra::data::hora; semana original continua limpa) + fetch do widget do dashboard agora busca exceções também por `new_date` (a agenda web e a mobile já buscavam). **8 testes novos** cobrindo destino, dedup, colisão, órfã, ends_on e getNextOccurrences | `shared/utils/appointments-projection.ts` + teste · `web/src/lib/dashboard/get-dashboard-data.ts` |
| AG3 | "Marcar como concluído"/"Marcar falta" no popover (só ocorrências de hoje/passadas; esconde o status vigente; erro inline) + badge "Concluído" no card + refresh nos 2 callers. **4 testes novos** | `occurrence-popover.tsx`, `schedule/appointment-card.tsx`, widget |
| AG10 | Botão "+ Novo agendamento" no header da agenda (hoje, próxima hora cheia) + "Ver agenda"/"Abrir agenda" no widget do dashboard | `schedule-client.tsx`, `upcoming-appointments-widget.tsx` |
| AC10 | `revalidatePath('/marketing/leads')` | `update-lead-status.ts` |
| MB1 | Checagem de `.error` nos `Promise.all` de RPCs (supabase-js não rejeita) → o catch P16 volta a funcionar; tela de contrato distingue erro de "não encontrado" com retry | `useFinancialDashboard.ts`, `useContractDetail.ts`, `financial/contract/[id].tsx` |
| MB2 | `students.email` sincronizado SÓ depois do `verifyOtp` (em enter-code) | `verify-email.tsx`, `enter-code.tsx` |
| MB3 | Sino do treinador roteia mensagem p/ `/messages/[studentId]` (fallback aba do treinador) — espelha o push | `notifications/index.tsx` |
| MB6/MB7 | Banner de erro com retry em Leads (padrão P16) + EmptyState não mente em falha; aba "Arquivados" (recupera lead arquivado) | `leads/index.tsx` |
| MB10/MB12 | `automaticallyAdjustKeyboardInsets` no perfil do treinador; layout do Pressable da agenda em View interna (gotcha) | `trainer-profile.tsx`, `agenda/index.tsx` |
| PF4 | Stagger capado (`Math.min(index,8)`) em alunos e conversas | `(trainer-tabs)/students.tsx`, `messages.tsx` |
| **CS1** | **`parseAnchoredDate` no shared**: date-only e timestamps à meia-noite UTC (convenção Asaas) re-ancorados ao meio-dia UTC → vencimento não desloca −1 dia. `formatBrDate/Short` passam a usar. Migrados os 4 pontos de exibição (web sidebar, ContractCard, contrato mobile, AttentionCard). **6 testes novos** | `shared/utils/format-br-date.ts` + teste + 4 displays |
| CS7 | 10 buscas migradas p/ `matchesSearch` (pickers de aluno web+mobile da agenda, programas ×2, leads web, templates mobile, grupos musculares, lista de conversas) | 9 arquivos |
| CS8 | Autosave de notas do relatório: falha vira aviso vermelho "toque para tentar de novo" (retry com o texto retido) | `report/[id].tsx` |
| **PF1** | **Cronômetro isolado em componente-folha** (`TickingDuration`) — o hook não tem mais setInterval/estado `elapsed`; expõe `getDuration()/getElapsedSeconds()` estáveis (snapshot em finish/celebração/feedback). `focusExercise` estabilizado via ref + card memoizado recebe callback estável (chama com o próprio id) | `useWorkoutSession.ts`, `workout/[id].tsx`, `ExecutionExerciseCard.tsx` |

### Validação (pós-lote)

- **web**: `tsc` 0 erros · **vitest 1418 passed, 0 failed** (baseline 1414; +4 popover) · eslint dos arquivos alterados: **0 errors** (3 warnings pré-existentes)
- **mobile**: `tsc` 0 erros · **375 passed, 0 failed** · eslint dos alterados sem findings
- **shared**: **318 passed** (inclui 6 novos de format-br-date e 8 novos da projeção — 36/36 no arquivo)

## 10. EXECUÇÃO — lote M aplicado (11/jul, tarde)

Autorizado ("Pode seguir"). Working tree, NÃO commitado — soma-se ao lote do §9.

| ID | Fix | Detalhe |
|---|---|---|
| **AG2** | **Sync GCal garantido**: os 6 fire-and-forget (`void (async)`) viraram `runAfterResponse()` (`after()` do next/server com fallback pra testes) — a lambda não congela mais antes do sync. Bônus: o bloco do reschedule `once` também MUTAVA a regra num fire-and-forget (podia nunca persistir) — agora garantido. **Cron novo `reconcile-google-sync`** (de hora em hora, :15) reprocessa `google_sync_status IN (pending,error)` de trainers com conexão ativa, parado >10min: ativa→`syncUpdate` (cai pra create/recria em not_found), cancelada com event_id→`syncDelete`. É a "fila real" que o header do sync-service prometia pra V2. Instâncias (exceções) não têm coluna de status — fora do cron. | `lib/run-after-response.ts` (novo), `actions/appointments/core.ts` + `create-recurring-group.ts`, `api/cron/reconcile-google-sync/route.ts` (novo), `vercel.json` |
| **PF2/PF3** | **RPC `get_trainer_conversations` (migration 244) criada e JÁ APLICADA em prod** (validada ao vivo: linhas=alunos ativos, não-lidas batem com agregação direta; guarda service_role/current_trainer_id no padrão 074/149; usa os índices de 090). Web `getConversations` e mobile `useTrainerConversations` agora fazem 1 chamada agregada (antes: TODAS as mensagens sem limit). Realtime web ganhou debounce de 400ms; o incremental do mobile ficou como estava. | `supabase/migrations/244`, `app/messages/actions.ts`, `conversation-list.tsx`, `mobile/hooks/useTrainerConversations.ts` |
| **AC1+AC4** | Reset de senha: página valida o link NA CHEGADA (sessão + `?error/#error`), com estados "validando"/"link inválido ou expirado → Pedir novo link"; troca de senha via server action `updatePasswordSecure` com a MESMA política do signup (mín. 8 + blocklist + HIBP k-anonymity) — recovery deixou de ser bypass. | `actions/auth/update-password.ts` (novo), `app/auth/update-password/page.tsx` |
| **CS5** | `startOfDayTz` ancora a meia-noite no offset REAL do fuso (técnica date-fns-tz, só Intl básico — Hermes ok, com 2ª passada p/ DST); `getWeekRange` tz-aware usa dia-da-semana NO fuso + aritmética pura em ms (fim = domingo 23:59:59.999 DO FUSO — antes `setHours` cortava 3h no runtime UTC); `getISOWeekRange` delega. Na Vercel, treino de domingo à noite volta a contar na semana certa (web ≡ mobile). **6 testes novos** com instantes UTC exatos (falhariam em runtime UTC com o código antigo). | `shared/utils/schedule-projection.ts` + `__tests__/schedule-projection-week.test.ts` (novo) |
| **CS6** | Recorrência mensal re-ancorada no dia de `starts_on` com CLAMP (31/jan → 28/fev → **31/mar**) — `addMonthsUTC` acumulado rolava e derivava permanentemente pro dia 3. **3 testes novos** (deriva, bissexto, dia ≤28 idêntico). | `shared/utils/appointments-projection.ts` + teste |
| **PF6** | Home do aluno: workouts + sessões da semana em **paralelo** (dependem ambos só de `program.id` — 1 roundtrip a menos) e **snapshot MMKV** por usuário (lib/cache) hidratado no mount quando é da MESMA semana → render instantâneo do último estado (stale-while-revalidate; `workoutCounts` Map serializado como entries). | `mobile/hooks/useActiveProgram.ts` |

Validação lote M: web `tsc` 0 · **vitest 1418 passed, 0 failed** · mobile `tsc` 0 · **375 passed** · shared **327 passed** (+9 novos CS5/CS6).

Pós-deploy (automático, sem ação): o cron novo registra no primeiro deploy via `vercel.json`; a RPC 244 já está no banco.

## 11. QA E2E dos lotes (11/jul, noite) — browser real + RPC + cron

Dev server local `:3000` (banco = PROD), conta QA **descartável** (receita do
qa-loop; removida 100% ao final — verificação 0/0/0 em trainers/students/auth,
incl. 3 contas órfãs de rodadas antigas). Chrome de debug dedicado (perfil
efêmero, não toca sessão real). Screenshots em scratchpad da sessão.

**Placar: 22 asserts web + 7 RPC/cron — todos os fluxos dos lotes PASSARAM.**

| Fluxo | Resultado |
|---|---|
| **AG1 (o CRÍTICO) — E2E completo** | Remarcar sáb 04/jul → qua 15/jul: modal fecha ✓ · some da semana original ✓ · semana corrente intacta ✓ · **materializa na semana de destino com badge "Remarcado"** ✓ (destino com 2 cards = remarcada + ocorrência natural do sábado, correto) |
| AG3 presença | Menu "Marcar como concluído/Marcar falta" ✓ · badge **Faltou** ✓ · status vigente oculto no menu ✓ · badge **Concluído** ✓ |
| AG10 | Botão "Novo agendamento" abre o modal de criação ✓ (e fecha) · widget de agendamentos **não faz parte do layout default** de conta nova (dashboard personalizável) — links do widget cobertos pelos testes unitários; no seu dashboard o widget existe |
| CS1 | Contrato manual com `current_period_end` à meia-noite UTC exibe **15/09/2026** (antes exibia 14/09) ✓ |
| AC1 | Com sessão → form; **sem sessão → "Link inválido ou expirado" + "Pedir novo link"** ✓ |
| AC4 | "12345678" rejeitada: "Esta senha é muito comum…" (blocklist/HIBP ativos no reset) ✓ |
| PF2/PF3 dados | RPC com **JWT do trainer (caminho exato do mobile)**: 3 conversas, unread=1, preview e ordenação corretos ✓ · **guarda nega trainer alheio (0 linhas)** ✓ |
| PF3 UI | Painel de mensagens abre, lista carrega via RPC, preview + contador de não-lidas ✓ |
| AG2 cron | `reconcile-google-sync`: sem auth → **401** ✓ · com `CRON_SECRET` → **200** `{"reconciled":0,"reason":"sem conexões ativas"}` (correto: conta QA sem Google) ✓ |
| Console | **Zero erros de console** em todas as rodadas ✓ |

**Não coberto (e por quê):** superfícies mobile em simulador (sem simulador/Metro
de pé; custo alto vs. risco — a RPC mobile foi validada com o fluxo idêntico ao
do hook, e o teste visual em device já era pré-requisito do EAS 1.5.7); sync
GCal com conta Google real (exige conexão ativa — rota e lógica cobertas por
cron-test + unit); registro dos crons no Vercel acontece no primeiro deploy.

### Ressalvas conhecidas (deliberadas, p/ seu teste)

1. **Presença × remarcada**: marcar concluído/faltou numa ocorrência REMARCADA sobrescreve `new_date` (a ocorrência volta ao slot original com o status) — comportamento herdado do `markOccurrenceStatusCore`, idêntico ao MCP. Corrigir exige preservar `new_date` no core + projeção respeitá-lo em completed/no_show. Deixado fora por disciplina cirúrgica — decidir na próxima mexida na agenda.
2. Resumo do WorkoutFeedbackModal agora congela a duração no momento da abertura (antes ticava com a tela) — intencional.
3. AC2 (addCoach sem consentimento) descartado nesta rodada: **Estúdios congelado**. Se a função voltar, reavaliar antes de expor self-serve.
4. Lint FULL do web tem 549 errors/139 warnings pré-existentes (não relacionados ao lote; os arquivos tocados estão limpos).
