# Investigação C — Módulo nativo WatchConnectivity e config plugin de build

> Análise somente-leitura (jun/2026). Arquivos lidos por inteiro: `mobile/modules/watch-connectivity/**`, `mobile/plugins/with-watch-app.js`, `mobile/hooks/useWatchConnectivity.ts`, `mobile/app/_layout.tsx` (WatchBridge), `mobile/targets/watch-app/Info.plist`, `KinevoWatch.entitlements`, `mobile/app.json`, `mobile/APPLE_WATCH.md`, trechos relevantes de `WatchSessionManager.swift` (lado Watch), pbxproj gerado em `mobile/ios/` e código de `@bacons/apple-targets@4.0.6` em `node_modules`.

## Sumário

O módulo nativo é, no geral, bem construído: checa `WCSession.isSupported()`, implementa o ciclo de ativação completo, despacha callbacks de background para a main thread antes de emitir eventos, e todos os 6 tipos de mensagem Watch→iPhone têm handler no JS com cleanup correto de listeners. Os problemas reais são de segunda ordem: **a camada de persistência `WCSessionRelay` ("persist first, forward second") é código morto** — `activate()` nunca é chamado de lugar nenhum, então a garantia documentada de sobreviver a kill do app não existe (o buffer efetivo é só in-memory); há uma corrida de threads não sincronizada em `bufferedWatchEvents`/`hasJSListeners`; e o wrapper TS de `isWatchReachable` crasharia no Android por falta de null-guard. No build, o plugin custom de 414 linhas usa o productType genérico `com.apple.product-type.application` (confirmado na linha 268 e no pbxproj gerado) — mas a investigação revelou que **esse É o productType que o próprio `@bacons/apple-targets` 4.0.6 usa para `type: "watch"`** (e o que o Xcode 14+ usa para watch apps single-target), ou seja: migrar para o bacons consolidaria a manutenção e eliminaria a cirurgia manual de pbxproj, mas **não** resolveria por si só o problema do WatchConnectivity no simulador, cuja causa raiz documentada em `APPLE_WATCH.md` está provavelmente errada. Entitlements e Info.plist estão consistentes nos dois lados (bundle ids, HealthKit, WKCompanionAppBundleIdentifier); não há app groups (nem são necessários — toda a comunicação é via WCSession).

---

## 1. Módulo nativo `mobile/modules/watch-connectivity/`

### 1.1 O que está correto (confirmado por leitura)

- **`WCSession.isSupported()`** checado nos três pontos de entrada: `WCSessionRelay.activate()` (`ios/WatchConnectivityModule.swift:79`), `OnCreate` do módulo (`:344` — `self.wcSession = WCSession.isSupported() ? WCSession.default : nil`) e re-aquisição em `sendApplicationContext` (`:569`).
- **Ciclo de ativação completo** nos dois delegates (`WCSessionRelay` e `SessionDelegate`): `activationDidCompleteWith` (`:114`, `:228`), `sessionDidBecomeInactive` (`:128`, `:244`) e `sessionDidDeactivate` com re-ativação (`:133-137`, `:249-253` — `session.activate()` dentro do deactivate, correto para troca de Watch pareado).
- **Threading**: callbacks do WCSession chegam em thread de background; ambos os delegates despacham para a main antes de tocar no módulo — `SessionDelegate` usa `DispatchQueue.main.async { module.emitWatchMessageEvent(...) }` (`:263`, `:282`, `:310`) e o relay encaminha o forwarder via `DispatchQueue.main.async` (`:179`). `DebugLogger` e o relay serializam acesso a UserDefaults via filas dedicadas (`:14`, `:70`).
- **Ativação garantida**: `OnCreate` chama `session.activate()` explicitamente (`:362-367`), com comentário correto explicando que o AppDelegate gerado pelo Expo não chama o relay.
- **Contexto pendente**: `sendApplicationContext` enfileira em `pendingApplicationContext` quando a sessão ainda não ativou (`:574-578`) e `handleSessionActivation` faz o flush após `.activated` (`:589-607`).
- **Sanitização de NSNull** antes de `updateApplicationContext` (`:543-558`) — evita `WCErrorCodePayloadUnsupportedTypes`.
- **iPad / device sem Watch**: no iPad `isSupported()` retorna `false` → `wcSession` fica `nil` e todas as funções fazem guard de nil (sem crash, apenas NSLog). Em iPhone sem Watch pareado, a sessão ativa normalmente; `updateApplicationContext`/`sendMessage` falham com erro capturado no `do/catch` (`:580-586`) ou rejeitam a Promise com `WATCH_UNREACHABLE` (`:610-612`). Comportamento seguro, mas silencioso (ver achado C-7).

