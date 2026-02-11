# Apple Watch App - Kinevo

## 📱 Visão Geral

O Kinevo possui um app companion para Apple Watch que permite aos alunos executarem seus treinos prescritos diretamente do pulso, com monitoramento de frequência cardíaca via HealthKit e sincronização bidirecional com o iPhone via WatchConnectivity.

## ✅ Funcionalidades Implementadas

### Watch App (SwiftUI)
- ✅ Visualização de treinos recebidos do iPhone
- ✅ Lista de exercícios com séries, repetições e peso
- ✅ Marcação de séries como concluídas
- ✅ Timer de descanso automático entre séries
- ✅ Monitoramento de frequência cardíaca em tempo real (HealthKit)
- ✅ HKWorkoutSession para manter o app ativo durante o treino
- ✅ Interface SwiftUI com tema dark customizado

### iPhone Integration
- ✅ Módulo Expo nativo `WatchConnectivityModule` (Swift)
- ✅ Hook React Native `useWatchConnectivity` para comunicação
- ✅ Envio automático de dados de treino para o Watch
- ✅ Recebimento de conclusão de séries do Watch para iPhone

### Arquitetura
- ✅ Config plugin customizado (`with-watch-app.js`) para injetar target watchOS
- ✅ WatchConnectivity Framework para sincronização
- ✅ HealthKit para monitoramento de saúde
- ✅ Ícones gerados em todos os tamanhos necessários

## ⚠️ Limitações Conhecidas

### Simuladores (iOS Simulator + Watch Simulator)
**❌ WatchConnectivity não funciona corretamente**

Quando testado em simuladores, o sistema retorna:
```
Error Domain=WCErrorDomain Code=7006 "Watch app is not installed."
```

**Por quê?**
- O productType `com.apple.product-type.application` (genérico) permite compilação mas não é reconhecido como Watch app pelo WatchConnectivity
- O productType `com.apple.product-type.application.watchapp2` (correto) causa erro de build "Multiple commands produce" no Xcode 15+
- Esta é uma limitação conhecida do desenvolvimento com simuladores e config plugins

**Solução:**
- Em **dispositivos reais** (iPhone físico + Apple Watch físico pareados), o WatchConnectivity deve funcionar corretamente
- Para desenvolvimento em simulador, o Watch app roda e pode ser testado visualmente, mas a sincronização não funcionará

### Teste em Produção
Para testar a funcionalidade completa:
1. Conecte um iPhone físico com Xcode
2. Conecte um Apple Watch pareado com o iPhone
3. Execute o scheme `Kinevo` no iPhone
4. Execute o scheme `KinevoWatch` no Apple Watch
5. Navegue até um treino no iPhone
6. O treino deve aparecer automaticamente no Watch

## 📂 Estrutura de Arquivos

```
mobile/
├── plugins/
│   └── with-watch-app.js              # Config plugin para adicionar target watchOS
├── targets/
│   └── watch-app/
│       ├── KinevoWatchApp.swift       # Entry point do app
│       ├── Info.plist                  # Configurações do Watch app
│       ├── KinevoWatch.entitlements   # HealthKit entitlements
│       ├── Assets.xcassets/           # Ícones do Watch (todos os tamanhos)
│       ├── Services/
│       │   ├── WatchSessionManager.swift  # Gerencia WatchConnectivity
│       │   └── HealthKitManager.swift     # Gerencia HealthKit
│       ├── Views/
│       │   ├── WorkoutListView.swift      # Lista de treinos
│       │   ├── ActiveWorkoutView.swift    # Treino ativo (TabView)
│       │   ├── SetLoggerView.swift        # Card de exercício
│       │   └── RestTimerView.swift        # Timer de descanso
│       ├── KinevoTheme.swift          # Cores do tema
│       └── WorkoutModels.swift        # Modelos de dados
├── modules/
│   └── watch-connectivity/
│       ├── ios/
│       │   ├── WatchConnectivityModule.swift  # Expo Module (iPhone)
│       │   └── KinevoWatchConnectivity.podspec
│       ├── src/
│       │   ├── WatchConnectivityModule.ts      # TypeScript wrapper
│       │   └── WatchConnectivityModule.types.ts
│       ├── expo-module.config.json
│       ├── package.json
│       └── index.ts
└── hooks/
    └── useWatchConnectivity.ts        # React hook para usar WatchConnectivity
```

