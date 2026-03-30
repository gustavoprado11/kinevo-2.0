# CLAUDE.md — Kinevo Mobile App

> Este arquivo é o contexto persistente para qualquer instância do Claude que trabalhe neste repositório.
> Leia INTEIRO antes de executar qualquer tarefa. Não questione decisões de arquitetura aqui documentadas.

---

## Visão Geral

Kinevo Mobile é o app usado por alunos (treino, histórico, mensagens, perfil) e por treinadores em campo (Trainer Mode — coaching ao vivo, gestão de alunos, formulários, financeiro). Inclui integração com Apple Watch para tracking de treino e frequência cardíaca.

**Monorepo:** Este repo é o workspace `mobile` dentro de `kinevo-monorepo`. Os workspaces são `web`, `mobile` e `shared`.

---

## Stack e Versões

| Tecnologia | Versão | Uso |
|---|---|---|
| React Native | 0.81.5 | Framework mobile |
| Expo | 54.0.0 | Plataforma + tooling |
| Expo Router | 6.0.0 | Navegação (file-based routing) |
| React | 19.1.0 | UI |
| TypeScript | 5.x | Tipagem estrita |
| NativeWind | 4.1.28 | Tailwind CSS para React Native |
| Zustand | 5.0.11 | Estado global |
| Supabase JS | 2.49.2 | Auth + DB + Realtime |
| Reanimated | 4.1.1 | Animações na UI thread |
| Lucide React Native | 0.563.0 | Ícones |
| Expo Notifications | 0.32.16 | Push notifications |
| MMKV | 4.2.0 | Storage nativo persistente |
| Expo Secure Store | — | Armazenamento seguro (tokens auth) |
| Expo Haptics | — | Feedback tátil |
| Expo Blur | — | Efeito glass morphism |
| Expo Image Picker | — | Seleção de imagens |

---

## Estrutura de Pastas