### 1.2 Inventário de eventos — emitidos vs. tratados

O módulo emite **um único evento JS**: `onWatchMessage` (`Events("onWatchMessage")`, `:339`), com envelope `{type, payload}`.

| Tipo (Watch → iPhone) | Origem no Watch (`WatchSessionManager.swift`) | Tratado em |
|---|---|---|
| `SET_COMPLETE` | `:170` | `useWatchConnectivity.ts:74` → `app/workout/[id].tsx:248` |
| `START_WORKOUT` | `:187` | hook `:95` → `_layout.tsx:61` (WatchBridge) |
| `FINISH_WORKOUT` | `:217` | hook `:106` → `_layout.tsx:184` |
| `WORKOUT_HEALTH_SAMPLES` | `:236` | hook `:155` → `_layout.tsx:294` |
| `CARDIO_COMPLETE` | `:253` | hook `:141` → `app/workout/[id].tsx:258` |
| `DISCARD_WORKOUT` | `:266` | hook `:178` → `_layout.tsx:257` |

**Nenhum evento emitido fica sem handler** e nenhum handler escuta tipo inexistente. No sentido inverso (iPhone → Watch: `SYNC_SUCCESS`, `SESSION_SYNC`, `UPDATE_EXERCISE_ORDER`, `START_WORKOUT_FROM_PHONE`, `WORKOUT_FINISHED_FROM_PHONE`, `WORKOUT_DISCARDED_FROM_PHONE`, `SET_COMPLETE_FROM_PHONE`) todos os 7 tipos têm `case` no `handleIncomingMessage` do Watch (`WatchSessionManager.swift:422-502`).

**Cleanup de listeners**: correto nos dois consumidores. `useWatchConnectivity.ts:190-194` retorna `subscription.remove()` no unmount com deps `[]` (subscribe-once + refs estáveis para callbacks — padrão correto). O "WatchBridge" não é `components/WatchBridge.tsx` (arquivo não existe); é a função `WatchBridge()` definida inline em `app/_layout.tsx:44-399`, montada apenas no iOS (`:523`) e fora do `AuthProvider`. Seus efeitos fazem cleanup de timers (`:350`, `:377`) e do subscription de auth (`:395`).

Observação não-bug: `SET_COMPLETE` e `CARDIO_COMPLETE` só são tratados quando a tela `workout/[id]` está montada (o WatchBridge não passa esses callbacks). Série marcada no Watch com a tela fechada é descartada no JS — mitigado porque o `FINISH_WORKOUT` carrega o estado completo de todas as séries.

### 1.3 Achados

#### C-1 — `WCSessionRelay.activate()` nunca é chamado: a persistência "persist first" é código morto — **Alto** (confirmado por leitura)

`ios/WatchConnectivityModule.swift:56-90` documenta o design: o relay seria ativado no `AppDelegate.didFinishLaunching`, viraria delegate do WCSession e **persistiria em UserDefaults** todo evento recebido antes do JS subir ("This guarantees events survive app kills, OOM, and delegate-swap race conditions"). Porém:

