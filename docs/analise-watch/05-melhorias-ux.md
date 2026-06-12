# Investigação E — UX e Melhorias do Kinevo Watch

> Análise somente leitura realizada em 2026-06-11. Evidências citadas como `arquivo:linha` referem-se ao código em `mobile/targets/watch-app/`. Comparações com apps de mercado (seção 3) baseiam-se em conhecimento de produto desses apps, **não** em fato extraído deste código.

**Sumário.** O app Watch do Kinevo tem um núcleo de execução de treino muito acima da média para um "companion app": concluir uma série custa **1 toque** quando a prescrição está pré-preenchida, a Digital Crown ajusta carga/reps com foco visual claro, há undo, badge de PR, timer de descanso com hápticos escalonados, notas do treinador em três níveis e espelhamento celular↔relógio. A spec ativa (`watch-workout-execution-ui-improvements.md`, marcada "Concluída") foi implementada na essência — o `GeometryReader` foi removido — mas **divergiu do plano**: o `.scenePadding()` que a spec mandava manter foi abandonado (não funciona dentro de `TabView(.page)`) e substituído por paddings manuais (`WatchDisplayPadding`), e o threshold de compact escolhido (195) torna o modo compact **código morto em todo hardware atual**. As maiores lacunas de UX não estão no fluxo de série, e sim no entorno: **zero suporte a Always-On Display** (o timer de descanso congela com o pulso abaixado), **nenhuma complicação/widget de Smart Stack**, sem water lock, sem FC visível durante o exercício (ela vive numa página vertical separada), contraste de textos secundários no limite (≈4,4:1 em fontes de 9–11pt) e um troféu emoji que viola a regra de marca do próprio CLAUDE.md.

---

## 1. Verificação da spec "watch-workout-execution-ui-improvements" (v5)

### O que a spec pedia vs. o que está no código

| Item da spec | Status no código | Evidência |
|---|---|---|
| Remover `GeometryReader` de `ExerciseExecutionPage.body` | ✅ Feito — zero ocorrências de `GeometryReader`/`proxy` no arquivo (o único `GeometryReader` restante é o da barra de progresso em `WorkoutDashboardView.swift:116`, legítimo) | `WorkoutExecutionView.swift` (grep limpo) |
| Compact via `WKInterfaceDevice.current().screenBounds.height < 195` | ✅ Feito, literalmente como na spec | `WorkoutExecutionView.swift:547-549` |
| "Manter `.scenePadding()` que agora funcionará" | ❌ **NÃO implementado** — não há nenhuma chamada a `.scenePadding()`; só comentários dizendo que ela **não funciona** dentro de `TabView(.page)` | `WorkoutExecutionView.swift:11-13, 701` |
| Substituir por paddings adequados ao display redondo | ✅ Feito por outra via: struct `WatchDisplayPadding` calcula horizontal (≈5,5% da largura) e top (16–20pt) a partir de `screenBounds` | `WorkoutExecutionView.swift:15-35, 698-702` |
| `.background { Color.black.ignoresSafeArea() }` com closure | ✅ Presente | `WorkoutExecutionView.swift:728` |
| Padding inferior fixo (`proxy.safeAreaInsets.bottom` → 4) | ✅ `.padding(.bottom, 4)` nos três ramos do rodapé | `WorkoutExecutionView.swift:670, 683, 694` |

`git log` confirma a entrega no commit `cb964d1` ("Apple Watch: métodos avançados, notas do treinador, espelhamento celular→relógio e hardening de sync"), precedido por `f7160b5` ("responsive layout safety for all Apple Watch sizes").

### Avaliação crítica

**O plano era bom no diagnóstico, errado na solução.** O diagnóstico "v5 — DEFINITIVA" da spec culpava o `GeometryReader` por absorver as safe areas e prometia que `.scenePadding()` funcionaria sem ele. A implementação descobriu (7ª rodada, na prática) que o problema persiste porque o **`TabView(.page)` também entrega frames full-bleed sem safe area** — exatamente o que o comentário em `WorkoutExecutionView.swift:11-13` registra. A solução final (paddings manuais derivados de `screenBounds`, calibrados em hardware real) é pragmática e correta, mas a spec nunca foi atualizada: está marcada "Concluída" descrevendo uma solução (`.scenePadding`) que **não existe no código**. Quem ler a spec como documentação vai entender errado o porquê dos números mágicos.

