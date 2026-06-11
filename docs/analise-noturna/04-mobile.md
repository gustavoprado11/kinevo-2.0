# Análise noturna — Mobile (Expo/React Native)

**Data:** 09/06/2026 · **Branch:** main · **Método:** somente leitura (código + git log + docs)
**Baselines consultados:** AUDITORIA-MOBILE-2026-06.md, CORRECOES-AUDITORIA-MOBILE.md, comparativo 06, paridade-treinador-web-mobile.md, Diagnostico_Push_Notifications.md.
**Working tree:** único arquivo modificado é `mobile/app.json` — diff é só bump de versão `1.5.2 → 1.5.3` (benigno, preparação de release).

Foco em achados **novos** ou divergências; correções da leva de 08/06 foram verificadas no fonte (seção "Verificado e OK" no fim).

---

## 1. ACHADOS — Player de treino (tela mais crítica)

### A1 · ALTO — "Descartar treino" não descarta nada: sessão e set_logs persistidos sobrevivem e contaminam o próximo treino
- **Arquivo:** `mobile/app/workout/[id].tsx:408-448` (beforeRemove) + `mobile/hooks/useWorkoutSession.ts:491-504` (reattach)
- **Evidência:** o diálogo "Descartar Treino? … todo o progresso atual será perdido" apenas navega de volta (e avisa o Watch). A `workout_session` fica `in_progress` no banco e os `set_logs` já persistidos incrementalmente (persistSetLog grava a cada check) **não são apagados**. Ao reabrir o mesmo treino, o fetch reanexa a sessão existente (`useWorkoutSession.ts:491-504`) — e no finish o upsert de catch-up só sobrescreve os `set_number` re-marcados; os descartados continuam `is_completed=true`.
- **Impacto:** aluno descarta um treino mal começado, treina de novo à noite → o treino final inclui séries "descartadas" (volume inflado, PR falso, duração errada). A mensagem do diálogo é literalmente o oposto do que acontece (nada é perdido; pior, é mantido). Mitigação parcial: cleanup de sessões `in_progress` >24h (`app/_layout.tsx:316-343`) — mas a janela do mesmo dia é exatamente o caso comum.
- **Correção sugerida:** ao confirmar descarte, deletar os `set_logs` da sessão e marcar a sessão `abandoned` (ou deletá-la). É o irmão do C4 (swap) que já foi corrigido com a mesma técnica.

### A2 · ALTO — Reanexar sessão `in_progress` não rehidrata as séries já persistidas
- **Arquivo:** `mobile/hooks/useWorkoutSession.ts:491-504` + `:683` (`createInitialSets`)
- **Evidência:** quando uma sessão `in_progress` é encontrada, só `sessionId` e `started_at` são reaproveitados; `setsData` nasce vazio (`createInitialSets`). Os `set_logs` já gravados não são lidos de volta.
- **Impacto:** app morto/reaberto no meio do treino → tela mostra "0/23 séries" embora 10 estejam no banco; o aluno re-marca (ok, upsert idempotente) ou desiste achando que perdeu tudo. Combinado com A1, é também o mecanismo que torna os dados fantasma invisíveis. O timer exibido também zera (ver M4).
- **Correção sugerida:** no reattach, `select` em `set_logs` da sessão e pré-popular `setsData` (peso/reps/completed). O A14 (started_at real) já criou o gancho (`sessionStartedAtRef`).

### A3 · ALTO — Caminho do Watch: falha no upsert de `set_logs` é engolida após a sessão virar `completed` (C3 corrigido no telefone, mas não aqui)
- **Arquivo:** `mobile/lib/finishWorkoutFromWatch.ts:388-401` (e `:461-475` cardio)
- **Evidência:** os passos 1-6 fazem queue-and-retry exemplar (fila em SecureStore, dedupe, sessionId canônico). Mas no passo 7, se o upsert dos `set_logs` falhar, é só `console.error` — a sessão já está `completed`, `watchFinishState.markFinished()` roda e a entrada **não** volta pra fila de pendentes. No telefone o mesmo bug (C3) foi corrigido revertendo a sessão pra `in_progress` e lançando; aqui não.
- **Impacto:** blip de rede no exato momento do relay telefone→Supabase → treino do Watch aparece como concluído com 0 séries, sem retry. Perda silenciosa e permanente.
- **Correção sugerida:** em `logsError`, `savePendingWorkout(payload)` e retornar `'pending'` (a fila já é idempotente), ou reverter a sessão como no C3.