- `grep` em todo o repo (Swift/ObjC/TS/JS, incluindo `mobile/ios/Kinevo/AppDelegate.swift` gerado): `WCSessionRelay` só aparece dentro do próprio módulo. **Ninguém chama `activate()`** — o próprio comentário em `:357-361` admite isso ("Expo's auto-generated AppDelegate doesn't include it").
- Sem `activate()`, o relay nunca vira delegate (`WCSession.default.delegate = self` está dentro de `activate()`, `:84`). O delegate efetivo é sempre o `SessionDelegate` setado no `OnCreate` (`:353`).
- Consequência: `consumePendingEvents()` no `OnCreate` (`:370`) sempre retorna vazio, e o único buffer real de eventos pré-JS é `bufferedWatchEvents` — **in-memory** (`:333`). Se o iOS matar o processo entre a entrega do `transferUserInfo` (callback do delegate já executado → sistema considera entregue) e o attach do listener JS, um `FINISH_WORKOUT` é perdido de verdade — exatamente o cenário que o relay foi escrito para impedir.

**Impacto concreto**: perda silenciosa de treino finalizado no Watch em cold start + kill precoce (OOM, crash do JS no boot). O Watch mantém o pending até receber `SYNC_SUCCESS`, o que reduz o dano (retransmite depois), mas a janela existe e a "garantia" documentada no código é falsa.

**Correção sugerida**: chamar `WCSessionRelay.shared.activate()` o mais cedo possível no processo nativo — ou via `ExpoAppDelegateSubscriber` (Expo Modules suporta `OnCreate` de AppDelegateSubscribers sem patch manual), ou movendo a persistência em UserDefaults para dentro do `SessionDelegate`/`emitWatchMessageEvent` (persistir em `bufferedWatchEvents` espelhado em UserDefaults e limpar após flush). Alternativa mínima: deletar o relay e documentar que o buffer é in-memory (reduz 150 linhas de código morto enganoso).

#### C-2 — Corrida de threads em `bufferedWatchEvents`/`hasJSListeners` — **Médio** (hipótese forte; precisa teste com TSan)

`emitWatchMessageEvent` lê/escreve `hasJSListeners` e `bufferedWatchEvents` sempre na **main thread** (`:670-691`, via os `DispatchQueue.main.async` dos delegates). Mas `OnStartObserving`/`OnStopObserving` (`:385-403`) rodam na thread em que o runtime Expo invoca lifecycle do módulo (tipicamente a thread JS / fila do módulo, não a main), e lá o código muta `hasJSListeners = true` e faz `removeAll()` no array **sem nenhum lock/fila**. `OnCreate` (`:341-383`) também escreve no array em outra thread.

**Impacto concreto**: em cold start com evento chegando do Watch no exato momento em que o JS atacha o listener, há data race em um `Array` Swift (não thread-safe) — pode perder evento, duplicar, ou crashar (heap corruption). Janela pequena, mas é justamente o caminho crítico do `FINISH_WORKOUT` em cold start.

**Correção sugerida**: serializar todo acesso a `bufferedWatchEvents`/`hasJSListeners` numa fila dedicada (como já se faz no relay), ou despachar o corpo de `OnStartObserving`/`OnStopObserving` para a main thread.

#### C-3 — `isWatchReachable()` no TS sem null-guard: TypeError no Android — **Médio** (confirmado por leitura)

`src/WatchConnectivityModule.ts:113-115`:

```ts
export function isWatchReachable(): boolean {
  return WatchConnectivityModule.isWatchReachable?.() ?? false;
}
```

Todas as outras funções fazem `if (!WatchConnectivityModule)` antes (o módulo é `null` fora do iOS, `:16-18`). Aqui o optional chaining está no **método**, não no objeto — no Android `null.isWatchReachable` lança `TypeError`. Hoje o único caminho Android que chama isso é o `useEffect` de init do hook (`useWatchConnectivity.ts:59-66`), que por sorte está num `try/catch`; mas `checkWatchReachable` (`:207-209`) é exportado sem proteção e a tela `workout/[id].tsx` monta o hook no Android.

**Correção sugerida**: `return WatchConnectivityModule?.isWatchReachable?.() ?? false;`.

#### C-4 — Relay persiste e nunca limpa eventos já encaminhados (duplicação em cold start futuro) — **Baixo** (dormante enquanto C-1 existir)