**Resíduos encontrados:**

1. **Modo compact é código morto.** A própria spec alertava (linhas 91-96): com threshold 195, nenhum relógio à venda é compact — SE 40mm tem 197pt de altura, 41mm tem 215pt. Foi implementado 195 (`WorkoutExecutionView.swift:548`) e, portanto, todos os ramos `compact ? ... : ...` espalhados pelo arquivo (fontes, espaçamentos, alturas mínimas — ex. linhas 558, 560, 665, 669, 689, 721, 748, 758, 815, 978-979, 1130-1151) **nunca executam** em hardware real. Ou o threshold deveria ser 200 (40mm vira compact, como a spec sugeria avaliar), ou o modo compact deveria ser removido. Do jeito que está, é peso de manutenção sem efeito.
2. **Dupla compensação do relógio do sistema.** O header recebe `padding(.top, 16-20)` para "empurrar o conteúdo para baixo do relógio" (`WorkoutExecutionView.swift:699-702`) **e** cada linha do header ainda carrega `.padding(.trailing, 34)` repetido 5× para "evitar o relógio" (`:751, :762, :769, :791`). Se o top padding já posiciona a primeira linha abaixo do relógio, os 34pt de trailing desperdiçam ~20% da largura útil do nome do exercício em um 40mm (162pt). Provável cinto-e-suspensório acumulado das 7 rodadas; merece teste para remover um dos dois.
3. **API deprecada remanescente.** O ZStack raiz usa `Color.black.edgesIgnoringSafeArea(.all)` (`WorkoutExecutionView.swift:70`, também `:400` e `:484`), enquanto a página do exercício já usa a forma moderna `ignoresSafeArea()` (`:728`). Inconsistência cosmética, sem bug.
4. **Refs a `proxy`:** nenhuma sobrou. Limpo.
5. **`WatchDisplayPadding.current`** é recomputado a cada avaliação de body (`:698, :702, :711, :722, :231`) — barato (só lê `screenBounds`), mas poderia ser `static let` já que o hardware não muda em runtime.

**Veredito:** implementada (objetivo de layout atingido por caminho diferente do planejado), com spec desatualizada e dois resíduos relevantes (compact morto, trailing 34 redundante).

---

## 2. Avaliação view a view (uso real: suor, movimento, olhada de 2 segundos)

### 2.1 ExerciseExecutionPage (dentro de WorkoutExecutionView.swift)

**Hierarquia de informação — boa.** Os dois números que importam durante a série dominam a tela: carga e reps em cards lado a lado com fonte 34pt bold rounded (`WorkoutExecutionView.swift:1132`), verde quando acima do anterior (`:1133`, `isAbovePrevious` — ótimo reforço de progressão). O header comprime nome do exercício (subheadline bold, `lineLimit(1)`, `minimumScaleFactor(0.7)` — `:757-762`), chips de método/tipo de série, "Anterior X × Y" e contador "Série N/M" com dots de progresso (`:813-823, :977-1008`). Para uma olhada de 2 segundos, o estado da série atual é legível. Crítica: o header tem **até 5 linhas empilhadas** (superset, nome, método, chips, anterior, série/dots) — em exercícios com tudo preenchido num 40mm isso espreme os cards; e a fonte dos metadados (9–10pt, `:748, :797, :804`) está abaixo do confortável para leitura em movimento.

**Toques para concluir uma série — excelente: 1 toque no caminho feliz.** Contagem real no código: a página abre com foco em reps (`:729-732`), os valores vêm pré-preenchidos da prescrição/última execução; se o aluno fez o prescrito, basta tocar "Concluir Série" (`:685-695`). Ajustar reps: girar a Crown (0 toques extras, foco já está em reps). Ajustar carga: 1 toque no card de carga para focar (`:582-584`) + Crown + 1 toque em concluir = **2 toques**. Após concluir, foco volta para reps automaticamente (`:877-879`). É melhor que o app do iPhone e melhor que a maioria dos concorrentes.