### M1 · MÉDIO — Timer de descanso do superset dispara fora de hora (M6 da auditoria de junho segue aberto)
- **Arquivo:** `mobile/app/workout/[id].tsx:79-103`
- **Evidência:** o gatilho é "completou uma série do exercício **posicionalmente último** do grupo". Dois problemas: (a) se o aluno marca o último exercício antes do(s) primeiro(s) da mesma rodada (ordem livre é comum em estação dupla), o timer dispara com a rodada incompleta; (b) com séries desiguais entre exercícios do grupo, `hasRemainingRounds` compara `i > _setIndex` em todos os exercícios — funciona por acaso na maioria dos casos, mas o pressuposto de contagens iguais permanece. O contador visual ("Rodada X de Y" em `SupersetGroup.tsx:19-32`) já trata séries desiguais corretamente — só o timer ficou pra trás.
- **Correção sugerida:** disparar quando **a rodada N inteira** estiver completa (mesma lógica do `computeRoundInfo`), em vez de posição do exercício.

### M2 · MÉDIO — Efeitos colaterais dentro do updater de `setExercises` (M16 segue aberto)
- **Arquivo:** `mobile/hooks/useWorkoutSession.ts:800-844` (`handleToggleSetComplete`) e `:846-888` (`applyWatchSetCompletion`)
- **Evidência:** `persistSetLog`, `deletePersistedSetLog`, `onSetComplete` (timer+haptics) e `onEmptySetLogged` são chamados **dentro** da função passada ao `setExercises`. React 19 pode reexecutar updaters; o upsert é idempotente (mitiga), mas timer/haptics duplicados não são, e é terreno fértil pra bug futuro.
- **Correção sugerida:** computar o próximo estado, chamar `setExercises(next)` e disparar os efeitos fora do updater.

### M3 · MÉDIO — Tela inteira do player re-renderiza a cada segundo; nenhum componente de treino é memoizado
- **Arquivo:** `mobile/hooks/useWorkoutSession.ts:419-424` (`elapsed` em state, interval 1s) + `mobile/app/workout/[id].tsx:834-1020` (IIFE que reconstrói/re-ordena `renderItems` a cada render) + `components/workout/ExerciseCard.tsx`/`SetRow.tsx`/`SupersetGroup.tsx` (sem `React.memo`)
- **Evidência:** `duration` muda 1×/s → re-render do screen → rebuild da lista (sort, maps) e re-render de todos os cards/inputs. Props inline (`onSetChange={(si,f,v)=>…}`) inviabilizariam memo de qualquer forma.
- **Impacto:** treinos longos (20+ exercícios com supersets/métodos) em aparelhos modestos: jank ao digitar peso/reps enquanto o relógio anda; consumo de bateria.
- **Correção sugerida:** isolar o relógio num componente folha (só ele assina `elapsed`); memoizar `renderItems` por `exercises/workoutNotes`; `React.memo` em ExerciseCard/SetRow com callbacks estáveis.

### M4 · MÉDIO — Timer exibido zera ao retomar sessão (A14 corrigiu o dado persistido, não o display)
- **Arquivo:** `mobile/hooks/useWorkoutSession.ts:138,419-424,1370`
- **Evidência:** `elapsed` é calculado de `startTime` (mount). Ao reanexar, `sessionStartedAtRef` guarda o início real e o **finish** persiste a duração certa — mas o header mostra `00:00` e a celebração/share usam `duration` do display (`[id].tsx:684,712`), divergindo do que foi salvo.
- **Correção sugerida:** basear `elapsed` em `sessionStartedAtRef.current ?? startTime`.

### B1 · BAIXO — Sessão `in_progress` é criada mesmo pra treino sem exercícios
- **Arquivo:** `mobile/app/workout/[id].tsx:212-223` + `:1022-1026`
- **Evidência:** `ensureSession()` roda independente de `exercises.length`; com treino vazio o aluno vê o empty state, volta, e fica uma sessão órfã (limpa só no cleanup de 24h).
- **Correção:** não criar sessão quando `exercises.length === 0`.