`handleIncoming` (`:169-186`) **sempre** persiste o evento em UserDefaults (passo 1) e depois encaminha (passo 2), mas não remove o evento persistido após forward bem-sucedido. Se C-1 for corrigido ativando o relay, todo evento processado em runtime seria re-entregue no próximo cold start via `consumePendingEvents` → reprocessamento de `FINISH_WORKOUT` dias depois (o dedup do WatchBridge é de só 5s, `_layout.tsx:197`). O comentário do design assume idempotência por upsert, o que merece validação. **Correção**: limpar o evento persistido quando o forward é entregue, ou marcar com id e deduplicar no consumo.

#### C-5 — Reachability/pairing nunca notificados ao JS — **Baixo** (confirmado)

Nenhum dos delegates implementa `sessionReachabilityDidChange` nem `sessionWatchStateDidChange`. O JS só descobre reachability puxando `isWatchReachable()` manualmente; mudanças de pareamento/instalação do Watch app (`isPaired`, `isWatchAppInstalled`) são apenas logadas (`:89`, `:124`) e nunca expostas. **Impacto**: a UI não tem como reagir a "Watch conectou no meio do treino" sem polling. **Correção**: emitir um evento `onWatchStateChange` com `{isPaired, isWatchAppInstalled, isReachable}`.

#### C-6 — Buffer in-memory sem limite — **Baixo** (confirmado)

`bufferedWatchEvents` (`:333`) cresce sem teto enquanto o JS não atacha (ex.: erro fatal no bundle JS com app nativo vivo). Payloads de `FINISH_WORKOUT` + séries + HR series podem ser grandes. **Correção**: cap (ex.: 50 eventos) com descarte dos mais antigos exceto tipos críticos.

#### C-7 — Falhas de envio são só logadas; JS não tem retorno — **Baixo** (confirmado)

`syncWorkoutToWatch`/`syncProgramToWatch`/`sendReliableToWatch` são `Function` (void). Erro de `updateApplicationContext` (`:585`) ou sessão não-ativada em `sendReliableToWatch` (`:651-653` — aqui nem o fallback `transferUserInfo` acontece, a mensagem morre) não chegam ao JS. **Correção**: retornar boolean ou virar `AsyncFunction` com reject, e em `sendReliableToWatch` enfileirar via `transferUserInfo` mesmo com sessão não ativada (o sistema enfileira após ativação).

#### C-8 — Detalhe menor: Swift version divergente — **Baixo**

`KinevoWatchConnectivity.podspec:10` declara `swift_version 5.4` (módulo iPhone); o plugin do Watch fixa `SWIFT_VERSION 5.0` (`with-watch-app.js:211`). São targets diferentes, sem conflito real — só inconsistência cosmética de manutenção.

---

## 2. Config plugin `mobile/plugins/with-watch-app.js`

### 2.1 O que ele faz, passo a passo (414 linhas, lidas por inteiro)

1. **Constantes** (`:14-17`): target `KinevoWatch`, bundle `com.kinevo.mobile.watchkitapp`, `WATCHOS_DEPLOYMENT_TARGET = 10.0`, companion `com.kinevo.mobile`.
2. **Resolução dinâmica de UUIDs** (`:39-82`): localiza `PBXProject`, main target (primeiro `product-type.application` que não seja `KinevoWatch` nem `WorkoutActivity`), grupo `Products` e `mainGroup` por estrutura/nome — boa prática, com `throw` explícito se não achar (lição aprendida de UUIDs hard-coded que quebravam em `prebuild --clean`, comentário `:19-23`).
3. **Idempotência** (`:96-103`): se o target já existe, pula tudo (inclusive o passo 13 — ver achado P-5).
4. **Injeção no pbxproj** (dentro de `withXcodeProject`):
   - `PBXFileReference` do produto `KinevoWatch.app` (`:132`);
   - `PBXFileSystemSynchronizedRootGroup` apontando para `../targets/watch-app` (`:145`) + exception set excluindo `Info.plist` (`:161`) — recurso de pbxproj do **Xcode 16**;
   - build phases Sources/Frameworks/Resources vazias (`:170-192`, sincronizadas pelo file-system group);
   - build configurations Debug/Release (`:195-238`) com `SDKROOT watchos`, `TARGETED_DEVICE_FAMILY "4"`, `GENERATE_INFOPLIST_FILE YES` + `INFOPLIST_FILE` do `targets/watch-app/Info.plist`, entitlements, `WKCompanionAppBundleIdentifier`, versão/build herdados do `app.json` (`:86-88`);
   - `PBXNativeTarget` com **`productType: "com.apple.product-type.application"`** (`:268`);
   - registro no `PBXProject.targets` + `TargetAttributes` (`:272-284`);
   - `PBXTargetDependency` do app principal → Watch (`:286-313`);
   - **Embed Watch Content**: `PBXCopyFilesBuildPhase` com `dstSubfolderSpec: 16` e `dstPath "$(CONTENTS_FOLDER_PATH)/Watch"` no target principal (`:315-345`) — o mecanismo correto de embedding de watch app;
   - produto no grupo Products e file group no mainGroup (`:347-359`).
