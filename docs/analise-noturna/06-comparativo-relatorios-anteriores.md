# Comparativo — Relatórios anteriores vs. código atual

**Data da verificação:** 09/06/2026 (análise noturna, somente leitura)
**Baselines:** `RELATORIO-ANALISE-MOBILE.md` (21/05/2026) e `RELATORIO-ANALISE-WEB.md` (01/06/2026)
**Método:** cada achado foi conferido no código atual (arquivo:linha), cruzado com `git log` desde 20/05 e com `docs/CORRECOES-AUDITORIA-MOBILE.md` / `docs/AUDITORIA-MOBILE-2026-06.md` — sem confiar só na doc; tudo abaixo foi verificado no fonte.

Legenda: ✅ corrigido · 🟡 parcial · ❌ pendente · ❓ não verificável

---

## 1. RELATORIO-ANALISE-MOBILE.md (21/05/2026)

### 🔴 Críticos (13 itens)

| # | Achado original | Status | Evidência atual | Observações |
|---|---|---|---|---|
| 1 | Séries só persistidas no fim (`persistSetLog` aborta sem `sessionId`) | ✅ | `mobile/hooks/useWorkoutSession.ts:335-350` | `persistSetLog` agora cria a sessão preguiçosamente (`await createSession()` na linha 346); se ainda falhar, a série entra no upsert de catch-up do finish. Commit d6f0168 reforçou (C3: erro no upsert final reverte sessão p/ `in_progress` e lança — `:1293-1306`). |
| 2 | `createSession` falha em silêncio (sessão fantasma) | ✅ | `mobile/app/workout/[id].tsx:198-210` | `ensureSession` alerta "Não foi possível iniciar o treino" + volta; dedupe de criação concorrente via `createSessionPromiseRef` (`useWorkoutSession.ts:1045-1057`). |
| 3 | Zero tratamento offline no player | 🟡 | `useWorkoutSession.ts:346-350,1293-1306`; `workout/[id].tsx:731-739` | Erros agora são expostos com retry ("Seu treino não foi perdido") e o upsert é idempotente; mas **não há fila offline-first** — treino 100% sem rede continua sem abrir/sincronizar. Documentado como follow-up em `docs/CORRECOES-AUDITORIA-MOBILE.md`. |
| 4 | `finishWorkout` retorna `undefined` tratado como falha (aluno preso) | ✅ | `useWorkoutSession.ts:1131-1137` + `workout/[id].tsx:731-739` | Sem usuário → `Alert "Sessão expirada"`; erros lançam e o `executeFinish` mantém a tela com mensagem de retry. |
| 5 | Chat: imagens como blocos roxos vazios + upload desabilitado | ✅ | `mobile/components/chat/ChatView.tsx:443`; `mobile/components/chat/ChatImage.tsx:28-49` | Upload reabilitado via `expo-file-system` `File().bytes()`; render via `createSignedUrl` com fallback gracioso (commits 318039a, 99776ae). CORRECOES classificou os blocos vazios como hiccup de rede do simulador; de todo modo há fallback agora. |
| 6 | Cache MMKV global não limpo no logout (PII entre contas) | ✅ | `mobile/contexts/AuthContext.tsx:13,121`; `mobile/lib/logout-cleanup.ts` | `clearUserScopedState()` chamado no `signOut`. Nota: as chaves em `lib/cache-keys.ts:2-6` continuam globais (não escopadas por usuário), mas a limpeza no logout elimina o vazamento descrito. |
| 7 | `signOut` não reseta stores Zustand | ✅ | `mobile/lib/logout-cleanup.ts` (reset de notificações, training-room, program-builder, drafts) | Inclui também `ROLE_KEY` limpo no logout (commit 81e3994, achado M15 da auditoria de jun). |
| 8 | `trainer_id` errado em `trainer_notifications` (auth.uid) | ✅ | `mobile/hooks/usePushNotifications.ts:144-159` | Resolve `trainers.id` via `auth_user_id` antes do insert. |
| 9 | Update de e-mail do aluno usava coluna inexistente `user_id` | ✅ | `mobile/app/(auth)/verify-email.tsx:96` | Agora via RPC `update_student_self_email` (migration no commit e2d724c — resolve também a falta de policy UPDATE, achado M3 de jun). |
| 10 | URLs de backend hardcoded divergentes (`app.kinevo.com.br`) | ✅ | `mobile/lib/config.ts:7-8`; `more.tsx:30,45`; `trainer-subscription-blocked.tsx:9-12`; `usePushNotifications.ts:10` | `WEB_URL` centralizado (`EXPO_PUBLIC_WEB_URL` → fallback `www.kinevoapp.com`). Zero ocorrências de `app.kinevo.com.br` restantes no mobile. |
| 11 | Botão "Remover supersets" não fazia nada | ✅ | `mobile/app/program-builder/index.tsx:246-249`; `stores/program-builder-store.ts:375,1364` | Ação `clearSupersets` implementada e ligada ao `onPress`. |
| 12 | "Gerar link de pagamento" passava `contract_id` como `planId` | ✅ | `mobile/app/financial/contract/[id].tsx:139-158` | Resolve `student_contracts.plan_id` real antes de chamar o checkout. |
| 13 | "Sala de Treino" do perfil do aluno abria vazia | ✅ | `mobile/app/student/[id]/index.tsx:103-116` + `mobile/app/training-room.tsx:373-379` | Navega com `studentId`; a training-room pré-seleciona/abre o picker com o aluno. |