```
mobile/
├── app/                        ← Expo Router (file-based routing)
│   ├── _layout.tsx             ← Root layout (Stack + providers + watch bridge)
│   ├── index.tsx               ← Splash/redirect (auth → role → tela inicial)
│   ├── role-select.tsx         ← Seletor de papel (dual-role users)
│   │
│   ├── (auth)/                 ← Fluxo de autenticação
│   │   ├── login.tsx
│   │   └── verify-email.tsx
│   │
│   ├── (tabs)/                 ← Tabs do ALUNO
│   │   ├── _layout.tsx         ← Tab bar animada (4 tabs)
│   │   ├── home.tsx            ← Dashboard do aluno (treinos, progresso)
│   │   ├── inbox.tsx           ← Mensagens com treinador
│   │   ├── logs.tsx            ← Histórico de treinos
│   │   └── profile.tsx         ← Perfil e configurações
│   │
│   ├── (trainer-tabs)/         ← Tabs do TREINADOR (Trainer Mode)
│   │   ├── _layout.tsx         ← Tab bar do treinador (5 tabs)
│   │   ├── dashboard.tsx       ← Overview do treinador
│   │   ├── students.tsx        ← Lista de alunos
│   │   ├── training-room.tsx   ← Coaching ao vivo
│   │   ├── forms.tsx           ← Formulários
│   │   └── more.tsx            ← Configurações e billing
│   │
│   ├── workout/                ← Telas de treino (execução, histórico)
│   ├── exercises/              ← Biblioteca de exercícios
│   ├── inbox/[id].tsx          ← Thread de mensagem
│   ├── student/[id]/           ← Detalhe do aluno (trainer view)
│   ├── financial/              ← Billing e contratos
│   ├── profile/                ← Edição de perfil (nested layout)
│   └── training-room.tsx       ← Interface de coaching (rota raiz)
│
├── components/                 ← ~80 componentes React Native
│   ├── shared/                 ← Componentes reutilizáveis
│   │   ├── PressableScale.tsx  ← Botão com animação spring + haptics
│   │   ├── EmptyState.tsx      ← Estado vazio padrão
│   │   ├── ErrorState.tsx      ← Estado de erro padrão
│   │   ├── ScreenWrapper.tsx   ← Wrapper de tela (SafeArea + StatusBar)
│   │   ├── WorkoutCard.tsx     ← Card de treino na lista
│   │   ├── PaymentBlockedScreen.tsx ← Tela de bloqueio por billing
│   │   └── OtpInput.tsx        ← Input de código OTP (6 dígitos)
│   │
│   ├── workout/                ← Componentes de treino (15+ arquivos)
│   │   ├── ExerciseCard.tsx    ← Card de exercício com séries
│   │   ├── SetRow.tsx          ← Linha de série (peso/reps/check)
│   │   ├── SupersetGroup.tsx   ← Grupo de supersets
│   │   ├── RestTimerOverlay.tsx ← Timer de descanso
│   │   ├── CardioCard.tsx      ← Card de cardio
│   │   ├── WarmupCard.tsx      ← Card de aquecimento
│   │   ├── ExerciseSwapModal.tsx ← Modal de substituição
│   │   ├── ExerciseVideoModal.tsx ← Player de vídeo
│   │   ├── WorkoutCelebration.tsx ← Animação de conclusão
│   │   ├── WorkoutFeedbackModal.tsx ← Feedback pós-treino
│   │   └── sharing/            ← Templates de compartilhamento
│   │       ├── PhotoOverlayTemplate.tsx
│   │       ├── FullWorkoutTemplate.tsx
│   │       ├── SummaryTemplate.tsx
│   │       └── PRTemplate.tsx
│   │
│   └── WatchBridge.tsx         ← Bridge Apple Watch ↔ iPhone
│
├── contexts/                   ← Context providers
│   ├── AuthContext.tsx          ← Sessão, user, signIn/signOut
│   └── RoleModeContext.tsx      ← Troca de papel, perfil trainer, status subscription
│
├── hooks/                      ← 31 hooks customizados
│   ├── useWorkoutSession.ts    ← Core: gestão de sessão de treino (43KB)
│   ├── useActiveProgram.ts     ← Programa ativo, progresso semanal (13.6KB)
│   ├── useTrainerWorkoutSession.ts ← Sessão do trainer coaching (12.8KB)
│   ├── useLiveActivity.ts      ← iOS Live Activities (10.2KB)
│   ├── useTrainerChat.ts       ← Chat realtime (8.8KB)
│   ├── useWatchConnectivity.ts ← Comunicação Apple Watch (7.9KB)
│   ├── usePushNotifications.ts ← Registro + handling push (6.8KB)
│   ├── useInbox.ts             ← Threads de mensagem
│   ├── useExerciseLibrary.ts   ← Biblioteca de exercícios
│   ├── useWorkoutHistory.ts    ← Histórico de treinos
│   ├── useStudentDetail.ts     ← Detalhe de aluno (trainer)
│   ├── useStudentProfile.ts    ← Perfil do aluno
│   ├── useFinancialDashboard.ts ← Dashboard financeiro
│   ├── useTrainerDashboard.ts  ← Dashboard do trainer
│   ├── useStripeStatus.ts      ← Status de assinatura
│   ├── useSessionStats.ts      ← Estatísticas de sessão
│   ├── useStudentHeatmap.ts    ← Heatmap de treinos
│   ├── useStudentAccess.ts     ← Controle de acesso
│   ├── useWorkoutFormTriggers.ts ← Form triggers pré/pós treino
│   └── ...                     ← Outros hooks de domínio
│
├── lib/                        ← Utilitários e serviços
│   ├── supabase.ts             ← Cliente Supabase (SecureStore adapter)
│   ├── events.ts               ← Event emitter app-wide
│   ├── youtube.ts              ← Helpers de vídeo YouTube
│   ├── finishWorkoutFromWatch.ts ← Finalização via Watch (17.7KB)
│   ├── getProgramSnapshotForWatch.ts ← Snapshot do programa para Watch
│   └── getNextWorkoutForWatch.ts ← Próximo treino para Watch
│
├── stores/                     ← Zustand stores
│   └── training-room-store.ts  ← Estado do coaching ao vivo (16.9KB, MMKV persistence)
│
├── types/                      ← Tipos TypeScript locais
│   └── financial.ts            ← FinancialStudent, ContractEventType, FinancialDashboardData
│
├── modules/                    ← Módulos nativos Expo
│   ├── watch-connectivity/     ← WatchConnectivity Framework (Swift ↔ TS)
│   └── live-activity-controller/ ← iOS Live Activities (timer lock screen)
│
├── targets/                    ← Targets nativos
│   └── watch-app/              ← Apple Watch app (SwiftUI)
│       ├── KinevoWatchApp.swift
│       ├── Models/WorkoutExecutionState.swift
│       ├── Services/
│       │   ├── WatchSessionManager.swift    ← WatchConnectivity
│       │   ├── HealthKitManager.swift       ← Frequência cardíaca
│       │   ├── WorkoutExecutionStore.swift  ← State management
│       │   └── WorkoutStatePersistence.swift ← Persistência atômica JSON
│       ├── Views/
│       │   ├── WorkoutListView.swift
│       │   └── WorkoutExecutionView.swift
│       └── KinevoTheme.swift
│
├── plugins/                    ← Config plugins Expo
│   └── with-watch-app.js       ← Injeção do Watch app no Xcode project
│
├── assets/                     ← Imagens, ícones, splash
├── utils/                      ← Funções utilitárias
│   └── youtube.ts
│
├── app.json                    ← Config do Expo (bundle IDs, entitlements, plugins)
├── eas.json                    ← EAS Build profiles (dev, preview, production)
├── babel.config.js             ← NativeWind + Reanimated plugins
├── metro.config.js             ← Metro bundler (monorepo support)
├── tailwind.config.js          ← NativeWind theme (kinevo colors)
├── global.css                  ← Tailwind directives
└── APPLE_WATCH.md              ← Guia completo da integração Watch
```