5. **Scheme** (`:363-399`): injeta `BuildActionEntry` do KinevoWatch no `Kinevo.xcscheme` via regex/string replace — sem isso o archive não embeda o Watch ("Apple Watch: Não" no TestFlight).
6. **Entitlements do iPhone** (`:404-409`): adiciona `com.apple.developer.healthkit` via `withEntitlementsPlist`.

Complemento fora do plugin: `app.json:106-119` registra `KinevoWatch` em `extra.eas.build.experimental.ios.appExtensions` para o EAS provisionar credenciais do bundle id do Watch.

### 2.2 productType — o que está em uso hoje (confirmado)

- Plugin: `'"com.apple.product-type.application"'` (`with-watch-app.js:268`).
- pbxproj gerado (`mobile/ios/Kinevo.xcodeproj/project.pbxproj`, gitignored): dois targets `com.apple.product-type.application` (Kinevo + KinevoWatch) + `app-extension` (WorkoutActivity) — consistente.
- `APPLE_WATCH.md:41-43` documenta o trade-off: `watchapp2` causa "Multiple commands produce" no Xcode 15+, então usam o genérico, e atribui a isso o fato de WatchConnectivity não funcionar no simulador (erro `WCErrorDomain 7006 "Watch app is not installed"`).

**Nuance importante (hipótese que precisa de teste)**: `com.apple.product-type.application.watchapp2` é o tipo **legado** (par WatchKit App + Extension, watchOS ≤ 8). Watch apps single-target modernos criados pelo Xcode 14+ usam exatamente `com.apple.product-type.application` com `SDKROOT watchos` + `WKApplication` — que é o que este plugin gera. Ou seja, a explicação do `APPLE_WATCH.md` ("o genérico não é reconhecido como Watch app") é provavelmente incorreta; a causa real do 7006 no simulador deve estar em outro lugar (instalação do app no simulador do Watch via scheme separado em vez de embed, pareamento de simuladores, ou ordem de instalação). Isso importa porque condiciona a expectativa sobre a migração para o bacons (ver 2.4).

### 2.3 Fragilidade a upgrades de Expo/Xcode

#### P-1 — `PBXFileSystemSynchronizedRootGroup` com `objectVersion = 54` — **Médio** (confirmado por leitura; consequência precisa de teste)

O pbxproj gerado pelo template do Expo 54 declara `objectVersion = 54`, mas o plugin injeta objetos `PBXFileSystemSynchronizedRootGroup`/`...ExceptionSet` (4 ocorrências no pbxproj atual), que pertencem ao formato do **Xcode 16** (`objectVersion 77`). Funciona hoje porque o `xcodebuild`/Xcode 16 é tolerante, mas: (a) o projeto fica **inabrível/instável em Xcode 15 ou anterior**; (b) qualquer ferramenta que faça round-trip do pbxproj (o próprio pacote `xcode` do Expo em versões futuras, cocoapods edge cases) pode descartar ou corromper buckets que não conhece. **Correção sugerida**: documentar requisito de Xcode 16+ no `APPLE_WATCH.md`/EAS image, ou trocar por `PBXGroup` + build files explícitos (mais verboso, formato clássico).