**Sequência pós-série bem coreografada:** háptico de sucesso (`:861`), undo banner por 5s (`:899-905`), timer de descanso adiado 1,8s para o undo ser visível (`:864-874`), badge de PR quando carga > anterior (`:885-895`), hint de swipe quando o exercício termina (`:856-859`). Detalhes finos: o botão "Desfazer" é texto 12pt `buttonStyle(.plain)` (`:924-932`) — alvo de toque pequeno para dedo suado (HIG recomenda ≥44pt); o chip "Nota" é 9pt (`:779-789`), idem.

**Digital Crown — bem aproveitada onde está.** Três usos: carga (passo 0,5kg, 0–400, `:573-581`), reps (passo 1, 0–100, `:610-617`), ambos com haptic feedback e indicador visual de foco (borda violeta + ícone de crown, `:1160-1171`); e RPE no fim do treino (1–10, `:356-365`). O `TrainerNoteSheet` e listas rolam com a Crown de graça (ScrollView). **Lacunas:** o `RestTimerSheet` não usa a Crown (nem botões) para estender/encurtar o descanso — só existe "Pular descanso" (`:1302-1307`); e na página de cardio a Crown não faz nada.

**Legibilidade/contraste (tema `KinevoTheme.swift` sobre preto):** valores principais brancos sobre `kinevoCard #1A1A2E` — contraste alto, ok. Problemas: `kinevoTextSecondary #64748B` sobre preto ≈ **4,4:1**, abaixo do AA (4,5:1) para texto pequeno, e é usado justamente nos textos de 10–11pt; a linha "Anterior" usa `.gray.opacity(0.7)` (`:799`) ≈ 3,5:1 em fonte de 10pt — difícil em sol/abertura de academia; chips de 9pt bold com cor a 100% sobre fundo de 15% de opacidade são legíveis mas minúsculos. O violeta `#7C3AED` sobre preto rende ≈ 3,9:1 — aceitável para elementos grandes/ícones, fraco para o texto "Desfazer" em 12pt (`:929`).

**Emoji troféu:** o PR badge usa `Text("\u{1F3C6}")` (🏆) (`:944`) — viola a regra do CLAUDE.md ("nunca emoji como ícone"); existe SF Symbol `trophy.fill` usado corretamente 13 linhas abaixo na tela de conclusão (`:457`).

### 2.2 RestTimerSheet (WorkoutExecutionView.swift:1253-1347)

Anel de progresso 96pt + contagem 28pt monospaced — legível de relance. Hápticos intermediários em 30s/10s/0s (`:1321-1337`) são ótimos para treinar sem olhar. **Três problemas:** (a) é um `.sheet` modal — durante o descanso o aluno não consegue ver/ajustar a carga da próxima série (o momento em que todo mundo ajusta anilhas) sem pular o timer; (b) dirigido por `Timer.publish` a cada 1s (`:1258`) — com o pulso abaixado (Always-On dimmed) o runloop congela e o mostrador fica **parado/errado** até o pulso levantar (o cálculo se corrige por wall-clock em `:1315-1318`, mas a exibição AOD não); um `Text(timerInterval:)` como o usado no dashboard (`WorkoutDashboardView.swift:53-58`) atualizaria de graça no AOD; (c) sem +15s/−15s nem Crown.

### 2.3 CardioExecutionView.swift

Estados bem desenhados (idle → countdown 5s → work/rest → completed), cores semânticas (vermelho TRABALHO / verde DESCANSO, fundo tingido `:60-69`), timer **wall-clock driven** que sobrevive a suspensões e atravessa múltiplos rounds no catch-up (`:385-406`) — engenharia acima da média. Fonte 44pt monospaced para o tempo (`:196, :237`) é perfeita para olhada rápida. Críticas: "TRABALHO"/"PREPARE-SE"/"DESCANSO" em caps com fontes 12pt; botões "Pular"/"Concluir" em `.caption` lado a lado — risco de concluir o cardio inteiro querendo pular um round (ação destrutiva sem confirmação, `:214-219`); sem FC visível (num cardio!); o mesmo problema de AOD do rest timer (display congela com pulso abaixado, embora o estado se recupere).