---

## Convenções de Código

### Componentes React Native

- **Functional components** exclusivamente. Sem class components.
- **Naming:** PascalCase para componentes e arquivos (`ExerciseCard.tsx`, `SetRow.tsx`).
- **Imports:** `@/` para paths relativos à raiz do mobile. `@kinevo/shared/` para tipos compartilhados.
- **Estilização:** NativeWind (className) como padrão. `StyleSheet.create()` apenas quando NativeWind não suporta (ex: sombras complexas no Android).

### Hooks

- Prefixo `use` obrigatório.
- Um hook por arquivo em `hooks/`.
- Retornam objetos nomeados (não arrays).
- Pattern: busca Supabase + estado local + handlers de mutação.

### Navegação

- **Expo Router 6** (file-based routing).
- Grupos de rota: `(auth)`, `(tabs)`, `(trainer-tabs)`.
- Deep links suportados para notificações push.
- Redirecionamento por papel no `app/index.tsx`:
  - Sem sessão → `/login`
  - Email não verificado → `/verify-email`
  - Dual-role → `/role-select`
  - Trainer → check subscription → `/(trainer-tabs)/dashboard` ou blocked
  - Student → `/(tabs)/home`

### Animações

- **react-native-reanimated** para animações na UI thread.
- Spring configs customizadas (damping, stiffness) para micro-interações.
- **expo-haptics** em toda interação de toque:
  - `Haptics.impactAsync(Light)` para toques normais
  - `Haptics.impactAsync(Medium)` para ações importantes
  - `Haptics.selectionAsync()` para seleção

### TypeScript

- **Strict mode ativado** (via expo/tsconfig.base).
- Tipos do banco via `@kinevo/shared/types/database`.
- Path aliases: `@/*`, `@kinevo/shared/*`.

---

## Integrações

### Supabase