#### P-2 — Hardcodes de versão/nome — **Médio** (confirmado)

- `WATCH_DEPLOYMENT_TARGET = '10.0'` (`:16`) e `SWIFT_VERSION: '5.0'` (`:211`) — fixos no plugin, não derivados do `app.json` nem do projeto;
- Team ID com fallback hardcoded `'3D5M22J52M'` (`:86`) — se `appleTeamId` sumir do `app.json`, builds de outra conta assinam silenciosamente com team errado;
- caminho do scheme assume nome do projeto: `'Kinevo.xcodeproj/xcshareddata/xcschemes/Kinevo.xcscheme'` (`:368`) — renomear o app no `app.json` quebra o embed silenciosamente (o `fs.existsSync` falha e o plugin segue sem warning);
- `CreatedOnToolsVersion: '15.0'` (`:281`) — cosmético;
- exclusão do target `'WorkoutActivity'` por nome literal na detecção do main target (`:56`) — novo target de extensão com outro nome que seja `application` quebraria a heurística (hoje só App Clips/watch seriam `application`, risco baixo).

**Impacto concreto**: upgrades de Expo (template novo de pbxproj/scheme) ou renomeações exigem revisar o plugin manualmente; falhas são silenciosas (build passa, Watch some do bundle). **Correção**: derivar nome do projeto de `config.modRequest.projectName`, falhar com erro quando o scheme não for encontrado, ler deployment target de constante compartilhada.

#### P-3 — Edição do scheme por string-replace — **Baixo** (confirmado)

`scheme.includes(WATCH_TARGET_NAME)` (`:374`) é um check frágil (qualquer comentário contendo "KinevoWatch" satisfaz) e o replace de `'</BuildActionEntries>'` assume formatação exata do XML gerado. Funciona com o template atual do Expo; pode quebrar silenciosamente em template futuro.

#### P-4 — Buckets do pbxproj assumidos como existentes — **Baixo** (confirmado)

`:170/:178/:186/:216/:241/:254` escrevem em `objects['PBXSourcesBuildPhase']` etc. sem criar o bucket se ausente (diferente de `:142`, `:287`, `:316` que criam). Num template mínimo sem esses buckets seria `TypeError`. Na prática o app principal sempre os tem — risco teórico.

#### P-5 — Idempotência pula a reparação do scheme — **Baixo** (confirmado)

O early-return (`:100-102`) acontece antes do passo 13. Cenário: pbxproj preservado mas scheme regenerado (sync parcial do diretório `ios/`, que é gitignored) → Watch fora do archive sem nenhum log de erro. Risco baixo porque o fluxo normal é `prebuild --clean` (regenera ambos).

### 2.4 `@bacons/apple-targets` — por que existem duas abordagens, e se migrar resolve

**História reconstruída via git** (`git log --follow -- mobile/plugins/with-watch-app.js`, `git log -S '@bacons/apple-targets' -- mobile/package.json`, `git log -- mobile/targets/`):

| Data | Commit | Evento |
|---|---|---|
| 2026-02-10 | `bc7f3cd` | `@bacons/apple-targets: ^4.0.0` entra no `package.json` — para o widget de **Live Activity** (`targets/workout-activity/expo-target.config.js`, `type: "widget"`) |
| 2026-02-11 | `d9fd1b4` | Watch app criado **um dia depois** com o plugin custom, cujo cabeçalho (`:5-6`) justifica: "Since @bacons/apple-targets does not support watchOS, this plugin manually adds all necessary PBX objects" |
| 2026-02-27 | `323c810` | Fix de sync + HealthKit (plugin retocado) |
| 2026-06-08 | `cb964d1` | Overhaul (UUIDs dinâmicos, scheme injection) |