### Fricção de registro (avaliação qualitativa — sem bug novo)
- **Caminho feliz é bom:** com alvo prescrito ou histórico, registrar uma série = **1 toque** (check herda placeholder — fix C1 verificado em `useWorkoutSession.ts:188-208,807-832`), com haptic Medium no check (`SetRow.tsx:67`), aviso não-bloqueante quando fica 0×0 (`[id].tsx:1032-1061`), rest timer com Live Activity, ajuste de tempo e haptic de término (`RestTimerOverlay.tsx:47`). Teclados corretos (`decimal-pad`/`number-pad`).
- **Métodos avançados:** pirâmide/drop/cluster têm waterfall desligado quando o scheme é heterogêneo (`useWorkoutSession.ts:33-57`), descanso per-set (`[id].tsx:110-112`) e agrupamento por rodada com fallback posicional (M5 corrigido — `ExerciseCard.tsx:118-136`). UX de registro em si está em paridade com o prescrito.
- **Sem toasts/undo:** desmarcar série deleta o log (C2 ok), mas não há "desfazer"; falha do `persistSetLog` é silenciosa por design (catch-up no finish) — aceitável dado o C3 corrigido.

---

## 2. OFFLINE — estado real

### A4 · ALTO — Treino 100% sem rede continua inviável; não existe fila de sync no telefone (gap conhecido, segue o nº 1 em impacto no aluno)
- **Arquivos:** `mobile/app/workout/[id].tsx:199-210` (`ensureSession` falha → Alert → `router.back()`); `useWorkoutSession.ts:344-353` (série sem sessão fica só em memória); `:1286-1306` (finish offline lança, sessão revertida, retry manual)
- **Estado real verificado:** (1) **iniciar** treino offline é impossível — o app manda de volta pra Home; (2) **cair offline no meio**: séries marcadas ficam em memória e são re-sincronizadas no finish (upsert idempotente) — mas **matar o app perde** tudo que não subiu, porque nada do player é persistido localmente (ironia: o **Watch** persiste estado em JSON atômico — `targets/watch-app/Services/WorkoutStatePersistence.swift` — e tem fila de pendentes em SecureStore; o telefone não tem nenhum dos dois); (3) **finalizar offline**: erro exposto com "Seu treino não foi perdido", correto enquanto a tela viver.
- **`sync_status` é teatro:** gravado hardcoded `'synced'` nos 5 pontos de escrita (`useWorkoutSession.ts:531,1102,1182`, `finishWorkoutFromWatch.ts:320`, `_layout.tsx:142`). A coluna existe pra offline-first e nunca recebe outro valor.
- **Correção sugerida:** espelhar o padrão do Watch no telefone — snapshot do estado do player em MMKV a cada mutação + fila de `set_logs` pendentes drenada por listener do NetInfo. É o follow-up já reconhecido em CORRECOES; registro aqui que o building block (NetInfo + MMKV + upsert idempotente) já está todo no app.

### Mapa por tela sem rede (verificado no código)
| Tela | Comportamento offline |
|---|---|
| Home aluno | `useActiveProgram` não tem cache persistente (só cache em memória de sessões) e o `error` retornado **não é renderizado** (`home.tsx:79` é o único uso) → tela fica no estado vazio/esqueleto sem mensagem. Só o banner global de conexão (`_layout.tsx:460`) avisa. **MÉDIO** |
| Player | Ver A4 acima |
| Chat | Envio falha com Alert claro e texto preservado (A13 corrigido, `ChatView.tsx:186-215`); histórico não é cacheado → lista vazia offline. **BAIXO** |
| Dashboard treinador / Alunos / Exercícios / Detalhe aluno | `useCachedQuery` (MMKV, TTLs em `lib/cache-keys.ts`) → renderiza do cache na hora, revalida quando online, e mostra "Sem conexão e sem dados salvos" no cold start offline. **OK — é o padrão que o resto do app deveria seguir** |
| Logs/histórico, Financeiro, Inbox | Fetch direto sem cache → vazio offline. **BAIXO/MÉDIO** |

- **netinfo:** instalado e usado **só** em `hooks/useNetworkStatus.ts` → `ConnectionBanner` global + gate do `useCachedQuery`. Deveria também: pausar/drenar fila do player (quando existir), suprimir retries do chat e do `persistSetLog`, e evitar o Alert de `ensureSession` quando se sabe que está offline (mensagem específica).