### 2.4 WorkoutListView.swift

Estados de espera/vazio **bem tratados** — é a view mais completa nisso: `.neverSynced` ("Aguardando… abra o Kinevo no celular") com indicador Conectado/Desconectado (`:219-253`), `.noProgram` (`:191-217`), card de retomada no topo quando há treino em andamento (`:144-187`, com progresso "X/Y séries • Retomar" — excelente contra perda de sessão), treino de hoje destacado com tint violeta e ordenação inteligente (`:267-280`). Críticas: o estado `.noProgram` mistura mensagens — ícone de sucesso + "Tudo feito!" com subtítulo "Nenhum programa ativo" (`:193-204`): são situações diferentes (programa concluído vs. aluno sem programa) e a celebração confunde quem nunca teve programa. Não há estado de "carregando" distinto nem ação de retry manual (depende do ciclo do WatchConnectivity).

### 2.5 WorkoutDashboardView.swift

Página de métricas (página vertical 1): progresso de séries com barra gradiente, FC + kcal lado a lado (20pt bold), tempo decorrido com `Text(timerInterval:)` (`:53-58`) — **o único lugar do app que atualiza corretamente no Always-On**. Banner de espelhamento quando o treino roda no iPhone (`:145-171`) é um diferencial honesto. Críticas: FC mostra "--" quando 0 (`:33-35`) sem explicar por quê (sem autorização? sem leitura ainda?); "Abandonar Treino" é texto plain 12pt vermelho a 70% (`:79-85`) — discreto para evitar toque acidental (bom), mas com confirmação já existente no pai (`WorkoutExecutionView.swift:96-107`) poderia ser um botão honesto; **não há HR zones** nem média/máx ao vivo.

### 2.6 NowPlayingView.swift e KinevoWatchApp.swift

`KinevoNowPlayingView` embute o `WatchKit.NowPlayingView` do sistema (`NowPlayingView.swift:10-14`) — decisão certa: controle de mídia completo (inclusive volume pela Crown) por 5 linhas de código, acessível como página vertical 2 durante o treino. No app root, a restauração de navegação pós-relaunch (`KinevoWatchApp.swift:133-140`) e o flush de estado ao ir para background (`:121-126`) protegem o cenário mais crítico de UX num relógio: ser expulso da tela de treino no meio da série.

### 2.7 Complicações / Smart Stack / Always-On — inexistentes

- **Nenhum target de WidgetKit para watchOS.** O único uso de WidgetKit no repo é o Live Activity do iPhone (`mobile/targets/workout-activity/`). Não há `ComplicationController`, `WidgetBundle` watch, `TimelineProvider`, nem relevância para Smart Stack. Resultado: o aluno não tem como abrir o treino do dia pelo mostrador — precisa achar o app na lista/dock.
- **Zero ocorrências de `isLuminanceReduced` ou `TimelineView`** em todo o target. Fora o `Text(timerInterval:)` do dashboard, nada foi desenhado para o estado dimmed do Always-On — exatamente o estado em que o relógio passa a maior parte do treino.
- **Sem water lock** (`enableWaterLock` ausente) — relevante para quem sua muito ou treina remo/natação.
- **Sem `handGestureShortcut`** (double-tap do watchOS 10+) — "Concluir Série" seria o candidato perfeito.

---

## 3. Comparação com referências de mercado

> Tudo nesta seção é **referência de mercado** (conhecimento dos apps citados), não fato deste código.