**Conclusão sobre "migração pela metade": não há.** As duas abordagens têm papéis disjuntos e estáveis: bacons gerencia só o widget `WorkoutActivity` (único `expo-target.config.js` do repo; `targets/watch-app/` não tem config do bacons), e o plugin custom gerencia só o Watch. O plugin até coopera com o bacons (comentário `:354` sobre o grupo `expo:targets` e ordem de execução dos mods — `./plugins/with-watch-app` vem depois de `@bacons/apple-targets` no `app.json:81-82`, então seu mod de xcodeproj roda antes).

**A premissa do plugin está desatualizada**: o `@bacons/apple-targets@4.0.6` instalado em `node_modules` **suporta `type: "watch"`** (`build/target.js:73-76`) — gera target com `productType: "com.apple.product-type.application"`, `needsEmbeddedSwift`, embute via "Embed Watch Content" (`build/with-xcode-changes.js:266`), seta `INFOPLIST_KEY_WKCompanionAppBundleIdentifier` automaticamente a partir do bundle id do app principal (`build/configuration-list.js:285`), e ainda suporta `type: "watch-widget"` (complicações). Não foi possível confirmar por leitura se a versão disponível em fev/2026 já tinha esse suporte — é plausível que a premissa fosse verdadeira na época.

**A migração resolveria o productType/simulador?** **Não por si só** — o bacons usa exatamente o mesmo `com.apple.product-type.application` que o plugin custom já usa (confirmado no código do pacote). Como discutido em 2.2, esse productType é o correto para watch apps modernos; o diagnóstico do `APPLE_WATCH.md` atribuindo o erro 7006 do simulador ao productType é provavelmente um equívoco, e o problema do simulador tem outra causa (hipótese que só um experimento de build resolve — ex.: comparar com um projeto Xcode nativo puro nos mesmos simuladores).

**Recomendação** (descrita, não implementada):
1. **Migrar o Watch para `@bacons/apple-targets`** criando `targets/watch-app/expo-target.config.js` com `type: "watch"`, `deploymentTarget`, `bundleIdentifier: ".watchkitapp"` e entitlements — e aposentar as ~400 linhas do plugin custom (mantendo só o `withEntitlementsPlist` do HealthKit do iPhone, se o `app.json` não cobrir — hoje `app.json:21-24` já declara, tornando o passo 2 do plugin redundante). Ganhos: scheme/embed/companion-id mantidos pelo pacote, menos superfície de quebra a cada upgrade de Expo, formato de pbxproj clássico (resolve P-1), um único mecanismo de targets no repo. Risco: regressão de detalhes finos (exceção do Info.plist, WKBackgroundModes — verificar se o Info.plist custom é respeitado; o bacons usa o `Info.plist`/`expo-target.config` do diretório do target).
2. **Validar em device + simulador antes de trocar** (a migração deve ser feita em branch com `prebuild --clean` + diff do pbxproj gerado + TestFlight com check "Apple Watch: Sim").
3. **Independente da migração**, corrigir a explicação do `APPLE_WATCH.md` sobre productType para não orientar decisões futuras com diagnóstico errado.

Severidade do conjunto: **Médio** (dívida de manutenção significativa, mas sem bug ativo hoje).

---

## 3. Entitlements e Info.plist (dois lados)

### 3.1 Matriz de consistência (tudo confirmado por leitura)

