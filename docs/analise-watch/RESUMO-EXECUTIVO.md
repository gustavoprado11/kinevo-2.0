# Resumo Executivo — Análise do App Apple Watch (jun/2026)

> Análise investigativa somente-leitura. Detalhes, evidências (arquivo:linha + trecho) e correções sugeridas estão nos relatórios `00`–`05` desta pasta. Nada foi alterado no código.

## Visão geral

A fundação do Watch app é melhor do que o esperado: persistência atômica a cada série, restauração pós-crash (estado + navegação + HKWorkoutSession), fila `transferUserInfo` para conclusão offline, parsing Swift defensivo (zero `try!`/`fatalError`; métodos de treino desconhecidos degradam sem crash), e concluir uma série custa **1 toque** — acima do mercado. Os problemas reais estão em três frentes: **(1) a entrega do treino finalizado ao iPhone tem buracos reais de perda de dados**, **(2) a execução simultânea/edição mid-treino corrompe ou perde séries**, e **(3) zero testes automatizados em todo o caminho** (Swift e TS).

## Top achados por impacto

### Frente 1 — Confiabilidade do FINISH_WORKOUT (perda de treino inteiro)

| Id | Sev. | Status | Achado |
|---|---|---|---|
| C-1/F1 | **Alto** | Confirmado | `WCSessionRelay.activate()` **nunca é chamado** — a camada "persist-first" em UserDefaults do lado iPhone é código morto (`WatchConnectivityModule.swift:56-90`). A garantia documentada contra app kill não existe. |
| F3 | **Alto** | Confirmado | Eventos do Watch ficam só em buffer de memória entre o OnCreate do módulo e o attach do listener JS; morte do app nessa janela perde um `FINISH_WORKOUT` já consumido da fila do WC (`WatchConnectivityModule.swift:670-691`). |
| F4/F5 | **Alto** | Confirmado | Falha "permanente" no processamento (student/workout não encontrado) descarta o FINISH sem fila nem ACK (`finishWorkoutFromWatch.ts:178-200`); o Watch **nunca reenvia** e deleta estado pendente >10 min no relaunch (`WorkoutExecutionStore.swift:34-42`). |
| B-05/F6 | Médio | Confirmado | `sendReliable` descarta em silêncio (inclusive FINISH) se a WCSession ainda não ativou — janela de cold launch (`WatchSessionManager.swift:287-291`). |

> ⚠️ Nota de cruzamento: o relatório `02` (Cenário 2) conclui "nenhum dado se perde" assumindo o relay persist-first ativo. Os relatórios `00` e `03` provaram que essa camada está morta (C-1/F1). A conclusão correta é: a entrega offline funciona **enquanto o app RN estiver vivo ao receber o evento**; com app morto/na janela F3, há perda real.

### Frente 2 — Integridade Watch ↔ iPhone (séries erradas, duplicadas ou perdidas)

| Id | Sev. | Status | Achado |
|---|---|---|---|
| A1 | **Alto** | Confirmado | iPhone aplica `SET_COMPLETE` por **índice** e ignora o `exerciseId` enviado; após edição do treinador mid-treino, a série é gravada no exercício errado (`app/workout/[id].tsx:256`). |
| A2 | **Alto** | Confirmado | Finalizar no iPhone limpa o Watch **sem coletar** séries feitas só lá; `SET_COMPLETE` não tem handler fora da tela de treino → perda silenciosa (`WorkoutExecutionStore.swift:147-162` + `app/_layout.tsx:306`). |
| A3 | **Alto** | Confirmado | Duplo-finish: `finishWorkoutFromWatch` upserta séries **incompletas por cima** das do iPhone (downgrade `is_completed=false`) e, sem sessionId, retry >5 min cria `workout_session` duplicada (`finishWorkoutFromWatch.ts:366-381, 288-335`). |
| B-01 | **Alto** | Confirmado | Tocar em outro treino na lista durante treino ativo substitui o estado e apaga o progresso sem confirmação (`WorkoutExecutionView.swift:110`). |
| B-02 | **Alto** | Confirmado (reproduzir em device) | Treino só-cardio fica preso em `emptyView` após "Iniciar": sem executar, sem abandonar, HKWorkoutSession rodando (`WorkoutExecutionView.swift:72-84`). |
| A4 | Médio/Alto | Confirmado | Descanso prescrito 0s (drop-set/cluster) vira timer de 60s no Watch (`getProgramSnapshotForWatch.ts:248`). |
| A5–A9 | Médio | Confirmado | Superset descansa diferente em cada lado; %1RM/RIR invisíveis no Watch; carry-forward diverge; duração de cardio perdida no finish do iPhone; edição do treinador só chega ao Watch em launch/start/finish. |

