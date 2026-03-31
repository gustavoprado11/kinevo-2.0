# Melhorias de UI na Tela de Execução de Treinos — Apple Watch (v5)

## Status
- [x] Rascunho
- [x] Em implementação
- [x] Concluída

## Contexto

Após 6 rodadas de implementação, o conteúdo do header continua sobrepondo o relógio do sistema e sendo cortado pelas bordas arredondadas do Apple Watch.

### Histórico de tentativas que falharam
1. `.padding(.top, 8)` — insuficiente
2. `proxy.safeAreaInsets.top` — retorna 0 dentro do GeometryReader aninhado em TabViews
3. `.padding(.top, 30)` fixo — não se adapta ao display redondo
4. `.toolbar(.hidden, for: .navigationBar)` — removeu o botão de voltar mas o relógio persiste
5. `.padding(.trailing, 44)` / `.padding(.trailing, 58)` no nome — ajudou parcialmente mas não resolve recorte lateral do display redondo
6. `.scenePadding(.horizontal)` + `.scenePadding(.top)` — **NÃO FUNCIONA** dentro do GeometryReader

### Análise do problema raiz (v5 — DEFINITIVA)

A arquitetura é:
```
NavigationStack
  → WorkoutExecutionView (.toolbar(.hidden))
    → TabView (.verticalPage)
      → TabView (.page) — carrossel horizontal
        → ExerciseExecutionPage — ⚠️ GeometryReader ⚠️
```

**O GeometryReader é o problema.** O `GeometryReader` no watchOS consome (absorve) as safe area insets do seu container e fornece ao seu conteúdo um frame de tamanho total (full bleed). Isso faz com que:
- `proxy.safeAreaInsets.top` retorne 0 (a safe area já foi "consumida")
- `.scenePadding()` aplicado ao conteúdo DENTRO do GeometryReader não funcione (o sistema não sabe mais onde estão as margens de segurança)
- O conteúdo renderize sob o relógio do sistema e nas bordas arredondadas

**Evidência:** `.scenePadding()` funciona perfeitamente em views normais no watchOS (ex: `WorkoutDashboardView`, `WorkoutListView`). Só falha na `ExerciseExecutionPage` — a única que usa `GeometryReader`.

### Screenshots v6 confirmando o problema
- **"Mesa Flexora"**: Texto cortado na borda esquerda do display redondo. `.scenePadding(.horizontal)` não aplicou padding lateral.
- **"Agachamento Hack"**: Nome do exercício sobrepõe o relógio do sistema "14:13" no canto superior direito.

## Objetivo

Remover o `GeometryReader` da `ExerciseExecutionPage` para que `.scenePadding()` funcione corretamente, e o conteúdo respeite as safe areas do display redondo do Apple Watch.

## Escopo

### Incluído
- Remover `GeometryReader` de `ExerciseExecutionPage.body`
- Substituir `proxy.size.height < 170` por `WKInterfaceDevice.current().screenBounds.height`
- Substituir `proxy.safeAreaInsets.bottom` por padding fixo
- Manter `.scenePadding()` que agora funcionará sem o GeometryReader bloqueando

### Excluído
- Tudo que já funciona (haptics, accessibility, stats, undo timing, superset label, cards, etc.)

## Arquivos Afetados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `targets/watch-app/Views/WorkoutExecutionView.swift` | Remover GeometryReader, usar screenBounds para compact |

## Comportamento Esperado

### Fluxo do Usuário
O conteúdo do header (superset label, nome do exercício, anterior, série/dots) é exibido com margens adequadas ao display redondo do Apple Watch, sem sobreposição com o relógio do sistema em nenhum modelo.

### Fluxo Técnico

**Por que o GeometryReader existe hoje:**
O `GeometryReader` é usado apenas para:
1. `proxy.size.height < 170` → detectar modo compact
2. `proxy.safeAreaInsets.bottom > 0 ? 0 : 4` → padding inferior condicional

Ambos podem ser substituídos sem GeometryReader:

**1. Compact mode via screenBounds:**
```swift
// ANTES:
GeometryReader { proxy in
    let compact = proxy.size.height < 170
    // ...
}

// DEPOIS:
// Computed property no ExerciseExecutionPage:
private var compact: Bool {
    WKInterfaceDevice.current().screenBounds.height < 195
}
// Nota: screenBounds retorna o tamanho total da tela (não da page).
// Apple Watch SE 40mm: 162×197pt — NÃO é compact (height 197 > 195)
// Apple Watch 41mm: 176×215pt — NÃO é compact
// Apple Watch 45mm: 198×242pt — NÃO é compact
// O threshold 195 detecta apenas telas menores que 40mm (futuras ou hipotéticas).
// Se quiser que 40mm seja compact, usar threshold 200.
```

**2. Bottom padding fixo:**
```swift
// ANTES:
.padding(.bottom, proxy.safeAreaInsets.bottom > 0 ? 0 : 4)

// DEPOIS:
.padding(.bottom, 4)
```