**Cliente único** em `lib/supabase.ts`:
- Usa `ExpoSecureStoreAdapter` para persistência segura de sessão.
- `autoRefreshToken: true`, `persistSession: true`.
- `detectSessionInUrl: false` (deep links não contêm tokens).

**Funcionalidades usadas:**
- **Auth:** Login email/password, OTP verification.
- **Database:** Queries diretas com `.from()`.
- **Realtime:** Subscriptions em `messages`, workout sessions.
- **Storage:** Avatars, imagens de mensagem.

### Apple Watch

**Arquitetura:**
- Módulo nativo `watch-connectivity` (Swift ↔ TypeScript via Expo Modules).
- Watch app em SwiftUI em `targets/watch-app/`.
- Comunicação via WatchConnectivity Framework (`transferUserInfo`, `sendMessage`).

**Funcionalidades:**
- Receber treinos do iPhone → executar no Watch.
- Marcar séries completas no Watch → sync para iPhone.
- Monitorar frequência cardíaca via HealthKit.
- Timer de descanso automático entre séries.
- HKWorkoutSession para manter app ativo.

**Limitações:**
- WatchConnectivity NÃO funciona no simulador. Testar em dispositivos reais.
- Guia completo em `APPLE_WATCH.md`.

### Push Notifications

- **Expo Notifications** para registro de token e handling.
- **FCM** para Android (google-services.json).
- **APNs** para iOS (production environment).
- Token registrado no backend via `/api/notifications/register-token`.
- Deep linking na notificação via expo-router.

### Live Activities (iOS)

- Módulo nativo `live-activity-controller`.
- Timer de descanso no lock screen durante treino.
- Suporta warmup e cardio com tracking de intervalos.

---

## Estado Global

### Contexts

| Context | Arquivo | Dados |
|---|---|---|
| `AuthContext` | `contexts/AuthContext.tsx` | Session, user, signIn, signOut |
| `RoleModeContext` | `contexts/RoleModeContext.tsx` | Role atual, perfil trainer, status subscription |

### Zustand Store

| Store | Persistência | Uso |
|---|---|---|
| `training-room-store` | MMKV (nativo) com fallback in-memory | Estado de coaching ao vivo (sessões ativas, exercícios, timer) |

---

## Design System — Apple HIG

### Cores

| Token | Valor | Uso |
|---|---|---|
| Primary/Brand | `#7c3aed` (Violet) | Ações principais, tab ativa, checkbox, progress |
| Background | `#0D0D17` | Fundo principal (dark) |
| Surface | `#1A1A2E` | Cards, modais |
| Text Primary | `#0f172a` | Texto principal |
| Text Secondary | `#64748b` | Texto secundário |
| Text Tertiary | `#94a3b8` | Texto auxiliar |
| Light Surface | `#F2F2F7`, `#ffffff` | Cards em contexto claro |
| Border | `#e8e8ed` | Bordas sutis |

### Regras Visuais

- **Fundos neutros.** Background escuro ou cinza claro. Cor como acento, não como fundo.
- **Sentence case** em labels e botões. Não Title Case, não UPPERCASE (exceto siglas).
- **Lucide icons exclusivamente.** Nunca emoji como ícone. Import de `lucide-react-native`.
- **BlurView** para efeito glass morphism (modais, tab bar no iOS).
- **SafeAreaView** obrigatório em todas as telas.
- **Haptics** em toda interação de toque.
- **Spring animations** — movimento natural, nunca linear/ease.

---

## Regras Invioláveis

1. **Zero novos erros de TypeScript.** O build EAS deve passar limpo.
2. **Sem `any`.** Tipos explícitos ou `unknown` com type guards.
3. **Mudanças cirúrgicas.** Nunca reescrever código que já funciona.
4. **Retrocompatibilidade obrigatória.** Toda mudança mantém funcionalidades existentes.
5. **Apple HIG.** Fundos neutros, cor como acento, sentence case, Lucide icons — nunca emoji.
6. **Haptic feedback obrigatório** em toda interação de toque.
7. **Reanimated para animações.** Nunca `Animated` do React Native base.
8. **SecureStore para dados sensíveis.** Tokens e sessões via Expo Secure Store.
9. **MMKV para persistência rápida.** Nunca AsyncStorage (performance inferior).
10. **WatchConnectivity só em dispositivo real.** Nunca assumir que funciona no simulador.