| Item | Watch (`targets/watch-app/`) | iPhone | Consistente? |
|---|---|---|---|
| Bundle ID | `com.kinevo.mobile.watchkitapp` (plugin `:15`, EAS `app.json:114`) | `com.kinevo.mobile` (`app.json:18`) | ✅ padrão `<companion>.watchkitapp` |
| `WKCompanionAppBundleIdentifier` | `Info.plist:25-26` = `com.kinevo.mobile` + `INFOPLIST_KEY_...` no plugin (`:204`) | — | ✅ (declarado em dobro, mesmos valores — inócuo) |
| `WKApplication` | `true` (`Info.plist:23-24`) | — | ✅ (watch app moderno) |
| HealthKit entitlement | `KinevoWatch.entitlements:5-8` (`healthkit` + `access []`) | `app.json:22` + plugin `:406-407` + gerado `ios/Kinevo/Kinevo.entitlements` (inclui `background-delivery` adicionado pelo @kingstinct) | ✅ dois lados |
| `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` | `Info.plist:31-34` (pt-BR) | Via plugin `@kingstinct/react-native-healthkit` (`app.json:86-87`; presentes no `ios/Kinevo/Info.plist:60-62` gerado) | ✅ — exigência da App Store atendida nos dois binários |
| `WKBackgroundModes` | `workout-processing` (`Info.plist:27-30`) | `UIBackgroundModes: remote-notification, fetch` (`app.json:32-35`) | ✅ correto p/ HKWorkoutSession no Watch |
| App Groups | **ausentes** | **ausentes** | ✅ coerente — nada no código usa `UserDefaults(suiteName:)`/container compartilhado; comunicação é 100% WCSession. (O `DebugLogger`/relay usam `UserDefaults.standard`, locais a cada lado.) |
| `aps-environment` | — | `production` (`app.json:23`) | ✅ (Watch não recebe push próprio) |
| Deployment target | watchOS **10.0** (plugin `:16/:213`) | iOS (Expo 54 default, 15.1+; podspec do módulo `:9` = 15.1) | ✅ sem conflito |
| Versão/build | `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` herdados de `app.json` (1.5.3 / 34) via plugin `:87-88, :199, :205` | idem | ✅ — App Store exige paridade de versão; resolvido por construção |

### 3.2 Achados

#### E-1 — `com.apple.developer.healthkit.access` vazio nos dois lados — **Baixo/informativo** (confirmado)

Array vazio (`KinevoWatch.entitlements:7-8` e gerado do iPhone) é correto enquanto só se usam tipos comuns (HR, calorias, workouts). Se um dia lerem tipos clínicos (`health-records`), precisará popular. Nenhuma ação agora.

#### E-2 — HealthKit do iPhone declarado em três lugares — **Baixo** (confirmado)

`app.json:21-24`, o passo 2 do plugin custom (`with-watch-app.js:404-409`) e o plugin do @kingstinct convergem no mesmo entitlement. Hoje os valores coincidem (merge idempotente), mas é tripla fonte de verdade — ao migrar para o bacons (seção 2.4), remover o `withEntitlementsPlist` do plugin e deixar `app.json` + @kingstinct.

#### E-3 — Ícone do Watch referenciado por duas vias — **Baixo** (hipótese; validar no build)

`Info.plist:5-6` declara `CFBundleIconName: AppIcon` e o plugin seta `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` (`:196`). Com `GENERATE_INFOPLIST_FILE YES` + `INFOPLIST_FILE` simultâneos (`:201-202`), o Xcode mescla chaves geradas com o arquivo — combinação que costuma funcionar, mas é a área clássica de rejeição de archive por ícone ausente se o asset catalog mudar de nome. Validar no próximo archive.

---

## Apêndice — fatos rápidos

- Módulo Swift: 692 linhas; emite 1 evento (`onWatchMessage`); 8 funções exportadas ao JS (`syncWorkoutToWatch`, `syncProgramToWatch`, `sendWorkoutState` (alias), `sendMessage`, `isWatchReachable`, `sendAckToWatch`, `sendReliableToWatch`, `getDebugLogs`/`clearDebugLogs`).
- `requireNativeModule` com guard `Platform.OS === 'ios'` (`src/WatchConnectivityModule.ts:16-18`) — evita crash de import no Android; comentário documenta corretamente o gotcha do `NativeModulesProxy` (que não dispara `OnStartObserving`).
- `mobile/ios/` é **gitignored** (`mobile/.gitignore:40`) — o pbxproj é sempre regenerado por `expo prebuild`/EAS, então toda a configuração do Watch vive exclusivamente no plugin (single source of truth, como deve ser num fluxo CNG).
- Watch side (`WatchSessionManager.swift:148-160`): também checa `isSupported()`, ativa no `init`, e tem mock data para simulador (`#if targetEnvironment(simulator)`).