| Capacidade | Apple Fitness (Workout) | WorkOutDoors | Hevy (watch) | Gentler Streak | **Kinevo Watch hoje** |
|---|---|---|---|---|---|
| Métricas ao vivo (FC/kcal/tempo) visíveis durante o esforço | Sim, tela principal | Sim, telas densas customizáveis | Parcial | Sim | **Só em página vertical separada** (dashboard) |
| Always-On Display tratado | Sim | Sim | Razoável | Sim, referência | **Não** (só o `timerInterval` do dashboard) |
| Complicação / Smart Stack para iniciar/retomar | Sim (relevância automática) | Sim | Sim (iniciar treino) | Sim | **Não existe** |
| Timer de descanso ajustável (+/−) | n/a | n/a | Sim (+15s/−15s) | n/a | **Só "Pular"** |
| HR zones (faixas coloridas) | Sim | Sim, com alertas | Não | Sim (esforço) | **Não** |
| Water lock | Sim | Sim | — | Sim | **Não** |
| Resumo pós-treino rico (FC média/máx, gráfico, anéis) | Sim | Sim | Sim (volume/PRs) | Sim | **Básico** (séries/volume/PRs/duração — sem FC, embora os dados existam em `HealthKitManager.exportHealthSamples()`) |
| Autodetecção de descanso / auto-avançar | Parcial (pausa auto em corrida) | Sim (auto-pause) | Não | n/a | **Não** |
| Double-tap para ação primária | Sim | — | Sim | Sim | **Não** |
| Logging 1-toque com prescrição do treinador, notas do coach, espelhamento phone↔watch | Não | Não | Parcial (sem coach) | Não | **Sim — é o diferencial real do Kinevo** |

**Leitura estratégica:** o Kinevo já tem o que nenhum dos quatro tem — a relação treinador→aluno no pulso (prescrição com métodos avançados, notas por série, "Anterior X×Y", espelhamento). O que falta para ser um *diferencial* e não um espelho do iPhone é o pacote "cidadão de primeira classe do watchOS": complicação que diz "Treino A hoje" no mostrador, AOD que não congela, FC na tela do exercício e um resumo final que mereça ser mostrado para o treinador. São capacidades de plataforma, não de produto — concorrente nenhum compete com a prescrição, mas todos ganham na sensação de "app nativo de verdade".

---

## 4. Melhorias priorizadas

### Quick wins (horas, baixo risco)

| # | Problema | Solução esboçada | Arquivos | Esforço |
|---|---|---|---|---|
| Q1 | Rest timer congela no Always-On (display dirigido por `Timer.publish`) | Trocar o texto do contador por `Text(timerInterval:countsDown:true)` e o anel por `TimelineView(.periodic)`; manter o ticker só para hápticos/dismiss | `WorkoutExecutionView.swift` (RestTimerSheet, :1253-1347) | ~2h |
| Q2 | Sem ajuste do descanso; só "Pular" | Botões −15s/+15s ao lado do anel (ou `digitalCrownRotation` no sheet) movendo `phaseDeadline`/`startedAt` | `WorkoutExecutionView.swift` (RestTimerSheet) | ~2h |
| Q3 | "Concluir Série" exige toque com mão ocupada/suada | `.handGestureShortcut(.primaryAction)` no botão (double-tap, watchOS 10+/S9+); fallback inócuo em hardware antigo | `WorkoutExecutionView.swift:685` | ~1h |
| Q4 | Emoji 🏆 no PR badge viola regra de marca | `Image(systemName: "trophy.fill")` amarelo, como já feito em `:457` | `WorkoutExecutionView.swift:944` | 15min |
| Q5 | Modo compact é código morto (threshold 195 < menor tela real 197) | Decidir: subir para 200 (40mm vira compact, testar) **ou** remover todos os ramos `compact` | `WorkoutExecutionView.swift:548` (+ramos) | ~1-3h |
| Q6 | Estado `.noProgram` celebra ("Tudo feito!") quem não tem programa | Separar mensagens: sem programa = ícone neutro + CTA "peça ao seu treinador"; programa concluído = celebração | `WorkoutListView.swift:191-217` | ~1h |
| Q7 | Contraste de textos secundários ≈4,4:1 em 9-11pt | Clarear `kinevoTextSecondary` (ex. `#8A94A6`) e trocar `.gray.opacity(0.7)` da linha "Anterior" por cor sólida ≥4,5:1 | `KinevoTheme.swift:39`, `WorkoutExecutionView.swift:799` | ~1h + QA visual |
| Q8 | Trailing 34pt × top padding: dupla compensação do relógio desperdiça largura do nome | Testar em hardware: se o top padding já limpa o relógio, reduzir/remover os 5 `.padding(.trailing, 34)` | `WorkoutExecutionView.swift:751-791` | ~1h + QA |