### Frente 3 — Crashes e races (raros, mas reais)

- **B-03 (Médio, confirmado)** — `startedAt` no futuro (skew de relógio) crasha o dashboard via `ClosedRange<Date>` (`WorkoutDashboardView.swift:54`).
- **B-04 + C-2 (Médio, hipótese forte)** — agregados de FC mutados em thread de background do HealthKit; `bufferedWatchEvents` sem lock entre main e thread JS.
- **B-08/B-13 (Baixo)** — `sets`/`rounds` negativos vindos do iPhone causam range trap.

### Estrutural / build

- **Plugin `with-watch-app.js`**: frágil (formato Xcode 16 em pbxproj v54, team id e versões hardcoded, scheme por string-replace). **Recomendação do relatório 03**: migrar para `@bacons/apple-targets` — a v4.0.6 instalada **já suporta** `type: "watch"`; elimina as ~400 linhas de cirurgia de pbxproj. Não há migração pela metade (bacons hoje só gerencia o widget de Live Activity). Atenção: o diagnóstico do `APPLE_WATCH.md` culpando o productType pelo erro 7006 no simulador está **provavelmente errado**; a causa real precisa de experimento.
- **Código morto**: todo o pipeline v1 (`getNextWorkoutForWatch.ts`, `syncWorkoutToWatch`) não tem chamadores; o contrato real é o snapshot v2 via `updateApplicationContext`. `CLAUDE.md`/`APPLE_WATCH.md` citam `components/WatchBridge.tsx`, que não existe (é inline em `app/_layout.tsx:44-399`).
- **Spec `watch-workout-execution-ui-improvements.md`**: implementada na essência (GeometryReader removido), mas **divergiu do plano** — o `.scenePadding()` que ela manda manter não existe; foi substituído por paddings manuais. O modo compact é código morto (threshold 195 < menor tela real 197pt). A spec está marcada "Concluída" descrevendo outra solução.

### Testes

Cobertura **zero** no caminho do Watch (nenhum teste Swift; nenhum dos 4 módulos TS testado). Suíte mobile saudável: 292 testes passando, `tsc --noEmit` limpo. O relatório `04` traz casos de teste prontos para as 10 unidades críticas (prioridade: `finishWorkoutFromWatch.ts`, depois reducer do `WorkoutExecutionStore`) e um **roteiro de teste manual em device** cobrindo os edge cases.

### UX (relatório 05, top-5)

1. *Quick win* — rest timer congela com pulso abaixado (sem Always-On via `Text(timerInterval:)`).
2. *Quick win* — double-tap gesture no "Concluir Série".
3. *Quick win* — ajustar descanso (+15s/−15s) no RestTimerSheet (hoje só "Pular").
4. *Médio* — FC inline na página do exercício.
5. *Médio* — complicação/Smart Stack "treino de hoje" (não existe nenhum WidgetKit no Watch).

## Confirmado vs hipótese

**Confirmados por leitura de código de ponta a ponta**: C-1/F1, F3, F4/F5, A1, A2, A3, A4, B-01, B-03, código morto v1, spec divergente, plugin frágil.
**Hipóteses que exigem device/teste**: janela real do B-05 (ativação da WCSession), reprodução do B-02 (swipe-back com toolbar oculta), races B-04/C-2 (TSan), limite de tamanho do `updateApplicationContext`, causa real do erro 7006 no simulador.

## Ordem de ataque sugerida (próxima sessão de implementação)

1. **Confiabilidade do FINISH** — decidir o destino do `WCSessionRelay` (ativar de verdade no AppDelegate ou remover), fila de reenvio com ACK no Watch (resolve F3/F4/F5/B-05 de uma vez). É a frente com perda de treino inteiro.
2. **Integridade duplo-lado** — `SET_COMPLETE` keyed por `exerciseId` (A1); coleta de séries do Watch ao finalizar no iPhone (A2); upsert sem downgrade + sessionId obrigatório (A3).
3. **Travas de UX que destroem dados** — confirmação ao trocar de treino (B-01); fluxo cardio-only (B-02); descanso 0s (A4).
4. **Testes** — `finishWorkoutFromWatch.ts` primeiro (Vitest, infra pronta), depois target XCTest para o reducer; rodar o roteiro manual do relatório `04` em device para validar as hipóteses.
5. **Estrutural** — migração para `@bacons/apple-targets`, remoção do pipeline v1 morto, atualização de `APPLE_WATCH.md`/`CLAUDE.md`/spec.
6. **Quick wins de UX** — AOD no timer, double-tap, ajuste de descanso.