**Críticos: 12 ✅ · 1 🟡 · 0 ❌**

### 🟡 Médios (15 itens)

| Achado | Status | Evidência atual | Observações |
|---|---|---|---|
| Race do rest timer em superset com séries desiguais | 🟡 | `mobile/app/workout/[id].tsx:75-103` | Lógica reescrita (dispara só no último exercício do grupo, checa rodadas restantes), mas ainda compara `_setIndex` contra todos os exercícios do grupo — o pressuposto de séries iguais permanece (reaparece como M6 na auditoria de jun, sem commit dedicado depois). |
| Deep-clone (`JSON.parse(JSON.stringify)`) a cada tecla | ✅ | `useWorkoutSession.ts` — zero ocorrências do padrão | Update imutável raso. |
| `KeyboardAvoidingView behavior="padding"` incondicional | ✅ | `workout/[id].tsx:824` | `Platform.OS === "ios" ? "padding" : undefined`. |
| `onWeekChange={() => {}}` vazio na Home | ❌ | `mobile/app/(tabs)/home.tsx:547` | Handler continua vazio. |
| `volume: 0` hardcoded no share da Home | ❌ | `mobile/app/(tabs)/home.tsx:143` | Card compartilhado da Home segue com volume zerado. |
| Stats do hero do Perfil são placeholders | ❌ | `mobile/app/(tabs)/profile.tsx:220-235` | Comentário explícito mantém placeholder "até Fase 7" (Plano/Status/Treinador). |
| Pull-to-refresh de Mensagens sem spinner | ✅ | `mobile/app/(trainer-tabs)/messages.tsx:224` | `refreshing={isRefreshing}`. |
| Realtime de conversas sem filtro server-side | ✅ | `mobile/hooks/useTrainerConversations.ts:167` | `filter: student_id=in.(...)` + re-subscribe estabilizado (commit 283e05f). |
| Taxas financeiras hardcoded duplicadas | ✅ | `mobile/app/financial/settings.tsx:11` importa `ASAAS_FEES` de `shared/lib/asaas/fees.ts` | Fonte única web+mobile. Valores em si continuam "a calibrar" (decisão de negócio, não bug). |
| `syncWallet` engolia erro | ✅ | `mobile/app/financial/settings.tsx:50-53` | `Alert "Falha ao sincronizar"` + haptic de erro. |
| Feed financeiro cortado em 15 sem paginação | ✅ | `mobile/app/financial/index.tsx:68,81,249` | Paginação incremental "Ver mais" (+15). |
| Gate de assinatura não reativo | ✅ | `mobile/app/(trainer-tabs)/_layout.tsx:24-29,140-142` | Redirect no layout + revalidação via AppState; reforçado por enforcement server-side (migration do commit 710c6bf, achado A1 de jun). |
| Erros do Supabase em inglês | ✅ | `mobile/lib/auth-errors.ts:5`; `(auth)/login.tsx:84` | `translateAuthError` aplicado nas telas de auth/fluxos chave. |
| Domínio de fallback divergente no push | ✅ | `usePushNotifications.ts:10` | Usa `EXPO_PUBLIC_WEB_URL` → `www.kinevoapp.com`. |
| Uso massivo de `as any` | ❌ | `useWorkoutSession.ts` (31), `useProgramBuilder.ts` (32) | Contagens praticamente idênticas ao relatório. Relacionado ao gotcha de `gen:types` truncando `database.ts` (memória do projeto). |

