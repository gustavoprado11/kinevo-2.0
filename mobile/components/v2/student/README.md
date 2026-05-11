# V2 Student · Signature Components

Apple Fitness-style components do **modo aluno**, isolados em `mobile/components/v2/student/`.
Construídos na Fase 5. Aplicação às telas reais (Home, Workout, Logs, Inbox, Profile do aluno)
é Fase B/6 futura — esta lib hoje vive em showcase route apenas.

## Filosofia

- **Motivacional, não utilitário.** Diferente do trainer V2 (que prioriza densidade de informação),
  o student V2 prioriza celebração e progresso: rings, streaks, PR badges, confetti.
- **Tokens v2 sempre.** Zero hex hardcoded em telas. Use `useV2Colors()` pra dark mode auto.
- **Apple Fitness DNA.** Triple ring, status dots semanais, gold-on-PR, haptic em cada toque.

Spec completa: `Kinevo_Mobile_Student_Redesign_v2.md` (raiz) · seções 4, 5, 6.

## Como importar

```ts
import {
    KRing,
    KStreakBadge,
    KWeekStrip,
    KPRCard,
    KSetRow,
    KRestTimer,
    KCelebration,
} from '@/components/v2/student';
```

## Componentes

| Componente        | Resumo                                                            | Variantes principais                          |
| ----------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| **KRing**         | Activity ring SVG circular progress                               | `single` / `triple`, sm/md/lg, 5 cores         |
| **KStreakBadge**  | Pill com 🔥 + count de streak                                      | `pill` / `compact`, xs/sm/md, optional glow    |
| **KWeekStrip**    | Calendar 7 dias com status dots + streak                          | tap handlers, today highlight                  |
| **KPRCard**       | PR card com sparkline progression + glow gold se recente           | `recent` flag, optional `data` p/ sparkline    |
| **KSetRow**       | Workout set: # / ant. / kg / reps / check                          | active, PR target, complete states             |
| **KRestTimer**    | Inline pill com countdown MM:SS                                    | `inline-pill` (overlay reservado p/ Fase C)    |
| **KCelebration**  | Modal overlay full-screen com confetti                            | `pr` / `workout-complete` / `streak-milestone` |

## Showcase (DEV only)

Long-press na linha de versão de `(tabs)/profile.tsx` (perfil do aluno) navega
para `/(dev)/student-showcase`. Mostra cada componente em 3-5 variantes lado a lado.
Gate `__DEV__` garante que rota não aparece em produção.

## Como contribuir (componente novo)

1. Arquivo `K[Nome].tsx` neste folder.
2. Tipos exportados (`K[Nome]Props`) no topo.
3. `useV2Colors()` pra cores. Zero hex literal em styling.
4. `react-native-reanimated` pra animações.
5. `expo-haptics` em toda interação primária.
6. Touch target ≥44pt em interativos + `accessibilityLabel` obrigatório.
7. Adicionar export em `index.ts`.
8. Adicionar section + 3-5 variantes em `app/(dev)/student-showcase.tsx`.

## Out of scope desta lib

- Aplicação às telas reais (Fase B/6).
- iOS Live Activity para rest timer overlay (Fase C/7).
- Sounds em PR / workout complete (Fase C/7).