---

## 3. BACKGROUND FETCH E NOTIFICAÇÕES

### Background fetch — só para saúde, design correto
- `expo-background-fetch` + `expo-task-manager` usados exclusivamente pro sync incremental de saúde (`lib/healthSyncTask.ts`): intervalo mínimo 12h, retry exponencial 1h→2h→4h→desiste até o próximo slot, estado em MMKV, Strava em best-effort isolado. Registro gated por status (Denied/Restricted) em `GlobalOverlays` (`_layout.tsx:445-457`).
- **Confiabilidade:** depende das heurísticas do iOS (sem garantia de execução); o app compensa com sync em foreground (`useHealthConnectSync`/telas de saúde). Razoável. Nenhum uso para sync de treino — coerente com a ausência de fila (A4).

### Push — causa raiz do diagnóstico de maio RESOLVIDA
- O Diagnostico_Push_Notifications.md apontava `projectId` lido só de `process.env.EXPO_PUBLIC_EAS_PROJECT_ID` (undefined em prod) → token nunca gerado. **Verificado corrigido:** `usePushNotifications.ts:22-27` resolve `Constants.expoConfig.extra.eas.projectId` primeiro (presente em `app.json:121` = `3bfbd791-…`), legacy e env como fallback. Registro idempotente no backend com Bearer (`:75-100`), role-aware, `trainers.id` resolvido certo (fix de maio).
- **B2 · BAIXO — Permission prompt no boot:** `registerForPushNotificationsAsync` pede permissão no primeiro mount do `PushNotificationBridge` (no app start), sem tela de priming — taxa de aceite tende a ser menor. Sugestão: pedir após o primeiro treino concluído/onboarding.
- Deep links de notificação para rotas de treinador sem gate local (A1 de junho) ficaram aceitáveis porque o enforcement virou server-side (migration 177).

---

## 4. HEALTHKIT / APPLE WATCH

### O que é coletado e onde é usado (verificado de ponta a ponta)
- **HealthKit/Health Connect (diário):** sono, passos, FC repouso, HRV (SDNN), energia ativa, distância (`lib/healthSync/healthKitSync.ts:29-34`) → `daily_sleep_samples`, `daily_activity_samples`, `hr_resting_samples`, `hrv_samples` + `readiness_scores` recomputado (`lib/healthSync/shared.ts:93-120`). **Consumido de fato:** aba Saúde (`(tabs)/health.tsx`, `health/[metric].tsx`), ReadinessCard/InsightStrip, e o **PreWorkoutReadinessSheet** que pode sugerir reagendar o treino (`workout/[id].tsx:164-191`, `usePreWorkoutDecision`). Não é coleta morta.
- **Watch (por treino):** FC média/máx/mín, kcal e série completa de FC → `workout_health_samples` via `useWorkoutHealthUpload`, com `sessionId` canônico do SESSION_SYNC e heurística de fallback p/ builds antigos.
- **Privacidade/RLS:** OK — policies student-only nas 5 tabelas (`migrations 128:42-77, 129:137-191`); treinador **não** acessa (comentário explícito: "Trainers nao acessam ainda - Fase 15"). Quando a Fase 15 abrir isso pro treinador, exigirá consentimento explícito (dados de saúde, LGPD art. 11). Nada vaza pra IA/insights do treinador hoje.

### M5 · MÉDIO — Upload de amostras de saúde do Watch sem retry
- **Arquivo:** `mobile/hooks/useWorkoutHealthUpload.ts:79-99`
- **Evidência:** falha no upsert (offline no fim do treino) → `console.warn` e retorno `{ok:false}`; ninguém re-tenta. A série de FC do treino é perdida.
- **Correção:** enfileirar o payload junto da fila de pendentes do Watch (mesma infra do `finishWorkoutFromWatch`).

