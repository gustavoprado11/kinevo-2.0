# Kinevo · Mobile · Modo Aluno · Redesign v2

> Plano estratégico para elevar o app mobile do aluno de "logger de treinos" para "Apple Fitness do seu treinador". Consume o design system V2 já em produção (commits `03ac7dd → 243056b` em `main`) e adiciona personalidade própria: motivação, conquistas, jornada.

**Artefatos relacionados:**
- Mock interativo: [`Kinevo_Mobile_Student_Redesign_v2.html`](computer:///Users/gustavoprado/kinevo/Kinevo_Mobile_Student_Redesign_v2.html)
- Trainer redesign (referência): [`Kinevo_Mobile_Trainer_Redesign_v2.html`](computer:///Users/gustavoprado/kinevo/Kinevo_Mobile_Trainer_Redesign_v2.html)
- Data: 11 de maio de 2026

---

## 1. Sumário executivo

O modo treinador foi redesenhado em 4 fases (tokens, componentes, telas, polish). O modo aluno **herda toda essa infra** mas tem psicologia completamente diferente:

- **Treinador** abre o app pra fazer trabalho: ver alunos, prescrever, ajustar
- **Aluno** abre o app pra **se motivar e treinar**: ver progresso, conquistar PRs, sentir-se acompanhado

Esse delta de propósito pede design diferente. Onde o trainer mode é **denso, eficiente, Linear-style**, o student mode precisa ser **emotivo, gamificado, Apple-Fitness-style**.

**Oportunidade:** o app aluno hoje está em "fitness logger genérico" (Hevy-like sem identidade). Subir pra "Apple Fitness do seu treinador" não exige novo design system — exige **5 componentes signature** consumindo os tokens V2 existentes:

1. **KRing** — Activity ring (3 ou 1 ring) Apple-Fitness style
2. **KStreakBadge** — contador "🔥 12 semanas" com flame animation
3. **KPRCard** — card de personal record com progression chart + glow gold
4. **KWeekStrip** — calendar strip semanal com dots de status
5. **KCelebration** — overlay de comemoração quando bate PR ou completa treino

Mais 2 componentes específicos pra workout execution (live training):
6. **KSetRow** — set com comparação ao anterior + check animado
7. **KRestTimer** — countdown inline pill (não modal disruptivo)

---

## 2. Diagnóstico do app atual (modo aluno)

Análise das 6 telas mostradas (Home, Workout Execution, Mensagens, Histórico, Desempenho, Perfil):

### Home (`mobile/app/(tabs)/home.tsx`)

**O que está bom:**
- Saudação contextual "Bom dia, Gustavo"
- Week strip com dia atual destacado em roxo
- Card "Programa de treinos III" com meta semanal
- "Treino de Hoje" com CTA "Iniciar"

**O que falta (do ponto de vista emocional):**
- Sem visualização de jornada/progresso histórico (você está há quanto tempo treinando?)
- Sem streak counter (psicologia da continuidade)
- Sem visual de conquistas/badges
- Meta semanal é barra plana, não anel (Apple Fitness aproveitaria muito melhor)
- "Treino de Hoje" não menciona PRs próximos a bater
- Sem resumo da última semana ("você levantou X ton, bateu Y PRs")
- Sem comparação contextual ("vs semana passada")

### Workout Execution (`mobile/app/workout/[id].tsx`)

**O que está bom:**
- Header dark com timer
- Tabela de sets por exercício
- Botão "Finalizar" sempre visível
- Componentes ExerciseCard, SetRow já bem componentizados

**O que falta:**
- Header é dark mas chapado — falta drama, presence (pulse animation, gradient roxo)
- Progress "0/18 séries" é texto, podia ser ring/bar com glow
- Sets row não destaca quando você está prestes a bater PR (sem "🏆 PR" badge)
- Rest timer só aparece como modal overlay — disruptivo
- Sem celebration micro-animation quando completa set / bate PR
- "Finalizar" é cinza/branco — falta progressão emocional (cinza → roxo conforme avança → gold quando 100%)
- Não compara o set atual com o anterior visualmente (só "30×8" tabular)

### Histórico (Histórico tab em `(tabs)/logs.tsx`)

**O que está bom:**
- Lista de treinos com data + tempo + volume + séries
- Badge "INTENSO" em alguns treinos (já há gamification leve!)
- Tab Histórico vs Desempenho

**O que falta:**
- Sem comparação trend (esse treino vs treinos anteriores do mesmo tipo)
- Sem badge "PR" pra treinos com PRs
- Sem sparkline mini mostrando evolução
- Header "Acompanhe sua evolução" é vago — falta narrativa ativa
- Sem resumo da semana atual (KPIs)

### Desempenho (Desempenho tab em `(tabs)/logs.tsx`)

**O que está EXCEPCIONAL:**
- "SUA JORNADA" com 3 números gigantes (25, 163, 12) — Apple Fitness vibe!
- "RECORDES PESSOAIS 🏆" como seção destacada
- Cards de PR com nome + peso + data

**O que falta pra ser perfeito:**
- 3 números são tabulares, podiam ser **rings concêntricos** (Move/Exercise/Stand-style)
- Sem chart de progressão histórica em cada PR card
- Sem badge "RECENTE" pra PRs quebrados nos últimos 7 dias
- Sem seção "Próximos PRs a quebrar" (predição motivacional)
- Sem insight narrativo ("você melhorou X% este mês")

### Mensagens (`(tabs)/inbox.tsx`)

**Observação:** os screenshots mostram bubbles de mensagem com fundo roxo gigantes — não tenho certeza se é design intencional (mensagens vazias = bubbles roxos cheios?) ou bug de carregamento de mídia. Vou assumir que são placeholders pra mensagens com imagem ou bubbles minimalistas que precisam ser repensados.

**O que está bom:**
- Tabs Mensagens / Notificações (organização correta)
- Header preto do trainer com avatar + nome

**O que falta:**
- Header trainer chapado — falta gradient, glow, status (online?)
- Sem indicação de presence ("responde em ~5min")
- Bubbles não têm timestamp visível em UI compacta
- Tab Notificações não tem ícones temáticos por tipo (PR, msg, workout)

### Perfil (`(tabs)/profile.tsx`)

**O que está bom:**
- Hero card com foto + nome + email
- Menu organizado: Configurações, Assinatura, Suporte, Privacidade
- "Modo Treinador" como link separado
- "Sair da conta" em vermelho sutil

**O que falta:**
- Hero é card branco genérico — falta personalidade (gradient + glow + plan badge)
- Sem estatísticas da jornada (treinos, volume, streak)
- Sem grid de achievements/badges
- Sem "Membro desde X meses"
- "Minha Assinatura" sem microcopy útil ("próx. cobrança em 12 dias")

---

## 3. Pesquisa de mercado — padrões 2026 em fitness apps

### Apple Fitness+ (gold standard de behavioral design)

- **Activity Rings (Move/Exercise/Stand)** — três anéis concêntricos, cada um com cor/objetivo. "Um dos elementos de behavioral design mais elegantes do fitness."
- **Badges + streaks** — recompensas por consistência (closing rings por X dias)
- **Weekly summaries** — análise da semana com trends
- **PR celebrations** — confetti animations + encouraging messages quando bate recorde
- **AI invisible coach** (2026) — análise contextual de biometria

### Hevy (líder strength training 2026)

- **Auto rest timer** que dispara ao marcar set completo + notifica quando rest acaba
- **iOS Live Activity** widget no lock screen mostrando próximo set + reps + peso, sem desbloquear o telefone
- **Plate calculator** com peso adequado por exercício
- **1RM history** por exercício
- **Haptic feedback** denso em ações importantes
- **Smooth dark mode** com tipografia mono no timer

### Strong App (refinamento UX)

- **Rest period timer** customizado por exercício (5s–5min)
- **One-rep max history** progression
- **Workout timer UX** mais polido que Hevy

### Strava (social fitness)

- **Activity feed** com PRs destacados
- **Comparison vs previous** — "você melhorou X em relação a Y"
- **Achievement badges** unlockable

### Linear / Stripe / Arc Browser (UI premium 2026)

- **Densidade controlada** com hierarquia tipográfica
- **Gradients sutis** em CTAs
- **Glass surfaces** em modais e nav
- **Tipografia premium** (Plus Jakarta Sans-style, peso 800, tracking negativo)

### Apple Music / Stripe Mobile (hero cards escuros)

- **Hero card escuro com gradient** + glow radial roxo
- **Plan badge gold** elegante
- **Glass effects** sutis

---

## 4. Princípios de design — modo aluno

### 4.1 Emocional vs Funcional

Onde trainer mode é "ferramenta de trabalho" (funcional), student mode é **"diário de bordo da jornada"** (emocional). Cada tela responde a "como o aluno se sente?".

### 4.2 Conquistas > Tarefas

Em vez de "você precisa treinar 5x", o app diz **"você treinou 5x"**. Foco em accomplishment, não em todo. Storytelling positivo.

### 4.3 Continuidade > Eventos isolados

Cada treino é parte de uma **jornada**: streak counter, progressão histórica, próximos PRs. Não eventos isolados.

### 4.4 Presence > Distance

O treinador está virtualmente presente: status online, "responde em ~5min", comentários no treino, encorajamento contextual.

### 4.5 Densidade emocional > Densidade informacional

Trainer mode prioriza informação por viewport. Student mode prioriza **emoção por interação**: gradients, glows, haptics, animations. Menos minimalismo, mais sensorial.

### 4.6 Apple-Fitness rings em todo lugar de progresso

Onde houver "X de Y", consideramos ring antes de barra. Anéis são mais emocionalmente engajantes e Apple users entendem instantaneamente.

---

## 5. Componentes signature — student mode

Estes são novos componentes em `mobile/components/v2/student/` (sub-pasta dedicada ao aluno). Reusam tokens V2 mas adicionam personalidade.

### 5.1 `KRing` (Activity ring)

- Props: `value`, `max`, `color` (purple/red/green/cyan/gold), `size` (sm/md/lg), `label?`, `centerContent?`
- SVG nativo com stroke-dasharray animado via Reanimated
- Variants: single ring (uma métrica) e triple ring (3 concêntricos Apple-style)
- Animação: 600ms spring na inicialização + transition em mudanças

**Uso:**
- Home: meta semanal (1 ring)
- Desempenho: 3 rings concêntricos da jornada total

### 5.2 `KStreakBadge`

- Props: `count`, `unit` ('semanas' | 'dias'), `size` (xs/sm/md), `withFlame` (bool)
- Visual: pílula com gradient âmbar/laranja + 🔥 emoji animado
- Quando `count >= 10`: extra glow effect

**Uso:** ubíquo na Home, Perfil, Desempenho

### 5.3 `KPRCard`

- Props: `exercise`, `value`, `unit`, `delta?: { kg, since }`, `recent?` (bool), `data?: number[]` (pra spark)
- Renderiza: card com nome + peso grande + delta + sparkline horizontal
- `recent=true` ativa border gold + glow gold (PR < 7 dias)
- Sparkline em gold se PR recente, roxo se progresso steady, neutral se estável

**Uso:** Desempenho tab + Perfil

### 5.4 `KWeekStrip`

- Props: `days` (array de 7 dias com `{ date, label, status }`), `activeDate`, `streak`
- Visual: 7 colunas com label + número + dot status
- Status colors: success (treinou), intense (treinou intenso), today (atual), future (futuro)
- Streak badge top-right

**Uso:** Home (sempre visível)

### 5.5 `KCelebration` (overlay)

- Props: `type` ('pr' | 'workout-complete' | 'streak-milestone'), `value?`, `onDismiss`
- Renderiza: overlay full-screen com confetti SVG animado + título + sub-texto + CTA "Compartilhar"
- Reanimated spring animation
- Auto-dismiss em 3-4s ou tap

**Uso:** quando aluno bate PR durante workout, ao completar treino, ao bater streak milestone (1 mês, 3 meses, etc.)

### 5.6 `KSetRow` (substitui SetRow legacy)

- Props: `setNumber`, `previous?: { weight, reps }`, `currentWeight`, `currentReps`, `onComplete`, `isPR` (bool), `isComplete` (bool)
- Visual: grid 5 colunas (# / Ant / kg / reps / ✓)
- Estados:
  - Idle: bg neutro, check vazio
  - PR target: glow gold no input
  - Complete: bg verde sutil, check verde com ring glow + haptic medium
  - PR complete: confetti micro + haptic strong + animação scale

### 5.7 `KRestTimer` (inline pill)

- Props: `duration`, `remaining`, `onSkip`
- Renderiza: pílula inline com countdown + sub-texto "Próximo: série X de Y"
- Animação: pulse pill conforme tempo diminui
- Notificação push quando termina (se app em background)
- **Não bloqueia tela** — só faz pulse contextual

---

## 6. Telas redesenhadas — síntese

A visualização completa está no mock HTML. Síntese textual:

### Home
- Header dual: saudação + chamada "Vamos treinar hoje?"
- Hero do programa com **KRing** + KStreakBadge
- **KWeekStrip** com dots de status + streak
- "Treino de hoje" card com KButton primary gradient + PR hint inline
- Grid 3 achievements (unlocked/locked/gold)
- Resumo da semana narrativo

### Treino ao vivo
- Header dark gradient com timer pulse + progress bar com glow
- Cards de exercício com estados: idle / active / PR
- Sets com **KSetRow** + comparação anterior + check animado
- **KRestTimer** inline (não modal)
- Finalizar button persistente gradient roxo

### Histórico
- Tabs Histórico / Desempenho
- Summary card roxo gradient (3 KPIs da semana)
- Lista com mini sparkline em cada card + badges (INTENSO/PR)
- Stats grid 3 colunas

### Desempenho
- 3 **KRing** concêntricos Apple-Fitness style (Total/Volume/Tempo)
- Insight narrativo "+18% volume · 100% aderência"
- **KPRCard**s com progression chart histórico
- "Próximos a quebrar" — nudge motivacional

### Mensagens
- Tabs Conversa / Atividade
- Trainer card escuro hero com avatar online + "responde em ~5min"
- Activity feed com ícones temáticos por tipo (PR/streak/workout/msg)
- Microcopy celebratório

### Perfil
- Hero escuro com gradient roxo + glow + avatar com ring + plan badge gold
- Estatísticas da jornada (3 stats inline na hero)
- Grid 4 achievements
- Menu items com microcopy ("próx. cobrança em 12 dias")
- "Modo Treinador" como card tinted roxo separado
- "Sair" em card vermelho sutil

---

## 7. Plano de implementação faseado

Considerando que o DS V2 já está em produção, a implementação do redesign aluno fica mais leve do que foi pro treinador (~3 fases ao invés de 4).

### **Fase A — Componentes signature** (~5-7 dias)

Criar os 7 componentes acima em `mobile/components/v2/student/`:
- KRing, KStreakBadge, KPRCard, KWeekStrip, KCelebration, KSetRow, KRestTimer
- Adicionar showcase route `mobile/app/(dev)/student-showcase.tsx`
- Trigger long-press oculto na versão da tela Perfil (igual ao trainer)
- Validações: typecheck, expo export, snapshot tests

### **Fase B — Aplicar nas 6 telas principais** (~7-10 dias)

In-place migrations seguindo padrão da Fase 2 do trainer:
- `(tabs)/home.tsx` — usar KRing, KStreakBadge, KWeekStrip + redesign hero programa
- `workout/[id].tsx` — usar KSetRow, KRestTimer + dramatic header
- `(tabs)/logs.tsx` Histórico — sparklines + badges + summary card
- `(tabs)/logs.tsx` Desempenho — KRing concêntrico + KPRCard + insights
- `(tabs)/inbox.tsx` — trainer card hero + activity feed redesign
- `(tabs)/profile.tsx` — hero escuro + journey stats + achievements grid

### **Fase C — Polish e celebrations** (~3-5 dias)

- KCelebration trigger em PRs (workout completion + streak milestones)
- Haptic feedback em todas as ações primárias (set complete, PR, finish)
- iOS Live Activity (lock screen widget mostrando próximo set/reps/peso)
- Dark mode coverage (deveria ser herdado via tokens v2, validar)
- Accessibility audit (accessibilityLabel em todos os interativos)

### Total: **~15-22 dias** (~3 sprints de calendário)

---

## 8. Métricas de sucesso

Quantitativas:
- **Aderência (treinos por semana)**: +20% no primeiro mês pós-release
- **Retenção D30**: +15% (target: 70%)
- **NPS modo aluno**: +20pp vs baseline atual
- **Tempo médio na tela "Desempenho"**: +40% (atualmente subutilizada)
- **PR celebrations exibidas/aluno/mês**: meta = ≥3 (proxy de engajamento)

Qualitativas:
- Compartilhamento orgânico de screenshots (sinal de orgulho)
- Reviews app store mencionando palavras como "motivador", "engaging", "vicia"
- Pesquisa "o app parece premium?" ≥ 4.5/5
- Mensagens não solicitadas pro suporte tipo "amei o novo design"

---

## 9. Riscos e mitigação

| Risco | Probabilidade | Mitigação |
|---|---|---|
| KRing performance ruim em listas | Baixa | Render apenas SVG path nativo (sem lib externa); memoize com `useMemo` |
| KCelebration trigger excessivo | Média | Throttle: max 1 celebration por sessão de treino; só pra PR realmente significativo (≥5kg ou 1RM) |
| iOS Live Activity exige ApplePay | n/a | Não exige — só `expo-live-activity` lib, mas avaliar custo de build native code |
| Streak counter cria pressão negativa em quem perde streak | Média | Após perder streak, mostrar mensagem encorajadora: "você teve 12 sem incríveis. Pronto pra começar de novo?" |
| Sparklines visuais em PRs sem dados suficientes | Alta | Fallback gracioso: ocultar spark se < 2 pontos; mostrar "Primeiro PR registrado!" |
| Achievements podem virar grind tóxico | Média | Curar achievements positivos (consistência, melhoria pessoal). Evitar comparação social agressiva |

---

## 10. Próximos passos

Decisão imediata: **quando começar?** Opções:

**Opção A: Após estabilização do trainer mode em produção (~1-2 semanas)**
- Validar que push do trainer não regrediu nada
- Coletar feedback real de treinadores
- Depois partir pro aluno
- Pro: menos overlap de risco
- Contra: tempo de calendário maior

**Opção B: Em paralelo (começar componentes da Fase A enquanto trainer mode é validado)**
- Aproveitar momentum
- Componentes podem ser desenvolvidos isoladamente (em showcase route)
- Aplicação nas telas só após validação trainer
- Pro: ganho de tempo
- Contra: working tree fica grande de novo

**Opção C: Apenas mock e plano agora — implementação no próximo ciclo**
- Documenta a visão completa
- Implementação aguarda
- Pro: zero risco operacional
- Contra: zero ganho imediato

Minha recomendação: **Opção B**. Componentes signature podem ser desenvolvidos em paralelo enquanto trainer mode é validado em produção. Aplicação nas telas começa após 1 semana de validação trainer.

---

## Apêndices

### A. Apps de referência analisados

- **Apple Fitness+** — Activity rings, badges, weekly summaries, PR celebrations
- **Hevy** — Auto rest timer, Live Activity widget, haptic feedback, plate calc
- **Strong** — Rest period polish, 1RM history, workout timer UX
- **Strava** — Activity feed, comparisons, achievement system
- **Whoop** — Recovery score gauge, sleep insights, training load
- **Levels** — Continuous data, sparklines, trends
- **Apple Music** — Hero card design, gradients vibrant
- **Stripe Mobile** — Premium card design, subtle gradients
- **Linear** — Density, hierarchy, segmented controls

### B. Estrutura de arquivos sugerida

```
mobile/
├── components/v2/
│   ├── student/                    ← NOVA pasta dedicada
│   │   ├── KRing.tsx               ← Activity ring
│   │   ├── KStreakBadge.tsx        ← Streak counter
│   │   ├── KPRCard.tsx             ← Personal record card
│   │   ├── KWeekStrip.tsx          ← Calendar strip
│   │   ├── KCelebration.tsx        ← Celebration overlay
│   │   ├── KSetRow.tsx             ← Workout set row
│   │   ├── KRestTimer.tsx          ← Rest timer pill
│   │   ├── utils/
│   │   │   ├── confetti.ts         ← Confetti SVG generator
│   │   │   └── ringCalculator.ts   ← Ring math helpers
│   │   ├── __tests__/
│   │   └── index.ts                ← Barrel export
│   └── ...                         ← V2 trainer components (já em produção)
└── app/
    ├── (tabs)/                     ← Modo aluno (telas a migrar)
    │   ├── home.tsx
    │   ├── inbox.tsx
    │   ├── logs.tsx
    │   └── profile.tsx
    ├── workout/[id].tsx            ← Workout execution (migrar)
    └── (dev)/
        └── student-showcase.tsx    ← Dev showcase route
```

---

**Fim do documento.** Para iniciar implementação, gerar SPEC_FASE_5.md (Componentes signature aluno) seguindo padrão das SPECs anteriores.