**Médios: 10 ✅ · 1 🟡 · 4 ❌**

### 🔵 Baixos / Polish (16 itens)

| Achado | Status | Evidência atual | Observações |
|---|---|---|---|
| Capitalização de datas inconsistente (Saúde, calendário do aluno) | 🟡 | Saúde corrigida (`(tabs)/health.tsx:32` — sentence case explícito); **calendário do detalhe ainda não**: `components/trainer/student/SessionHeatmap.tsx:309` usa `textTransform: "capitalize"` sobre `month: "long"` → continua renderizando "Maio De 2026" | CORRECOES afirma "fim de Maio De 2026", mas o código do heatmap (usado em `StudentOverviewTab`) mantém o capitalize por palavra. |
| Botão "Novo agendamento" quase invisível | ✅ | Fix sistêmico do `Pressable` style-função (commit eed2976; `AgendaDayView`, `CreateAppointmentSheet` etc. com estilos estáticos) | Causa raiz RN 0.81/Fabric documentada em CORRECOES. |
| FAB "+" da Agenda no canto errado | ✅ | `mobile/app/agenda/index.tsx:122-128` (`right: 20`) | Padronizado à direita. |
| Texto em inglês no Financeiro ("at R$ 1.00 / month") | ❓ | — | CORRECOES verificou que era **dado** (nome de plano de teste), não código. Reaparece como B4 na auditoria de jun (string crua de descrição) — vale sanitizar a exibição. |
| Unidade de volume inconsistente (`29.8t` vs `8.7 ton`) | ✅ | `components/history/WeekGoalCard.tsx:122` (`unit="t"` via `formatTon`) | Unificado em "t". (Auditoria de jun apontou caso novo: VOLUME sem unidade na tela de logs — achado distinto.) |
| Hierarquia de abas densa em Formulários (3 níveis) | ❌ | `mobile/app/(trainer-tabs)/forms.tsx:60-87` | Estrutura segmento→sub-tab→filtro mantida (decisão de design, não foi mexida). |
| Emoji como ícone (🔥/📅, viola CLAUDE.md) | 🟡 | `KStreakBadge.tsx:16` usa `Flame` (Lucide) ✅; `IntensityBadge.tsx:4` removeu a chama ✅; **pendentes:** `KCelebration.tsx:85` (`emoji: '🔥'`) e `lib/healthInsights/rules.ts:210` (`emoji: '📅'`) | Insights de saúde documentados como follow-up (exige refatorar modelo de dados). |
| "Google Health Connect" listado no iOS | ✅ | `(tabs)/health.tsx:294` | Filtrado por plataforma (Android only). |
| Card de conquista sempre `locked` | ✅ | `(tabs)/home.tsx:741-757` | `locked` agora condicional (streak/milestone). |
| Dark mode: hex hardcoded em telas legadas | 🟡 | `training-room.tsx` (11 hex), `financial/index.tsx` (16), `student/[id]/index.tsx` (6), `forms.tsx` (2) | Houve varreduras (commits f4326a9, ac404ab, e058518, 6eb73d8 — paywall agora segue tema), mas dezenas de literais permanecem nas telas legadas. Follow-up documentado (exige QA visual por tela). |
| WhatsApp de suporte placeholder | ✅ | `mobile/app/profile/support.tsx:8` (`5531999064997`) | TODO removido; número real. |
| `console.error/warn` não-guardados (21×) | 🟡 | ~15-16 ocorrências sem `__DEV__` restantes em `mobile/app|hooks|components` | Gateados nas telas-chave (player, auth); restam em telas secundárias. |
| Rota `/debug-logs` navegável | ✅ | `mobile/app/debug-logs.tsx:28` | `if (!__DEV__) return <Redirect href="/" />`. |
| `app_version: "1.0.0"` hardcoded | ✅ | `mobile/app/inbox/[id].tsx:317` | `Constants.expoConfig?.version ?? "unknown"`. |
| Fallback de `is_trainer` rebaixava treinador | ✅ | `contexts/RoleModeContext.tsx:179-185` | Catch agora restaura o papel salvo (SecureStore) em vez de assumir aluno; reforçado por c4167b3 e f7cdf89 (não desloga em falha transitória de keychain). |