### Overhaul do Watch (commits cb964d1/8f7febd/f7cdf89) — leitura do código
- **Pontos fortes verificados:** persistência atômica de estado no Watch (`WorkoutStatePersistence.swift` — temp file + replace); fila de finish pendente em SecureStore com dedupe por workout (`finishWorkoutFromWatch.ts:58-127`); `sessionId` canônico via SESSION_SYNC elimina a heurística de janela de tempo; dedupe de sessão completada (<5min) impede duplicata phone×watch; espelhamento bidirecional de séries (SET_COMPLETE_FROM_PHONE em `useWorkoutSession.ts:389-397`); parsing defensivo de todos os payloads (`useWatchConnectivity.ts`); zero `try!`/`fatalError` no Swift; fix do keychain no cold start (f7cdf89, A12 ok).
- **Riscos residuais:** (a) o A3 acima (upsert engolido); (b) contrato **por índice** entre Watch e telefone (`exerciseIndex/setIndex`) — se o aluno troca um exercício no telefone no meio do treino, o índice do Watch passa a apontar pro substituto (comportamento provavelmente desejado, mas não há versão/checksum do snapshot pra detectar dessincronização); (c) conforme memória do projeto, **nada disso foi validado em device real ainda** — WatchConnectivity não roda no simulador; tratar como não-testado até o QA em hardware.

---

## 5. PERFORMANCE (geral, fora do player)

### A5 · ALTO — Histórico de treinos: busca TODAS as sessões da vida do aluno, sem paginação, renderizadas em ScrollView+map
- **Arquivo:** `mobile/hooks/useWorkoutHistory.ts:94-125` (select aninhado sessões+items+logs+2 joins de exercises, `order` sem `limit`/`range`) + `mobile/app/(tabs)/logs.tsx:236,402` (ScrollView com `.map` da timeline inteira)
- **Impacto:** aluno com 1 ano de treino (200+ sessões × ~20 logs) → payload de MBs a cada visita na aba, parse/agrupamento em JS, e render de centenas de cards sem virtualização. Hoje a base é jovem; isso degrada linearmente e é o candidato nº 1 a "o app ficou lento" em 6 meses. O cálculo de PRs varre tudo, mas isso é trabalho de RPC.
- **Correção sugerida:** RPC agregada pra stats/PRs + paginação (range) na lista + FlatList.

### M6 · MÉDIO — Inbox do aluno sem `limit` e sem virtualização
- **Arquivo:** `mobile/hooks/useInbox.ts:56-60` (sem limit) + `app/(tabs)/inbox.tsx:408-440` (ScrollView+map)
- **Evidência/impacto:** `student_inbox_items` cresce com cada notificação agendada/form — em 1 ano são centenas de linhas baixadas e renderizadas a cada foco.
- **Correção:** `limit(50)` + "ver mais", ou FlatList com paginação.

### M7 · MÉDIO — Imagens: nenhum cache controlado; signed URL recriada por mount
- **Arquivos:** `components/chat/ChatImage.tsx:31-49` (createSignedUrl por mount de cada imagem, TTL fixo, sem cache do URL); RN `Image` puro em chat/avatars/training-room (`expo-image` não está no package.json)
- **Impacto:** thread com 30 fotos = 30 roundtrips de signed URL por abertura + re-download (cache HTTP do RN Image é frágil com URLs assinadas, que mudam a cada mount → cache nunca acerta).
- **Correção:** memoizar signed URLs (MMKV com expiração) e migrar pra `expo-image` (cache em disco, placeholder/blurhash).

### M8 · MÉDIO — Dependências mortas/pesadas no bundle
- **Arquivo:** `mobile/package.json`
- **Evidência:** `react-native-feather` (zero imports — Lucide é o padrão), `react-native-worklets-core` (zero imports; convive com `react-native-worklets` que é o usado pelo Reanimated 4), `expo-av` **deprecated no SDK 54** ainda usado em 3 arquivos de vídeo (`exercises/[id].tsx`, `ExerciseVideoModal.tsx`, `VideoPreviewModal.tsx`) — quebra no SDK 55; `react-native-webview` + `react-native-youtube-iframe` pesados mas usados (vídeos YouTube).
- **Correção:** remover feather e worklets-core; migrar expo-av → expo-video antes do upgrade de SDK.