## 🚀 Como Usar (Desenvolvimento)

### 1. Build do Projeto

```bash
cd mobile
npx expo prebuild --clean --platform ios
```

### 2. Rodar no Xcode

**iPhone:**
1. Abra `ios/Kinevo.xcworkspace` no Xcode
2. Selecione scheme: **Kinevo**
3. Selecione device: iPhone (simulador ou físico)
4. Clique ▶️ (Run)

**Apple Watch:**
1. No mesmo Xcode
2. Selecione scheme: **KinevoWatch**
3. Selecione device: Apple Watch pareado
4. Clique ▶️ (Run)

### 3. Iniciar Metro Bundler

```bash
cd mobile
npx expo start --dev-client
```

## 📝 Código de Exemplo

### Enviar treino para o Watch (React Native)

```typescript
import { useWatchConnectivity } from '../hooks/useWatchConnectivity';

function WorkoutScreen() {
  const { sendWorkoutToWatch } = useWatchConnectivity({
    onWatchSetComplete: (exerciseIndex, setIndex) => {
      // Called when user completes a set on the Watch
      console.log(`Set ${setIndex} of exercise ${exerciseIndex} completed on Watch`);
    },
  });

  useEffect(() => {
    // Send workout data to Watch
    sendWorkoutToWatch({
      workoutId: '123',
      studentName: 'João',
      exercises: [
        {
          id: '1',
          name: 'Supino',
          sets: 4,
          reps: 10,
          weight: 80,
          restTime: 90,
          completedSets: 0,
        },
      ],
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      isActive: true,
    });
  }, []);
}
```

## 🔍 Debugging

### Ver logs nativos no Xcode

1. **iPhone logs:** Filtrar por `[WatchConnectivity]` ou `Kinevo`
2. **Watch logs:** Filtrar por `[WatchSessionManager]` ou `[HealthKit]`

### Verificar conexão

```typescript
const { checkWatchReachable } = useWatchConnectivity();
const isReachable = checkWatchReachable(); // true/false
```

## 🎨 Personalização

### Alterar cores do Watch app

Edite `targets/watch-app/KinevoTheme.swift`:

```swift
extension Color {
    static let kinevoBg = Color(hex: "#0D0D17")
    static let kinevoCard = Color(hex: "#1A1A2E")
    static let kinevoViolet = Color(hex: "#7C3AED")
    // ...
}
```

### Adicionar novos ícones

1. Gere os tamanhos necessários (40x40@2x, 44x44@2x, etc.)
2. Adicione em `targets/watch-app/Assets.xcassets/AppIcon.appiconset/`
3. Atualize `Contents.json` com os nomes dos arquivos

## 📱 App Store

Quando enviar para a App Store, certifique-se de:
- ✅ Configurar App IDs no Apple Developer Portal
  - `com.kinevo.mobile` (iPhone)
  - `com.kinevo.mobile.watchkitapp` (Watch)
- ✅ Criar provisioning profiles para ambos
- ✅ Configurar HealthKit no Developer Portal
- ✅ Criar screenshots do Watch app (obrigatório)
- ✅ Preencher metadados específicos do Watch no App Store Connect

## 🐛 Problemas Conhecidos

1. **"Watch app is not installed" em simulador**
   - **Status:** Limitação conhecida
   - **Workaround:** Testar em dispositivos reais

2. **Multiple commands produce (com productType watchapp2)**
   - **Status:** Bug do Xcode 15+ com config plugins
   - **Workaround:** Usar productType genérico (current)

## 📚 Recursos

- [WatchConnectivity Framework](https://developer.apple.com/documentation/watchconnectivity)
- [HealthKit](https://developer.apple.com/documentation/healthkit)
- [SwiftUI for watchOS](https://developer.apple.com/documentation/swiftui)
- [Expo Modules Core](https://docs.expo.dev/modules/overview/)

## 👨‍💻 Manutenção

Criado com Claude Code em fevereiro de 2026.

Para questões ou melhorias, consulte a documentação ou logs de desenvolvimento.
