# Análise Investigativa — App Apple Watch do Kinevo (SOMENTE LEITURA)

## Contexto

O Kinevo tem um companion app de Apple Watch (SwiftUI) para alunos executarem treinos no pulso, com HealthKit e sincronização bidirecional via WatchConnectivity. Componentes envolvidos:

- `mobile/targets/watch-app/` — app watchOS em SwiftUI (`KinevoWatchApp.swift`, `Views/`, `Services/` com `WatchSessionManager`, `HealthKitManager`, `WorkoutExecutionStore`, `WorkoutStatePersistence`, `Models/WorkoutExecutionState.swift`, `WorkoutModels.swift`, `KinevoTheme.swift`)
- `mobile/modules/watch-connectivity/` — módulo Expo nativo (Swift) do lado iPhone
- `mobile/hooks/useWatchConnectivity.ts` — ponte React Native
- `mobile/lib/getNextWorkoutForWatch.ts`, `getProgramSnapshotForWatch.ts`, `finishWorkoutFromWatch.ts` — montagem e persistência dos dados
- `mobile/plugins/with-watch-app.js` — config plugin que injeta o target watchOS
- `mobile/APPLE_WATCH.md` — documentação e limitações conhecidas (leia primeiro)
- `mobile/specs/active/watch-workout-execution-ui-improvements.md` — spec em andamento (leia e avalie criticamente: o que já foi implementado? o plano é bom?)

## Regras invioláveis

1. **NÃO altere nenhum arquivo.** 100% investigação. Únicos arquivos novos permitidos: relatórios em `docs/analise-watch/`.
2. **NÃO** faça commit, push, build no Xcode em device, `pod install`, nem instale dependências.
3. **PODE** rodar verificações de leitura: `npm run test` no mobile, `tsc --noEmit`, grep/glob, `git log -- mobile/targets/watch-app` (histórico ajuda a entender decisões), e compilar/verificar Swift apenas se houver forma não destrutiva (ex.: `xcodebuild build -dry-run` ou análise estática); se não houver toolchain, faça revisão manual rigorosa.
4. Seja exaustivo: leia TODOS os arquivos Swift do watch app e do módulo nativo por inteiro, além de todo o caminho TypeScript que alimenta o Watch.

## Fase 1 — Mapa do fluxo de dados

Documente em `docs/analise-watch/00-fluxo-de-dados.md` o ciclo de vida completo:

1. Como o iPhone monta o payload do treino (`getNextWorkoutForWatch`, `getProgramSnapshotForWatch`) — quais campos vão, quais não vão.
2. Como o payload trafega (sendMessage? updateApplicationContext? transferUserInfo?) e o que acontece quando o Watch está fora de alcance/reachable=false.
3. Como o Watch decodifica (`WorkoutModels.swift`) — campos opcionais, defaults, o que quebra se o payload mudar.
4. Como o estado de execução evolui no Watch (`WorkoutExecutionStore`, `WorkoutExecutionState`) e como persiste (`WorkoutStatePersistence`).
5. Como a conclusão volta ao iPhone (`finishWorkoutFromWatch`) e chega ao Supabase.
6. Diagrama em texto/mermaid do fluxo completo, com pontos de falha marcados.

## Fase 2 — Investigações (paralelize com subagents onde fizer sentido)

### A. Consistência Watch ↔ iPhone (foco principal)
- **Modelos**: compare campo a campo os tipos TypeScript do payload com os structs Swift. Liste divergências: campos enviados e ignorados, campos esperados e nunca enviados, diferenças de naming/unidades (kg? segundos?), enums que podem dessincronizar (métodos de treino: pirâmide, drop-set, cluster, supersets — o Watch entende todos os `set_scheme`/`method_key` que o sistema prescreve? O que ele faz quando recebe um método desconhecido?).
- **Estado**: se o aluno marca uma série no Watch E no iPhone (ou edita o treino no iPhone no meio da execução), quem ganha? Há risco de duplicação ou perda de séries? O que acontece se o treino é finalizado nos dois lados?
- **Lógica duplicada**: timer de descanso, progressão de séries, cálculo de carga — onde a regra existe em Swift E em TypeScript, e se divergem.
- **Tema/UX**: `KinevoTheme.swift` é consistente com o design system do app mobile (cores, tipografia)?