### M9 · MÉDIO — npm audit: 27 vulns (1 CRITICAL)
- **Evidência (audit-mobile.txt):** CRITICAL = `shell-quote` (GHSA-w7jw-789q-3m8p); HIGH = `@xmldom/xmldom` (×5 advisories), `fast-uri`. **Toda a cadeia está em tooling do Expo (@expo/cli, config-plugins, metro-config)** — não embarca no app em runtime; risco real é em build/dev. `npm audit fix` resolve a maioria sem breaking (o `--force` puxaria expo@56 — não fazer).
- **Correção:** rodar `npm audit fix` (sem --force) no workspace mobile e conferir lockfile.

### Startup (avaliação): razoável, sem bloqueadores
- Boot = 5 pesos de fonte (Jakarta Sans), SecureStore read (AuthContext, com retry de keychain bloqueado — f7cdf89 ok), 1 RPC `is_trainer` + 1 select `trainers` + 1 select `subscriptions` (RoleModeContext), brand store MMKV instantâneo, WatchBridge fora do AuthProvider (não bloqueia), cleanup de sessões stale e fila do Watch em async. HealthOnboarding com delay de 1.5s. Nada roda sincronamente pesado. Único ponto: os 3 roundtrips do RoleMode são sequenciais — paralelizáveis se o cold start incomodar.

### Listas grandes — quem está OK
- Alunos (`students.tsx`), exercícios 568+ (`exercises/index.tsx`), conversas do treinador, chat (com paginação `limit`), contratos, planos, templates, notificações: todos FlatList. A biblioteca de exercícios além disso usa `useCachedQuery` com TTL 30min e `revalidateWhenFresh:false` (zero requests em cache quente) — bom. Melhoria fácil: `SwipeableExerciseCard` não é memoizado e o `renderItem` é arrow inline — cada tecla na busca re-renderiza as linhas visíveis (médio-baixo, virtualização limita o dano).

---

## 6. PARIDADE WEB↔MOBILE (confronto doc × código de hoje)

- **O doc está ~fiel mas desatualizado em 1 ponto material.** Das **10 lacunas conhecidas, nenhuma fechou** (verificado: sem IA de formulários no mobile, sem assistant chat, `useAppointmentMutations` ainda propaga `group_id` mas não cria grupo, sem prefs de prescrição do treinador, sem captura com foto, sem API keys/Google Calendar). Tudo coberto pelo roadmap — não redescubro.
- **A6 · ALTO (lacuna NOVA não documentada) — Parcelamento Asaas (08/06) é 100% web; o doc de paridade afirma "Financeiro ✅ em paridade".**
  - **Evidência:** commit `79b778c` toca 18 arquivos — todos em `web/`, `shared/` e migrations (178/179); `grep installment|parcela` no mobile só encontra `app/financial/settings.tsx` (exibição de taxa). O `NewSubscriptionSheet` mobile (`components/financial/NewSubscriptionSheet.tsx`) não tem modo "Parcelado"; `PlanFormSheet` não expõe `max_installment_count`.
  - **Impacto concreto:** treinador cria plano parcelável no web; no app, ao cobrar o mesmo aluno, a opção não existe — e pior, a RPC 179 agora retorna `installment_count` que o mobile ignora, então um contrato parcelado criado no web aparece no app sem indicação de parcelamento (leitura incompleta, não só escrita).
  - **É intencional?** Coerente com a decisão "financeiro beta web-only… mobile depois" — mas então a linha "Financeiro ✅" do doc de paridade está errada e deveria virar lacuna 🟡 nº 11 com nota de roadmap. Risco de esquecimento é real porque o doc é a fonte usada pra planejar.
- **Demais features recentes mantiveram paridade no mesmo dia:** drafts do program builder (web 236a24e + mobile 590a9d8/3f91b7c), branding do personal (memória: web+mobile prontos). Header responsivo do builder web (a6b27ac) é cosmético/nativo de plataforma.
- **Sugestão:** atualizar o cabeçalho "Última auditoria completa: 2026-05-21" — já há 3 semanas de drift.

---

## 7. Divergências doc × código (confirmação pedida pelo comparativo)

- **CONFIRMADO — `SessionHeatmap.tsx:309`:** `textTransform: "capitalize"` sobre `formatMonthYear` continua no código → "Maio De 2026" no calendário do detalhe do aluno. CORRECOES-AUDITORIA-MOBILE.md item 14 afirma "fim de Maio De 2026" — a varredura corrigiu a aba Saúde mas esqueceu o heatmap. **BAIXO**, mas mina a confiança no doc de correções.
- As demais correções afirmadas que verifiquei batem com o código (lista na seção final).