**Baixos/Polish: 9 ✅ · 4 🟡 · 1 ❌ · 1 ❓ (não era bug de código)**

---

## 2. RELATORIO-ANALISE-WEB.md (01/06/2026)

### 🔴 Alta

| Id | Achado original | Status | Evidência atual | Observações |
|---|---|---|---|---|
| A1 | Treinos VAZIOS podem ser atribuídos ao aluno | ✅ | `web/src/components/programs/program-builder-client.tsx:359-361,1102,1527-1530,2654` | Ao ativar, filtra treinos sem exercício/superset/cardio e exibe `emptyWorkoutWarning` com confirmação; há também remoção automática de treinos vazios (`removeEmptyWorkouts`, linha ~1102). Commit 1923413. |

### 🟠 Média

| Id | Achado | Status | Evidência atual | Observações |
|---|---|---|---|---|
| A2 | Atrito dos "3 treinos por padrão" + validação de dias | ✅ | `web/src/types/prescription-preferences.ts:81` (`default_workout_count: 1`) + remoção de vazios no builder | Default caiu de 3 → 1; treinos vazios deixam de travar a ativação (A1). |
| A3 | Validação do nome DEPOIS do modal de arquivamento | ✅ | `program-builder-client.tsx:1919-1929` | Comentário explícito: "Validate name first — before the archive-confirm modal". Commit 0cf2236. |
| A4 | Contagem de "alunos ativos" divergente (lista × dashboard) | ✅ | `web/src/app/students/students-client.tsx:166-168` | Lista agora exclui `is_trainer_profile`, alinhada ao dashboard. Commit 7812161. |
| A5 | "0 virouam aluno" no Marketing | ✅ | `web/src/app/marketing/page.tsx:161` | `'Nenhum virou aluno' / '1 virou aluno' / 'N viraram alunos'` — trata 0, 1 e plural. |
| A6 | "Enviar reavaliação" no empty state | ✅ | `web/src/components/students/health-metrics-card.tsx:218` ("Enviar avaliação" no vazio) vs `:263` ("Enviar reavaliação" com histórico) | Labels distintos por contexto. |

### 🟡 Baixa / Polish

| Id | Achado | Status | Evidência atual | Observações |
|---|---|---|---|---|
| B1 | `console.log` de debug no builder | ✅ | Zero `console.log` em `program-builder-client.tsx` | Commit 47e41a7. |
| B2 | Warning "getSession ... could be insecure" a cada navegação | ❌ | `web/src/lib/supabase/middleware.ts:39-45` (`getSession()` + `session?.user`) | Mantido **conscientemente** por performance (comentário documenta o trade-off de ~100-200ms), mas o ruído de log ERROR descrito no relatório deve persistir. Se incomodar, silenciar/encapsular. |
| B3 | `/messages` é rota morta (redirect) | 🟡 | `web/src/app/messages/page.tsx:4` (`redirect('/dashboard')`) | Sem mudança — o próprio relatório considerou "ok manter". Registrado como aceito por design. |
| B4 | `/students/[id]/program/[programId]` 404 | ✅ | `web/src/app/students/[id]/program/[programId]/page.tsx:13-15` | Página de redirect para `/edit` criada. |
| B5 | CSP bloqueia Vercel Speed Insights | ✅ | `web/next.config.ts:78-84` | Dev permite `va.vercel-scripts.com`; em prod o script vem de `'self'` (`/_vercel/speed-insights/`). |
| B6 | Footer duplicado no /signup | ✅ | `web/src/components/auth/auth-layout.tsx:124-130` | Badge de segurança agora `lg:hidden` (uma ocorrência por viewport). |
| B7 | Visão semanal esconde treinos coincidentes no mesmo dia | ✅ | `web/src/components/students/program-calendar.tsx:201` e `weekly-performance-tracker.tsx:133` | `map(...).join(' · ')` lista todos os treinos do dia. |
| B8 | `scheduled_days` não ordenados | ✅ | `web/src/app/students/[id]/actions/assign-program.ts:144-145` | `[...scheduledDays].sort((a, b) => a - b)` na atribuição. |
| B9 | Checklist "Primeiros Passos" com progresso divergente entre páginas | ✅ | `web/src/components/onboarding/onboarding-provider.tsx` (commit 47e41a7: "no longer resets the checklist to defaults on pages that don't load onboarding state") | Verificado pelo diff do commit; comportamento em runtime não re-testado nesta análise. |
| B10 | Grafia `"presential"` (24 ocorrências) | ❌ | `grep -rn "presential" web/src` → **24 ocorrências** (ex.: `src/actions/create-student.ts`, `src/components/student-modal.tsx`) | Inalterado. Naming interno apenas (usuário vê "Presencial"); migrar exigiria tocar dados persistidos — avaliar custo/benefício. |
| B11 | Badge "Ativo" no empty state do Programa Atual | ✅ | `student-detail-client.tsx` — badge "Ativo" removido do estado vazio (commit 47e41a7); o badge "Fila" restante (linha ~625) rotula "Próximos Programas", coerente | — |