### B. Robustez e edge cases
Para cada cenário, rastreie no código o que de fato acontece (não especule):
- Watch fecha o app / fica sem bateria no meio do treino → o estado persiste e restaura?
- iPhone fora de alcance durante todo o treino → a conclusão é enfileirada e entregue depois?
- Treino sem exercícios, exercício sem séries, peso nulo, reps em faixa ("8-12"), cardio vs força (`CardioExecutionView`).
- Permissão de HealthKit negada → o app degrada bem ou trava?
- `HKWorkoutSession`: é encerrada corretamente em todos os caminhos (finalizar, abandonar, crash)? Sessões órfãs?
- Mudança de treino no iPhone enquanto o Watch executa o snapshot antigo.
- Force-unwraps (`!`), `try!`, `fatalError`, índices sem bounds-check em todo o Swift — liste cada um com arquivo:linha.
- Retain cycles em closures/delegates, trabalho fora da main thread atualizando UI.

### C. Módulo nativo e config plugin
- `modules/watch-connectivity/`: tratamento de erros do WCSession, ativação/delegate lifecycle, o que acontece em iPad/dispositivo sem Watch pareado, eventos emitidos para o JS e se o hook `useWatchConnectivity` trata todos (incluindo unsubscribe/cleanup).
- `with-watch-app.js`: frágil a upgrades de Expo/Xcode? O problema do productType documentado em APPLE_WATCH.md tem solução melhor hoje (verifique se há abordagem mais recente para targets watchOS com Expo/`@bacons/apple-targets` — que já está instalado! Por que existem as duas abordagens? Há migração pela metade?).
- Entitlements e Info.plist: permissões corretas, descrições de uso, app groups consistentes entre targets.

### D. Testes
- Inventarie o que tem teste hoje (provavelmente nada no Swift). 
- Identifique as 5–10 unidades mais críticas e testáveis (ex.: decodificação do payload, redutor de estado do `WorkoutExecutionStore`, montagem do payload em `getNextWorkoutForWatch`) e descreva os casos de teste que deveriam existir — inclua tabelas de input/output esperado, mas NÃO crie os arquivos de teste.
- Rode os testes existentes do mobile (`npm run test`) e reporte se algo que alimenta o Watch já está coberto.
- Proponha um roteiro de teste manual em device real (checklist passo a passo) para o Gustavo executar, cobrindo os edge cases da seção B.

### E. UX e melhorias
- Avalie cada View: hierarquia de informação num display pequeno, número de toques para concluir uma série, legibilidade durante exercício (suor, movimento), Digital Crown aproveitado?, complicações/Smart Stack existem?, Always-On Display tratado?
- Compare com referências de mercado (Apple Fitness, WorkOutDoors, Hevy, Gentler Streak) — o que falta para o Watch app ser um diferencial e não só um espelho?
- Liste melhorias priorizadas: **Quick wins / Médio / Grande**, cada uma com problema, solução esboçada e arquivos afetados.

## Entregáveis (em `docs/analise-watch/`)

- `00-fluxo-de-dados.md`
- `01-consistencia.md` — divergências modelo/estado/lógica com tabela campo a campo
- `02-robustez-edge-cases.md` — cada cenário com veredito (OK / quebra / incerto) e evidência
- `03-modulo-nativo-build.md`
- `04-testes.md` — incluindo o checklist de teste manual em device
- `05-melhorias-ux.md`
- `RESUMO-EXECUTIVO.md` — 1–2 páginas: top achados por impacto, bugs prováveis vs confirmados por leitura, e ordem de ataque sugerida para a próxima sessão (de implementação).

Todo achado: severidade (Crítico/Alto/Médio/Baixo), arquivo:linha, trecho de código como evidência, impacto concreto, correção sugerida (descrita, não implementada).

## Verificação final

Releia o RESUMO-EXECUTIVO e confirme que cada bug apontado tem o caminho de código rastreado de ponta a ponta — distinga claramente "confirmado por leitura do código" de "hipótese que precisa de teste em device". Se sobrar tempo, aprofunde na seção A (consistência), que é o coração do problema.
