# Kinevo · Mobile Trainer · Redesign v2

> Plano estratégico para elevar o app mobile do treinador de "SaaS funcional" para "Apple Fitness dos treinadores", consolidando o design system com o sistema web e estabelecendo identidade premium 2026.

**Documentos relacionados**

- Mock interativo: [`Kinevo_Mobile_Trainer_Redesign_v2.html`](computer:///Users/gustavoprado/kinevo/Kinevo_Mobile_Trainer_Redesign_v2.html)
- Auditorias técnicas: `Kinevo_Mobile_Trainer_UX_Analysis.md`, `Plano_Feedbacks_Usuario_2026-04.md`
- Data: 9 de maio de 2026
- Autor: Gustavo Prado (com auditoria automatizada de design tokens)

---

## 1. Sumário executivo

A crítica do ChatGPT está, na essência, **correta**: o mobile do treinador hoje passa "SaaS funcional 2021–2022", não premium 2026. Mas a auditoria técnica do código revela um problema mais profundo do que apenas refinamento visual:

**O mobile e o web do Kinevo NÃO compartilham design tokens.** Eles divergem em quase todas as decisões fundamentais:

| Token | Web | Mobile atual | Decisão Kinevo v2 |
|---|---|---|---|
| Fonte principal | Plus Jakarta Sans | System (SF Pro / Roboto) | **Plus Jakarta Sans** (unificar) |
| Primária | Azul iOS `#007AFF` + roxo accent `#7C3AED` | Roxo `#7c3aed` dominante | **Roxo `#7C3AED` como ação** + neutros como base |
| Card radius | `rounded-xl` (12px) | 24px | **12px** (padrão) |
| Texto secundário | `#6E6E73` (Apple HIG) | `#64748b` (Tailwind slate) | **`#3F3F46`** (mais contraste) |
| Sombra de card | `0 1px 3px rgba(0,0,0,0.08)` | `opacity: 0.03` (quase invisível) | `0 1px 3px rgba(9,9,11,0.06)` |
| Tokens compartilhados | n/a | Não importa de `/shared` | **`@kinevo/tokens` no monorepo** |

A oportunidade aqui não é só um redesign visual: é estabelecer um **design system unificado** que serve web e mobile, eliminando uma fonte permanente de débito visual e técnico. Esse é o entregável central deste plano.

O que o ChatGPT chamou de "look 2021-2022" é, na prática:

1. Tokens copiados do Tailwind defaults (slate-* genérico) em vez do que o web já estabeleceu como Apple HIG
2. Border-radius `24px` herdado de Material Design que envelhece mal
3. Sombras quase invisíveis que matam a profundidade
4. Pills de status em excesso (5 chips no header da Alunos!) sem hierarquia
5. Bottom nav flat de 50pt com ícones pequenos, sem identidade

A boa notícia: a base técnica é sólida. **NativeWind 4 + tema centralizado em `/mobile/theme/` + Expo Router** é o stack certo. Não precisamos refazer arquitetura — precisamos elevar tokens e refinar componentes.

---

## 2. Diagnóstico: o que concordo e discordo da crítica do ChatGPT

### Concordo integralmente

✅ **"Tudo parece ter o mesmo peso visual"** — confirmado no código: `shadow opacity 0.03` em todos os cards, sem hierarquia espacial. Não há `surface-elevated` distinta de `surface-card`.

✅ **"Excesso de cinza claro lavado"** — `text.tertiary: #94a3b8` é cinza Tailwind slate, sem peso visual. O web usa `#6E6E73` Apple HIG. Confirmado no código.

✅ **"Border-radius infantil/bubble"** — confirmado: `ProgressCard 24px`, `ActionCard 24px`, `WorkoutCard 20px`. O web usa `rounded-xl` (12px). Mobile precisa convergir.

✅ **"Bottom nav fraca, parece improvisado"** — confirmado: 50pt fixo, sem labels, sem indicador animado, só uma scale 1.08x no foco. Não há identidade visual.

✅ **"Pills demais"** — confirmado: `StudentFilterChips` tem 5 pills sempre visíveis com `borderRadius: 100`, todas com mesmo peso. `SessionStatusBadge`, `ActionCard badges`, etc. Falta consolidação.

✅ **"Falta gradiente sofisticado"** — o gradient atual é simples 2-stop. O web tem `.gradient-border` animado com 3-stop e `mesh-gradient`. Mobile não usa nenhum dos dois.

✅ **"Métricas estão fracas visualmente"** — KPIs hoje são apenas número grande + label. Não há sparkline, delta, contexto temporal. Confirmado em `dashboard.tsx`.

### Discordo (parcialmente)

⚠️ **"O roxo está bom mas espalhado demais como decorativo"** — concordo na intenção, **mas a solução não é reduzir o roxo**: é trocar onde ele é usado. O web usa azul iOS como primária e roxo só como accent/gradiente. Para o Kinevo (modo treinador, fitness, IA), o roxo deve ser sim protagonista — mas em **CTAs, item ativo, valor primário, gradiente do hero**, não em ícones genéricos. Ratio target: 5% roxo / 95% neutros.

⚠️ **"O app precisa de MAIS identidade — hoje parece Linear/Notion"** — discordo. O Kinevo está num nicho técnico (treinador, IA, performance) onde "parecer Linear" é elogio, não ofensa. O ChatGPT cita Linear logo depois como referência positiva. **A identidade Kinevo emerge de**: gradient roxo nos CTAs + hero card escuro com glow + sparklines em todas as métricas + avatares com gradiente individual + bottom nav floating glass.

⚠️ **"Reduzir radius para 16-20px"** — vou mais agressivo: **12px no card padrão**, alinhando com o web. 16px só em cards "hero" (perfil, CTA principal). 20px+ apenas em modais full-screen.

⚠️ **"FAB Material Design antigo"** — discordo da remoção. O FAB com gradient + glow roxo tem propósito claro: criar aluno. Adicionar/remover é o uso canônico de FAB e não é "antigo" — Linear, Notion, Apple Notes, todos têm. Vamos refinar visualmente, não remover.

### O que o ChatGPT esqueceu

📌 **Acessibilidade**: o app tem 13 instâncias de `accessibilityLabel` em todo o projeto (apontado no `Mobile_Trainer_UX_Analysis.md`). Premium 2026 inclui WCAG AA mínimo. Touch target 44pt mínimo (HIG).

📌 **Loading states**: o mobile usa `ActivityIndicator` em tela cheia. Premium 2026 = skeletons coreografados. Já mapeado no UX Analysis.

📌 **Dark mode**: o web tem dark mode completo via `.dark` class. O mobile não tem. Esse é o maior gap visual com a percepção "premium".

📌 **Tablet/iPad layouts**: zero adaptação responsiva. Treinadores avançados usam iPad para apresentar avaliações. Lacuna identificada e ainda não tratada.

---

## 3. Pesquisa de mercado: padrões 2025–2026

A análise sintetiza referências dos apps mais relevantes para o Kinevo, com foco no que é aplicável ao mobile do treinador.

### Liquid Glass / iOS 26 (Apple)
A grande mudança de 2026 é o material **Liquid Glass** — translúcido, reativo ao conteúdo abaixo, usado em tab bars, toolbars e popovers. **Tab bar floating** virou padrão: não está mais "colada" ao fundo, flutua, comprime ao scrollar e expande no scroll-up. Apps como Apple Fitness, Fantastical e AllTrails já adotaram. **Aplicação Kinevo**: bottom nav com `BlurView` Expo (intensity 80, tint white), bordas arredondadas, separação visual do conteúdo via padding 12pt + bottom inset. Documentado no mock.

### Densidade voltou (Linear, Stripe, Notion, Superhuman)
Os apps líderes de 2026 — não só corporativos — packam **mais informação por tela mantendo legibilidade**, via hierarquia tipográfica e modular bento layouts. Cluttered ≠ dense; a diferença é hierarquia. **Aplicação Kinevo**: lista de alunos passa de ~6 alunos por viewport (atual) para ~8 alunos (target), via redução de padding (24→14), inter-card gap (16→10) e tipografia mais compacta — sem perder legibilidade.

### KPI cards com sparkline + delta (Apple Fitness, Whoop, Stripe)
Padrão validado em todos os apps premium de analytics: **headline number + sparkline mini + delta indicator**. Substituir "10/30 treinos" isolado por "10/30 + sparkline mostrando consistência da semana + +18% vs semana passada" transforma a percepção do produto de "dashboard" para "produto que pensa". Mock implementa em todos os 4 KPIs da Home.

### Avatares com gradiente individual (Discord, Linear, Slack)
Avatar pastel genérico envelheceu. Padrão atual: **gradient determinístico baseado no hash do nome**. Cada usuário tem identidade visual sem precisar de foto. Para o nicho treinador, onde nem todos os alunos colocam foto, isso resolve o problema visual de "lista de bolinhas pastel iguais". Mock mostra 6 gradientes distintos por aluno.

### Tipografia de headline com peso 800 e tracking negativo (Apple, Stripe, Vercel)
A linguagem 2026 abraça headlines com `font-weight: 800` e `letter-spacing: -0.04em`. "Boa tarde, Gustavo" passa de 28px/700/0 para 32px/800/-0.04em — diferença sutil mas a percepção de premium é imediata.

### Glass + gradient no hero card escuro (Apple Music, Linear, Vercel Dashboard)
O "card de perfil" da tela Mais virou um lugar para personalidade. Em vez de fundo branco genérico, **fundo escuro com gradiente sutil + glow + dados de negócio do treinador (alunos, MRR)** transforma o card em "identity statement". Mock implementa.

### Status como dot + texto (iOS Reminders, Linear, GitHub)
Pills coloridas com texto "Online" virando "🟢 Online" (texto + dot semântico) é mais escaneável e menos visualmente ruidoso. Pills só onde há contagem ou ação destacada.

### Microcopy útil ao lado de menus (Settings iOS 17+, Linear, Stripe)
"Notificações" virou "Notificações · 5 não lidas". "Assinatura" virou "Assinatura · próx. cobrança em 12 dias". Item de menu sem subtítulo virou exceção, não regra.

---

## 4. Kinevo Premium DS v2 — especificação

A especificação está renderizada interativamente na aba **Design System** do mock HTML. Síntese textual:

### 4.1 Cores

**Brand purple** (mantém identidade Kinevo)
```
purple-50  #F5F3FF · subtle bg
purple-100 #EDE9FE · pill bg, action icon bg
purple-400 #A78BFA · gradient mid
purple-500 #8B5CF6 · gradient fim, dark accent
purple-600 #7C3AED · PRIMARY · CTA, ativo, foco
purple-700 #6D28D9 · gradient início, hover
purple-900 #4C1D95 · texto sobre tinted
```

**Neutros Apple HIG** (alinha com web)
```
neutral-0    #FFFFFF · card primário
neutral-50   #FAFAFA · card secundário
neutral-100  #F4F4F5 · surface inset (segmented bg)
neutral-200  #E4E4E7 · borda padrão
neutral-300  #D4D4D8 · borda enfática
neutral-400  #A1A1AA · placeholder
neutral-500  #71717A · texto terciário (datas)
neutral-700  #3F3F46 · texto SECUNDÁRIO ★ (era #94a3b8)
neutral-900  #18181B · dark surface
neutral-950  #09090B · texto primário (não black)
```

**Canvas/Surface**: `#F4F5F8` (entre neutral-50 e neutral-100, dá contraste sutil para cards brancos).

**Semânticos**: success `#10B981`, warning `#F59E0B`, danger `#EF4444`, info `#3B82F6`. Cada um com par `-bg` (light 100) e `-fg` (escuro 700) para badges.

### 4.2 Tipografia · Plus Jakarta Sans

| Token | Tamanho | Peso | Tracking | Uso |
|---|---|---|---|---|
| `display` | 32 | 800 | -0.04em | "Boa tarde, Gustavo" |
| `title-1` | 24 | 700 | -0.03em | Header secundário |
| `title-2` | 20 | 700 | -0.02em | Section title |
| `title-3` | 17 | 600 | -0.01em | Card title |
| `body` | 15 | 500 | -0.005em | Texto padrão |
| `body-sm` | 13 | 500 | -0.005em | Sub-texto, captions ricos |
| `caption` | 12 | 500 | 0 | Datas, metas |
| `micro` | 11 | 700 | 0.1em UPPER | Section labels |

**Carregamento Expo**: `expo-font` com `useFonts({ 'PlusJakartaSans-Regular': ..., '-Medium', '-SemiBold', '-Bold', '-ExtraBold' })` e fallback do sistema enquanto carrega. Splash screen aguarda fontes prontas.

### 4.3 Spacing · escala 4pt

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64`

**Padrões aplicados**:
- Card padding: **16** (era 24)
- Inter-card gap: **10–12** (era 16)
- Section gap: **24**
- Screen horizontal padding: **20**
- Touch target mínimo: **44pt** (HIG)

### 4.4 Radius

| Token | Valor | Uso |
|---|---|---|
| `xs` | 4 | bullet badges micro |
| `sm` | 8 | chips, inputs, pills retangulares |
| `md` | **12** | **card padrão** (alinhado com web `rounded-xl`) |
| `lg` | 16 | hero cards (perfil, CTA) |
| `xl` | 20 | modais |
| `2xl` | 24 | containers especiais (raro) |
| `pill` | 999 | status dots, contadores |

### 4.5 Sombras

```
xs   0 1px 2px rgba(9,9,11,0.04)
sm   0 1px 3px rgba(9,9,11,0.06), 0 1px 2px rgba(9,9,11,0.04)
md   0 4px 12px rgba(9,9,11,0.06), 0 2px 4px rgba(9,9,11,0.04)
lg   0 12px 32px rgba(9,9,11,0.08), 0 4px 12px rgba(9,9,11,0.04)
glow-purple  0 8px 28px rgba(124,58,237,0.32), 0 2px 8px rgba(124,58,237,0.16)
glass        inset 0 1px 0 rgba(255,255,255,0.8), 0 8px 24px rgba(0,0,0,0.06)
```

**Em React Native**: usar `shadowColor + shadowOffset + shadowOpacity + shadowRadius + elevation` mapeados a partir desses tokens. Há uma função utilitária a criar em `mobile/theme/shadows.ts` que aceita `{ size: 'sm' | 'md' | ... }` e retorna o objeto correto cross-platform.

### 4.6 Motion

- Easing: `cubic-bezier(0.32, 0.72, 0, 1)` (Apple-style spring)
- Duração: `120ms` (micro), `240ms` (default), `320ms` (page)
- Tap feedback: `scale(0.97)` + haptic `light` (já existe em `PressableScale`, padronizar)
- Page transition: `slide_from_right` com spring config `{ stiffness: 300, damping: 30 }`
- Lista entrar: stagger 30ms entre itens nas primeiras 6 linhas

### 4.7 Iconografia

**Lucide React Native** mantido (já em uso, 0.563.0). Stroke width `2.1` no padrão (era 2.0), `2.2` em ícones pequenos (≤16pt) para preservar peso visual em densidade alta. Tamanhos canônicos: 14, 16, 18, 20, 22, 24.

### 4.8 Surfaces / hierarquia espacial

```
canvas        #F4F5F8     (background do app)
card          #FFFFFF     (cards primários)
card-2        #FAFAFA     (cards secundários, sub-itens)
tint-purple   rgba(124,58,237,0.04)  (regiões "premium" sutilmente tintas)
glass         rgba(255,255,255,0.78) + blur 24px + saturate 180%
```

A regra de profundidade: **canvas < card-2 < card < glass-floating**. Bottom nav flutua em glass; modais em glass-elevated.

---

## 5. Padrões de componente

Os componentes a refatorar primeiro (em ordem de impacto visual):

### 5.1 KPI Card (novo)
Substitui os cards "8 alunos / 10/30 treinos / R$0 MRR / 33% aderência" da Home. Estrutura:
- Top: ícone tinted (28pt, radius 8) + label uppercase 11/700/0.1em
- Middle: número 28pt/800/-0.04em + sub menor 14pt/600 (ex: "k", "/30", "%")
- Bottom: delta (✓+18%) + sparkline mini (SVG, ~70×22pt)
- Top border 2pt da cor accent (purple/success/warning/info) com 60% opacity

### 5.2 Student Row (refatorar)
- Avatar 42pt com gradient individual + status dot 12pt no canto inferior direito
- Nome 14.5pt/700 + tag-self ("EU") quando aplicável
- Programa em 13pt/600 com sub-texto "5/5" e mini progress bar 3pt
- Meta em 12.5pt/500 com formato "🟢 Treinou hoje · 5x semana"
- Trail: timestamp + chevron OU CTA contextual ("+ Programa", "CUTUCAR")

### 5.3 Bottom Nav Floating (novo)
- Position absolute, left/right 12, bottom 16
- Height 64, radius 22
- `BlurView intensity={80} tint="light"` + bg overlay `rgba(255,255,255,0.78)`
- Border 1px `rgba(9,9,11,0.06)` + shadow-glass
- Ativos: pill tinted background gradient roxo + ícone + label peso 700
- Badge: contador vermelho 16pt no canto superior direito do ícone
- Animação ativo: `withSpring` no scale e opacity do tinted bg

### 5.4 Action Item (refatorar Ações Pendentes)
- Card 14pt padding com border lateral 3pt da cor da urgência
- Action icon 36pt (radius 10) com cor temática
- Pill micro de tipo no nome ("Inativo", "Formulário", "Agendado")
- Description em 12.5pt/500 ellipsis 1 linha
- Chevron sutil no trail

### 5.5 Hero Profile Card (Mais)
- Background gradient `linear-gradient(135deg, #18181B, #27272A 50%, #3B0764 110%)`
- Glow roxo radial top-right (180×180pt blur)
- Avatar 60pt com ring branco 2pt + ring roxo 3pt (assinatura ativa)
- Nome 17pt/800/-0.025em + plan-badge gold (Pro)
- KPIs do treinador em linha (alunos, MRR) em 11.5pt/600
- Edit button glass top-right

### 5.6 Status Indicator (consolidar)
Substituir todos os badges status do app por **um único componente** `<KStatus type="pending|done|scheduled|inactive" size="sm|md" />`:
- Renderiza `dot + texto` ou `pill + texto + dot` conforme size
- Cores semânticas vinculadas aos tokens
- Substitui `SessionStatusBadge`, `ActionCard pills`, `StudentFilterChips status`

### 5.7 Avatar com gradiente determinístico
Função `getAvatarGradient(name: string)` que retorna um par de cores baseado em hash do nome. Pool de 6–8 gradientes pré-curados (roxo+rosa, azul+ciano, âmbar+vermelho, verde+teal, etc.). Usar quando não houver foto.

---

## 6. Telas: o que muda em cada uma

A análise tela por tela está renderizada visualmente no mock HTML, com painel de anotações lateral. Síntese:

### Home (a mais importante)
- Nova hierarquia: header denso → CTA Sala de Treino com glow → KPIs com sparkline → ações pendentes com border lateral colorida → quick access em 4 colunas (era 2).
- Saudação contextual ("8 alunos ativos") substitui só a data.
- CTA "Sala de Treino" tem presence ativa ("2 alunos online agora").

### Alunos (a mais usada)
- Search com `⌘K` hint
- 4 pills viraram segmented control com contadores
- Avatar com gradient individual + status dot
- Mini progress bar (3pt) no programa
- CTA contextual ("+ Programa" para sem-programa, "CUTUCAR" para inativos)
- Densidade +28%

### Mensagens
- Não-lidas com tratamento triplo: nome em extrabold + dot roxo glow + timestamp em roxo
- Preview com ícone de attachment (📷, 🎥)
- Segmented "Todas / Não lidas / Atenção" no topo
- Format de data compacto ("2 sem")

### Formulários (a mais cognitivamente pesada)
- 3 níveis de filtro → 2 níveis (tabs primárias + segmented)
- Tab "Avaliações" com badge sinaliza módulo futuro
- Ícone temático por tipo (anamnese roxo, check-in cyan, avaliação verde, prescrição âmbar)
- Pills de status sutis (bg pastel + dot)

### Mais
- Card hero escuro com gradient roxo + glow
- Plan badge gold (Pro)
- KPIs do treinador no hero (alunos, MRR)
- Microcopy útil em cada item de menu
- Build version no footer

### Bottom Nav
- Liquid Glass floating
- 5 tabs com label sempre visível
- Ativo: pill tinted gradient roxo
- Badge: contador vermelho 16pt
- iOS 26-ready (mapeia para tabBarStyle nativo no futuro)

---

## 7. Plano de implementação faseado

### Fase 0 · Fundação compartilhada (1–2 semanas)

1. **Criar `/shared/tokens/`** no monorepo com `colors.ts`, `typography.ts`, `spacing.ts`, `radius.ts`, `shadows.ts`, `motion.ts`. Single source of truth.
2. **Web migra para consumir `@kinevo/tokens`**: substitui `globals.css :root` por imports compilados. Validar visualmente.
3. **Mobile migra `mobile/theme/` para consumir `@kinevo/tokens`**: refatora `colors.ts` etc. para reexportar do shared.
4. **Carregar Plus Jakarta Sans no mobile**: `expo-font`, splash espera fontes, `Text` default usa a família.
5. **Config NativeWind** consumindo os tokens (aliases tailwind apontam para vars compartilhadas).

**Critério de saída**: web e mobile compartilham 100% dos tokens primários. Não pode haver `#94a3b8` ou `#cbd5e1` hardcoded em mobile.

### Fase 1 · Componentes premium (2–3 semanas)

Refatorar/criar, em ordem:

1. `KPICard` (substitui StatCards atuais, integra recharts/sparkline-svg)
2. `KStatus` componente único (substitui SessionStatusBadge, badges, action pills)
3. `Avatar` com gradient determinístico + status dot
4. `BottomNav` floating glass (substitui tab navigator atual via custom `tabBar`)
5. `KCard` shell padrão (radius 12, shadow sm, padding 16)
6. `KButton` com variantes (primary com gradient+glow, ghost, destructive)
7. `KSegmented` (substitui pills em Alunos/Mensagens/Forms)
8. `KSearchBox` com `⌘K` hint

**Critério de saída**: Storybook (RN) com 100% dos componentes V2 + visual regression tests via screenshots.

### Fase 2 · Aplicação às 5 telas (2–3 semanas)

Em paralelo, refatorar as 5 telas usando os novos componentes:

1. **Home** (1 semana) — KPI cards + Action items + CTA Sala de Treino + Quick access 4 cols
2. **Alunos** (3 dias) — Student row novo + Segmented + FAB refinado
3. **Mensagens** (3 dias) — Inbox layout + unread treatment
4. **Formulários** (3 dias) — Tabs + filtros consolidados + ícone por tipo
5. **Mais** (2 dias) — Hero card escuro + menu items com microcopy

**Critério de saída**: 5 telas refatoradas, screenshots conferidos contra mock HTML, dogfooding pelo Gustavo por 1 semana.

### Fase 3 · Polish (1–2 semanas)

- Skeleton loaders em todas as telas (substituir ActivityIndicator full-screen)
- Stagger animations de listas (30ms entre os primeiros 6 itens)
- Haptics consistentes em todas as ações (já existe em `PressableScale`, expandir)
- `accessibilityLabel` em 100% dos `Pressable`/`TouchableOpacity` interativos
- Tap target audit: nenhum interativo &lt; 44pt
- Dark mode (mapear token light → dark, testar todas as telas)

**Critério de saída**: TestFlight build com revisão completa de QA visual + acessibilidade WCAG AA.

### Fase 4 · iPad e Liquid Glass nativo (2–3 semanas, opcional para v2.0)

- Layouts responsivos para iPad (master-detail em Alunos, side-by-side em Sala de Treino)
- Migração da bottom nav para `UITabBarController` nativo iOS 26 com Liquid Glass quando disponível
- Apple Watch companion para Sala de Treino

---

## 8. Riscos e mitigação

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Plus Jakarta Sans pesa o bundle | Baixa | Fonte ~80KB minified. Carregar via `expo-font` async. |
| `BlurView` performance em Android | Média | iOS prioritário. Android usa fallback `rgba` sólido com border. Documentar. |
| Refatoração de tokens quebra web | Média | Migração gradual com flag de feature; PR grande dividido em N commits atômicos. |
| Dogfooding revela componentes ainda incompletos | Alta | Feature flag por tela. Rollback fácil para layout antigo. |
| Treinador percebe radius menor como "menos amigável" | Baixa | A/B test silencioso primeiro 2 semanas. Métrica: NPS pós-redesign. |
| Sparkline calcula errado para alunos sem histórico | Média | Estado vazio explícito ("Sem dados ainda" no lugar do spark) |

---

## 9. Métricas de sucesso

**Quantitativas**:
- TTI (Time to Interactive) primeira tela: ≤ 1.2s
- FPS scroll lista de alunos: ≥ 58fps em iPhone 12 base
- Crash-free sessions: ≥ 99.5% pós-rollout
- WCAG contrast: 100% AA, ≥ 70% AAA

**Qualitativas**:
- NPS pós-redesign: +15pp vs baseline
- Pesquisa "o app parece premium?" (1–5): ≥ 4.3 (baseline ~3.4 inferido)
- Compartilhamento de screenshot orgânico (sinal de orgulho do treinador)
- Tempo médio para encontrar aluno na lista: -30%

---

## 10. Próximos passos imediatos

Pré-arrancada (esta semana):

1. **Validar este plano com Gustavo** — concordar com o redesign proposto, ajustar prioridades.
2. **Setup do `/shared/tokens/`** — começar pelo arquivo `colors.ts` (mais impacto). 1 dia de trabalho.
3. **Refatorar `mobile/theme/colors.ts`** para consumir do shared. Validar que nada quebra. 0.5 dia.
4. **Implementar `KPICard` em Storybook RN** — primeiro componente do DS v2 a ganhar vida. 1 dia.
5. **Pilot em 1 tela**: Home recebe novos KPI cards, manter resto inalterado. Dogfood 3 dias.

Se o pilot for positivo, avança Fase 1 completa.

---

## Apêndices

### A. Apps de referência analisados
- **Apple Fitness+**: bottom nav floating glass, hero cards, anel de Apple Activity
- **Whoop**: KPI cards com sparkline, recovery score como gradient
- **Levels**: data dense + bento grid + tipografia 800
- **Linear**: densidade controlada, segmented controls, hierarquia tipográfica
- **Superhuman**: inbox layout, unread treatment, progressive disclosure
- **Stripe Mobile**: KPI cards, gradients sutis, ícones lucide
- **Arc Browser**: nav flutuante com identidade própria
- **AllTrails**: Liquid Glass adoção iOS 26, hero collapsing nav
- **Hevy Coach**: relevante por nicho (fitness builder mobile-first)

### B. Tokens prontos para `@kinevo/tokens`
Estrutura de arquivos sugerida em `/shared/tokens/`:
```
shared/tokens/
  ├── index.ts
  ├── colors.ts          (light + dark)
  ├── typography.ts      (Plus Jakarta Sans scale)
  ├── spacing.ts         (4pt grid)
  ├── radius.ts          (xs → 2xl + pill)
  ├── shadows.ts         (web CSS + RN cross-platform)
  ├── motion.ts          (easings, durations)
  └── platform/
      ├── tailwind.config.ts   (web consume)
      └── nativewind.config.ts (mobile consume)
```

### C. Glossário visual (rendered no mock)
Veja a aba **Design System** do mock HTML para visualizações de:
- Paleta completa
- Type scale com exemplos
- Spacing visual (barras crescendo)
- Radius comparativo (4 quadrados)
- Sombras (6 cards)
- 6 princípios fundamentais

---

**Fim do documento.** Para feedback, ajustes ou para começar a Fase 0, abrir thread de discussão.