**3. Body sem GeometryReader:**
```swift
var body: some View {
    if let exercise {
        ZStack(alignment: .top) {
            VStack(spacing: 0) {
                headerView(exercise: exercise, compact: compact)

                Spacer(minLength: compact ? 6 : 8)

                // ... cards, buttons (mesmo código, só remove "proxy" refs)
            }
            .scenePadding(.horizontal)
            .scenePadding(.top)

            // PR badge overlay
            if showPrBadge {
                VStack {
                    prBadgeView
                        .transition(.scale.combined(with: .opacity))
                    Spacer()
                }
                .scenePadding(.top)
            }

            // Undo banner overlay
            if showUndoBanner, let last = store.lastCompletedSet, last.exerciseIndex == exerciseIndex {
                VStack {
                    Spacer()
                    undoBannerView(last: last)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .padding(.bottom, compact ? 40 : 48)
                }
            }
        }
    }
    .foregroundStyle(.white)
    .background {
        Color.black.ignoresSafeArea()
    }
    .onAppear {
        if focusedInput == nil {
            focusedInput = .reps
        }
    }
}
```

**Mudanças-chave:**
1. `GeometryReader { proxy in` → removido
2. `let compact = proxy.size.height < 170` → `private var compact: Bool` computed property usando `WKInterfaceDevice.current().screenBounds.height < 195`
3. `proxy.safeAreaInsets.bottom > 0 ? 0 : 4` → `4` (fixo, em 3 locais)
4. `.background(Color.black.edgesIgnoringSafeArea(.all))` → `.background { Color.black.ignoresSafeArea() }` (syntax de closure para separar layout do background)
5. `.scenePadding(.horizontal)` e `.scenePadding(.top)` permanecem — agora funcionarão corretamente

## Critérios de Aceite
- [ ] Conteúdo do header não sobrepõe o relógio do sistema
- [ ] Conteúdo não é cortado pelas bordas arredondadas do display (esquerda e direita)
- [ ] O fundo preto continua indo até as bordas da tela (sem gap branco/cinza)
- [ ] Layout funciona em Apple Watch SE (40mm), Series 9 (41/45mm), e Ultra (49mm)
- [ ] O label "Superset · X de Y" é totalmente legível
- [ ] O nome do exercício é totalmente legível
- [ ] A linha "Anterior X × Y" é totalmente legível

### Regressões proibidas
- [ ] Cards de input, botão concluir série, undo banner, PR badge, rest timer — tudo continua funcionando
- [ ] Haptics, accessibility, tela de conclusão com stats — tudo mantido
- [ ] O undo timing de 1.8s antes do rest timer — mantido
- [ ] Digital Crown rotation para peso e reps — mantido
- [ ] Swipe hint, scale effect nos cards — mantido

## Restrições Técnicas
- Seguir convenções do CLAUDE.md
- **NÃO usar GeometryReader** — este é o problema raiz
- Usar `WKInterfaceDevice.current().screenBounds` para dimensões de tela
- Usar `.scenePadding()` para margens (funciona sem GeometryReader)
- Usar `.background { Color.black.ignoresSafeArea() }` com syntax de closure
- Não alterar o conteúdo visual do header, cards, botões
- Não alterar modelos, comunicação, persistência

## Edge Cases
- **Apple Watch SE (40mm):** Tela 162×197pt. `.scenePadding()` aplica margens menores proporcionais. O modo compact depende do threshold escolhido (195 ou 200).
- **Apple Watch Ultra (49mm):** Tela maior, `.scenePadding()` aplica margens adequadas automaticamente.
- **Modo compact:** Agora baseado em `screenBounds.height` que é constante por device (não varia com o tamanho da page do TabView).
- **Scroll horizontal (carousel):** `.scenePadding()` se aplica a cada page igualmente.
- **Background preto:** `.background { Color.black.ignoresSafeArea() }` garante fundo preto até as bordas sem afetar o layout do conteúdo.

## Testes Requeridos

### Componentes
- [ ] Exercício normal: header completo visível, sem recorte nas bordas
- [ ] Exercício superset: label "Superset · X de Y" + nome completo visível
- [ ] Scroll horizontal entre exercícios: todos têm posicionamento correto
- [ ] Digital Crown funciona para peso e reps
- [ ] Botão "Concluir Série" funciona e aciona undo banner + rest timer
- [ ] Apple Watch SE (40mm): sem sobreposição, sem recorte
- [ ] Apple Watch Ultra (49mm): sem sobreposição, sem espaço excessivo

## Referências
- Screenshots v6: "Mesa Flexora" cortada na borda esquerda, "Agachamento Hack" sobrepondo relógio "14:13"
- [Apple HIG — Layout on watchOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-watchos)
- [WKInterfaceDevice.screenBounds](https://developer.apple.com/documentation/watchkit/wkinterfacedevice/screenbounds)

## Notas de Implementação

**Causa raiz identificada na v5:** O `GeometryReader` absorve as safe area insets do container, fazendo com que `.scenePadding()` e `.safeAreaInsets` não funcionem para o conteúdo dentro dele. Ao remover o GeometryReader e usar `WKInterfaceDevice.current().screenBounds` para compact detection, o `.scenePadding()` passa a funcionar corretamente.

**Tentativas anteriores que falharam (v1-v4):** padding fixo, safeAreaInsets do proxy, edgesIgnoringSafeArea, scenePadding dentro do GeometryReader — todas falharam porque o GeometryReader era o bloqueador.