---

## Decisões de Arquitetura (não questionar)

- **Expo com Expo Router** (file-based routing, não React Navigation manual).
- **NativeWind** para estilização (Tailwind syntax em React Native).
- **Reanimated 4** para todas as animações.
- **MMKV** para storage local performático (não AsyncStorage).
- **Expo Secure Store** para tokens/sessões.
- **Módulos nativos Expo** para Watch e Live Activities (não bare React Native modules).
- **Monorepo npm workspaces** compartilhando tipos com web.
- **Dual-mode app** — mesmo app para aluno e treinador, com tabs diferentes por papel.
- **Supabase como backend** — sem API intermediária (queries diretas com RLS).
- **Portrait-only** (orientação fixa).

---

## Como Criar Novas Features

### Nova Tela

1. Criar arquivo em `app/[rota].tsx` ou `app/[grupo]/[rota].tsx`.
2. Usar `ScreenWrapper` para SafeArea + StatusBar.
3. Se precisar de dados, criar hook em `hooks/use[Feature].ts`.
4. Navegação via `router.push()` ou `<Link>` do expo-router.

### Novo Hook

1. Criar em `hooks/use[NomeDescritivo].ts`.
2. Buscar dados do Supabase no `useEffect`.
3. Retornar objeto nomeado: `{ data, loading, error, refetch, mutate? }`.
4. Cleanup de subscriptions Realtime no return do useEffect.

### Novo Componente

1. Arquivo em `components/[domínio]/[NomeComponente].tsx` ou `components/shared/[Nome].tsx`.
2. PascalCase no arquivo e no export.
3. NativeWind para styling. `StyleSheet` só quando necessário.
4. Haptics em interações de toque.
5. Reanimated para animações.

### Novo Módulo Nativo

1. Criar em `modules/[nome-do-modulo]/`.
2. Seguir estrutura dos módulos existentes (expo-module.config.json + Swift/Kotlin + TS wrapper).
3. Documentar limitações (ex: funciona apenas em device real).

---

## Variáveis de Ambiente

```env
EXPO_PUBLIC_SUPABASE_URL=https://[project].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
EXPO_PUBLIC_WEB_URL=https://www.kinevoapp.com
```

---

## Banco de Dados — Tabelas Mais Usadas no Mobile

> Tipos completos em `@kinevo/shared/types/database`. Gerar com `npm run gen:types` na raiz do monorepo.

| Tabela | Uso no Mobile |
|---|---|
| `students` | Perfil do aluno, lista de alunos (trainer) |
| `trainers` | Perfil do treinador (trainer mode + header do chat) |
| `assigned_programs` | Programa ativo do aluno |
| `assigned_workouts` | Treinos no programa |
| `assigned_workout_items` | Exercícios dentro do treino |
| `workout_sessions` | Sessão de treino ativa/completa |
| `set_logs` | Registros de séries |
| `messages` | Chat treinador ↔ aluno (Realtime) |
| `contracts` | Status de billing |
| `forms` / `form_submissions` | Formulários pré/pós treino |
| `exercises` | Biblioteca de exercícios |

---

## Comandos Úteis

```bash
# Dev
npm start                      # Expo start
npm run ios                    # iOS com scheme Kinevo
npm run android                # Android

# Build (EAS)
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform android

# Monorepo (da raiz)
npm run mobile                 # Alias para expo start
npm run gen:types              # Regenerar tipos compartilhados
```

---

## Referências

- `APPLE_WATCH.md` — Guia completo da integração Apple Watch.
- `targets/watch-app/` — Código SwiftUI do Watch app.
- `modules/` — Módulos nativos (watch-connectivity, live-activity-controller).