---

## 8. Resumo de severidades

| Sev | # | Itens |
|---|---|---|
| Crítico | 0 | — (os críticos de junho estão de fato corrigidos no working tree) |
| Alto | 6 | A1 descartar não descarta · A2 reattach sem rehidratação · A3 upsert engolido no caminho do Watch · A4 offline sem fila + sync_status fake · A5 histórico sem paginação · A6 paridade parcelamento |
| Médio | 9 | M1 timer superset · M2 efeitos no updater · M3 re-render 1Hz sem memo · M4 timer display no resume · M5 HR sem retry · M6 inbox sem limit · M7 imagens sem cache · M8 deps mortas/expo-av · M9 npm audit |
| Baixo | 4+ | B1 sessão p/ treino vazio · B2 push prompt no boot · heatmap "Maio De" · pendências conhecidas (trio da Home, dark-mode hex, emojis em KCelebration/healthInsights, `as any` 31×, bucket messages público — etapa 3 do runbook) |

**Prioridade sugerida:** A1+A2 juntos (mesma cirurgia no reattach/descarte), depois A3 (1 função), A6 (atualizar doc + decidir roadmap), A5 e A4 (maiores, planejar).

---

## Verificado e OK (não repetir)

- **C1** série vazia herda alvo/anterior + aviso não-bloqueante (`useWorkoutSession.ts:188-208,807-832`; `[id].tsx:58-72,1032-1061`) · **C2** desmarcar deleta o log (`:400-416`) · **C3** finish reverte sessão e lança em erro de upsert — no telefone (`:1293-1306`) · **C4** swap com reset apaga logs órfãos (`:998-1013`) · **A14** started_at/duração reais no resume — persistidos (`:140-146,1144-1147,1207`).
- **A2-jun** gate trata `null` como desconhecido/fail-open documentado (`RoleModeContext.tsx:22-31`) + enforcement server-side (177) · **A3-jun** guards `useRef` em NewSubscriptionSheet/payout (`NewSubscriptionSheet.tsx:78,155`; `payout.tsx:49-62`) · **A5-jun** parse pt-BR robusto no PlanFormSheet (`:65`) · **A6-jun** `isOwner` compara `trainerId` (`exercises/[id].tsx:100`) · **A7-jun** `useFocusEffect` no detalhe do aluno (`student/[id]/index.tsx:72`) · **A8-jun** retry idempotente do builder reaproveita árvore (assinatura de draft, `useProgramBuilder.ts:85-86,299`) · **A9-jun** triggers de form re-tentam com backoff (`useWorkoutFormTriggers.ts:78-90`) · **A10-jun** diálogo de regenerar não promete mais preservar (`report/[id].tsx:293-294`) · **A11-jun** canais removidos no cleanup/logout (`useUnreadCount.ts:102-167`) · **A12-jun** retry de keychain (AuthContext, comentário A12 + f7cdf89) · **A13-jun** chat com guard por ref + Alert de falha preservando texto (`ChatView.tsx:186-215`).
- **M3-jun** prefs de notificação via RPC `update_student_notification_preferences` (`profile/notifications.tsx:65`) · **M5-jun** rounds agrupados por `round_number` real (`ExerciseCard.tsx:120-136`) · **M10-jun** duplicate de superset clona pai+filhos (`program-builder-store.ts:1389-1426`) · **M15-jun** ROLE_KEY limpo no logout · contador de rodada do superset trata séries desiguais (`SupersetGroup.tsx:19-32`).
- **Push:** projectId de `app.json` (causa raiz do diagnóstico de maio resolvida).
- **Watch:** fila pendente idempotente, dedupe de sessão, SESSION_SYNC canônico, persistência atômica no Watch, payload parsing defensivo, zero force-unwrap no Swift.
- **RLS saúde:** policies student-only nas 5 tabelas de wearable/health; treinador sem acesso (by design até Fase 15).
- **Offline parcial:** `useCachedQuery`+MMKV com mensagens de offline nas telas do treinador; ConnectionBanner global; finish do player preserva o treino com retry manual.
- **app.json diff:** só bump 1.5.2→1.5.3.
- **Testes mobile:** 292/292 ✅ (verificações de 09/06).
