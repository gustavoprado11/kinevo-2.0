# Loop Mobile (Expo/RN) — 2026-06-14

## Resumo

- **18 achados** verificados contra código. Por verdict: **14 confirmados**, **2 mitigados**, **1 by_design**, **1 confirmado/baixo sem impacto visível**. Nenhum *uncertain* ou *false_positive*.
- Confirmados por severidade: **5 altos** (descarte offline, finish Watch ressuscita abandoned, finish offline impossível no celular, gate de bloqueio sem backstop RLS ×2), **5 médios**, **4 baixos**.
- **9 viraram fix** (fixWorthy=true). 5 confirmados não geram fix (sem impacto prático ou by_design).
- **Nota:** deploy mobile é via build EAS — nenhuma correção entra em produção automaticamente; exige build + submit. (O fix #1 de RLS é a exceção: server-side, deployável via migration.)

---

## 🔴 Achados confirmados (verdict=confirmado) — critico→baixo

| Sev | Área | Título | Evidência (file:line) | Impacto |
|---|---|---|---|---|
| 🔴 alto | Gate/RLS | Gate inadimplência/desativação sem backstop RLS; `/workout/[id]` sem gate client | `migrations/162:23-33` (RLS só checa `access_blocked_at`); `useStudentAccess.ts:28-46`; `home.tsx:420` (único gate); `workout/[id].tsx` grep vazio | Aluno `blocked`/`inactive`/`archived` ou `past_due+block_on_fail` (antes do cron) lê e executa treino via deep-link/Watch, gravando set_logs/sessions |
| 🔴 alto | Gate/RLS | Gate só no client; `workout/[id]` e Watch START_WORKOUT sem checagem; RLS cobre só `access_blocked_at` | `home.tsx:419-422`; `_layout.tsx:188-194` (push sem gate), `:150-157` (insert sem gate); `current_student_id_active()` só filtra `access_blocked_at IS NULL` | Mesma lacuna semântica pelo caminho Watch/insert de sessão; mitigado só para `access_blocked_at`, não para status/Stripe |
| 🔴 alto | Treino offline | Descartar treino offline não persiste — DELETE/UPDATE fire-and-forget; A2 reincorpora séries no finish | `useWorkoutSession.ts:434-444` (erro só logado `__DEV__`), reattach `:559-593`, catch-up finish `:1450-1476`; comentário `workout/[id].tsx:452-454` | Offline a sessão fica `in_progress` com set_logs intactos → rehidrata e reincorpora no finish (volume inflado / PR falso) |
| 🔴 alto | Watch/finish | Finish canônico do Watch sobrescreve status sem guarda — ressuscita `abandoned`→`completed` | `finishWorkoutFromWatch.ts:235-244` (sem `.eq('status','in_progress')`); set_logs voltam pelo upsert `:372-397`; triggers não barram | Treino descartado pelo aluno reaparece `completed` no histórico e re-dispara notificação ao treinador |
| 🔴 alto | Finish offline | Finalizar treino impossível offline no celular — só o Watch tem fila durável de finish | `useWorkoutSession.ts:1402-1408`/`1471-1491` (throw); Alert em `workout/[id].tsx:758-766`; única fila durável é Watch `finishWorkoutFromWatch.ts:58-127` | Sem rede o aluno fica preso na tela com alerta repetido; sem perda de dados (snapshot MMKV persiste) mas sem celebração/progresso |
| 🟠 médio | Watch/discard | discardWorkout apaga set_logs sem guarda de status — sessão `completed` do Watch vira treino-fantasma | `useWorkoutSession.ts:434-437` (DELETE sem `.eq('status')`); UPDATE guardado `:440-444` vira no-op | Corrida sub-segundo: sessão `completed` com zero séries no histórico |
| 🟠 médio | Watch/durabilidade | WCSessionRelay (persist-first) está morto — `activate()` nunca chamado; durabilidade de cold-launch inexistente | `WatchConnectivityModule.swift:78-90` (sem call de `activate()`); delegate real é `SessionDelegate:353`→buffer só em memória `:692` | Eventos não-reenviáveis (WORKOUT_HEALTH_SAMPLES, SET_COMPLETE) perdidos se app morre na janela de bootstrap; robustez documentada é ilusória |
| 🟠 médio | Perf | Tela de execução re-renderiza toda a lista de cards (nenhum memoizado) a cada tecla | `useWorkoutSession.ts:923-967` (`setExercises` por keystroke); `workout/[id].tsx:861-1047` IIFE sem useMemo; ExerciseCard/SupersetGroup/SetRow sem `React.memo` | Jank por keystroke em treinos com 8+ exercícios |
| 🟠 médio | Perf | Render list do treino reconstruída no corpo do JSX a cada render (não memoizada) | `workout/[id].tsx:861-960` IIFE (forEach+map+filter+sort+headers); useMemo só em `:331` | Transformação O(n)/O(n² por superset) roda a cada tecla/check |
| 🟠 médio | Perf | Aba Histórico renderiza timeline inteira via `.map` em ScrollView (sem virtualização), query sem limite | `logs.tsx:236-255` (ScrollView), `:402-417` (map), `:364` (buildTimeline sem memo), `:408` (stagger linear); `useWorkoutHistory.ts:94-125` sem `.limit()` | Monta em tempo crescente; jank acumula com nº de sessões |
| 🟠 médio | Push | Android sem notification channel explícito — heads-up/som não garantidos em background | `usePushNotifications.ts:108-264` (sem `setNotificationChannelAsync`); `app.json:80-86`/`:101-102` (minSdk 26) | Pushes em background/killed caem no canal default (importância DEFAULT) |
| 🟡 baixo | Watch/discard | Discard pelo Watch deixa set_logs órfãos na sessão abandonada (sem impacto visível) | `_layout.tsx:293-298` (só update status) vs `useWorkoutSession.ts:432-444`; histórico filtra `status!=='completed'` `useWorkoutHistory.ts:138` | Órfãos invisíveis; snapshot não ressuscita — **sem fix** |
| 🟡 baixo | Privacidade | Stores MMKV com PII de alunos sem `encryptionKey` (texto claro no disco) | `training-room-store.ts:14`, `program-builder-store.ts:21`, `assessmentDraftStore.ts:20`/`:62`, `cache.ts:15` | At-rest only sob jailbreak/root; tokens em Keychain, logout limpa stores — **sem fix** |
| 🟡 baixo | Watch/health | Health samples (HR/calorias) fora da fila de reenvio do FINISH | `WorkoutExecutionView.swift:432-447`; resend só FINISH `WorkoutExecutionStore.swift:156-191`, `KinevoWatchApp.swift:158-172` | Perda de enriquecimento HR se app morre na janela síncrona pós-markFinishPending — **sem fix** |

---

## 🛠️ Prompts de fix prontos (fixWorthy=true)

> Os prompts completos (11 fixes) estão preservados no resultado do workflow desta run. Resumo dos alvos:
> 1. **Gate inadimplência/desativação no servidor (alto)** — redefinir `current_student_id_active()` para excluir `status IN ('blocked','inactive','archived')` + gate client em `workout/[id].tsx`.
> 2. Unificar gate servidor incluindo Watch START_WORKOUT (médio).
> 3. Descarte offline durável — fila MMKV `discard_session` (alto).
> 4. Guarda de status no finish canônico do Watch — `.eq('status','in_progress')` (alto).
> 5. Finalização offline durável no celular — fila de finish (alto).
> 6. `discardWorkout` atômico em relação ao status (médio).
> 7. Memoizar cards e callbacks da tela de execução (médio).
> 8. Memoizar render list do treino (médio, junto com #7).
> 9. Virtualizar aba Histórico — FlatList/FlashList + limit (médio).
> 10. Notification channel Android explícito (médio).
> 11. Reviver/persistir WCSessionRelay (médio, valida em device).

## 🗑️ Refutados (mitigado / by_design / sem impacto)

| Título | Verdict | Mecanismo que protege (file:line) |
|---|---|---|
| Discard pelo Watch deixa set_logs órfãos | confirmado/sem impacto | Histórico filtra `status!=='completed'` (`useWorkoutHistory.ts:138`), stats exige `completed`; snapshot não ressuscita |
| Stores MMKV com PII sem encryptionKey | confirmado/sem fix | Tokens em Keychain; logout limpa stores (`logout-cleanup.ts:20-64`); risco só at-rest sob jailbreak/root |
| Health samples HR fora da fila de reenvio | confirmado/sem fix | FINISH protegido por fila no Watch; buffer UserDefaults cobre sessão recuperada |
| `useV2Colors` por item de lista | mitigado | Trecho caro dentro de `useMemo` com deps estáveis (`useV2Colors.ts:35-60`) |
| `persistSetLog` lê sessionId de state | mitigado | `createSession()` backstop (`:359-366`); fila offline só em erro real |
| `useLiveActivity` dep `exercises.length>0` | by_design | Efeito UPDATE separado cuida do pós-swap; START guardado por `isActiveRef` |
| `RestTimerOverlay` `useCallback([],)` congela closure | confirmado/sem fix | Benigno no caller principal; só afeta troca simultânea na training-room (raro) |