### Médio (1-3 dias cada)

| # | Problema | Solução esboçada | Arquivos | Esforço |
|---|---|---|---|---|
| M1 | FC invisível durante a série (página vertical separada) | Linha compacta no rodapé/header da `ExerciseExecutionPage`: ♥ 142 + kcal, lendo `healthKitManager.heartRate` (já publicado). Exige passar o env object à page | `WorkoutExecutionView.swift` (ExerciseExecutionPage) | 1 dia (inclui re-balancear layout 40mm) |
| M2 | Sem complicação/Smart Stack — app invisível no mostrador | Novo target WidgetKit watchOS (via `plugins/with-watch-app.js` + novo `expo-target.config`): widget accessoryCircular/Corner "treino de hoje" + `RelevanceKit` no horário agendado; deep link abre o treino | novo target, `plugins/with-watch-app.js`, `WatchSessionManager.swift` (compartilhar snapshot via App Group) | 2-3 dias |
| M3 | Resumo pós-treino pobre vs. dados já coletados | Adicionar FC média/máx e kcal ao `successFinishView` (os agregados já existem em `exportHealthSamples()`; expor `@Published` no manager) | `WorkoutExecutionView.swift:414-485`, `HealthKitManager.swift` | 1 dia |
| M4 | Descanso modal esconde a próxima série | Converter RestTimerSheet em overlay/banner compacto sobre a page (anel pequeno no topo), deixando os cards de carga/reps visíveis e editáveis durante o descanso | `WorkoutExecutionView.swift` | 2 dias |
| M5 | Sem water lock | Botão no `WorkoutDashboardView` (`WKInterfaceDevice.current().enableWaterLock()`) | `WorkoutDashboardView.swift` | 0,5 dia |
| M6 | Cardio sem FC e com "Concluir" perigoso ao lado de "Pular" | FC inline no work/rest view; confirmação (ou long-press) no "Concluir" durante intervalos | `CardioExecutionView.swift` | 1 dia |

### Grande (1+ semana cada)

| # | Problema | Solução esboçada | Arquivos | Esforço |
|---|---|---|---|---|
| G1 | Always-On de verdade em todas as telas de execução | Auditar com `\.isLuminanceReduced`: versão dimmed da page (só série atual + timer), `TimelineView` nos contadores, reduzir conteúdo no rest/cardio. Exige QA em hardware real | todas as Views | 1 semana |
| G2 | HR zones ao vivo + alertas hápticos de zona | Calcular zonas (idade/FC máx do perfil vindo do iPhone), gauge colorido no dashboard e cor da FC inline (M1); háptico ao mudar de zona no cardio | `HealthKitManager.swift`, `WorkoutDashboardView.swift`, `WatchSessionManager.swift` (payload do perfil) | 1-2 semanas |
| G3 | Autodetecção de descanso / fluxo sem toques | Heurística: queda sustentada de FC + inatividade do acelerômetro após N s sugere "série terminada?" com confirmação por double-tap; auto-iniciar descanso. Alto risco de falso positivo — atrás de feature flag | `HealthKitManager.swift` (+CoreMotion), `WorkoutExecutionStore.swift`, page | 2+ semanas |
| G4 | Dependência total do iPhone para sync (UX degrada sem o celular por perto) | Fila offline já existe no estado persistido; o passo grande é o Watch falar com o Supabase via `URLSession` quando o iPhone está fora de alcance (token via WatchConnectivity, refresh no relógio) | `WatchSessionManager.swift`, novo serviço de rede | 2+ semanas |

**Ordem sugerida:** Q1→Q4 num único pacote de polimento (1 dia), depois M1 (FC inline é o maior salto de percepção de valor por esforço), depois M2 (complicação — maior salto de retenção/uso diário), com G1 planejado junto de M2 para o app "parecer nativo" de ponta a ponta.