### Item de limpeza (seção 0 do relatório web)

| Item | Status | Observações |
|---|---|---|
| Conta de teste `qa-teste-kinevo@example.com` em produção (trainer `b7787ab5-…`, aluna `maria-aluna-qa@…`, programas/templates QA) | ❓ **verificação pendente em banco** | Nenhuma menção à remoção em código, docs, migrations ou commits (`grep -r "qa-teste-kinevo"` só encontra o próprio relatório). Não há evidência de que foi apagada. **Ação manual recomendada:** conferir/remover no Supabase `lylksbtgrihzepbteest`. |

---

## 3. Resumo

### Contagem por relatório e severidade

**Mobile (21/05) — 44 achados rastreáveis:**

| Severidade | ✅ Corrigido | 🟡 Parcial | ❌ Pendente | ❓ N/V |
|---|---|---|---|---|
| 🔴 Crítico (13) | 12 | 1 (offline do player) | 0 | 0 |
| 🟡 Médio (15) | 10 | 1 (timer superset) | 4 | 0 |
| 🔵 Baixo/Polish (16) | 9 | 4 | 1 | 1 |
| **Total (44)** | **31 (70%)** | **6** | **5** | **1** |

**Web (01/06) — 17 achados + 1 limpeza:**

| Severidade | ✅ Corrigido | 🟡 Parcial/Aceito | ❌ Pendente | ❓ N/V |
|---|---|---|---|---|
| 🔴 Alta (1) | 1 | 0 | 0 | 0 |
| 🟠 Média (5) | 5 | 0 | 0 | 0 |
| 🟡 Baixa (11) | 8 | 1 (B3, por design) | 2 (B2, B10) | 0 |
| Limpeza (1) | 0 | 0 | 0 | 1 (conta QA) |
| **Total (18)** | **14 (78%)** | **1** | **2** | **1** |

### Pendentes que merecem prioridade

1. **❓ Conta QA em produção (web, seção 0)** — único item com possível dado real órfão em prod; sem qualquer evidência de remoção. Verificar no banco e apagar.
2. **🟡 Offline do player (mobile crítico #3)** — o pior cenário (perda silenciosa) foi eliminado, mas treino sem rede continua inviável; é o gap crítico remanescente de maior impacto no aluno. Follow-up já reconhecido em CORRECOES ("fila offline-first").
3. **❌ `as any` massivo (mobile médio)** — sem progresso (31/32 ocorrências nos dois hooks principais); foi exatamente o que mascarou os bugs de ID dos críticos 8/9. Depende de regenerar `database.ts` (ver gotcha do `gen:types`).
4. **🟡 Timer de superset com séries desiguais (mobile médio)** — pressuposto de séries iguais persiste (M6 da auditoria de jun continua aberto).
5. **❌ Trio da Home do aluno** — `onWeekChange` vazio (`home.tsx:547`), `volume: 0` no share (`home.tsx:143`) e stats placeholder do Perfil (`profile.tsx:220-235`): visíveis ao usuário, baixo custo.
6. **🟡 Dark mode legado + datas no heatmap** — varreduras avançaram, mas `SessionHeatmap.tsx:309` ainda renderiza "Maio De 2026" e telas legadas mantêm 2-16 hex hardcoded cada.
7. **❌ B2 (web)** — warning `getSession` a cada navegação: decisão consciente, mas vale silenciar para limpar os logs de produção.

> Nota: a auditoria de **junho** (`docs/AUDITORIA-MOBILE-2026-06.md`) gerou uma nova rodada de achados (C1-C5, A1-A14, M1-M20, B1-B10) cuja quase totalidade foi endereçada nos commits de 08/06 (d6f0168 … 710c6bf); ela não é o baseline deste comparativo, mas seus fixes explicam boa parte das correções verificadas acima.
