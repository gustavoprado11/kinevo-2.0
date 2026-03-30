# Relatório de UX, UI e Design — Kinevo

**Data:** Março 2026
**Escopo:** Análise baseada no código-fonte do Kinevo (web + mobile)
**Método:** Inspeção direta de componentes, estilos, rotas, fluxos e padrões de implementação

---

## 1. Design System

### 1.1 Paleta de Cores

O Kinevo usa um sistema de tokens semânticos com suporte completo a dark mode. A paleta é inspirada no Apple Human Interface Guidelines, com violeta como cor de destaque.

**Light Mode:**

| Token | Valor | Uso |
|-------|-------|-----|
| Primary | `#007AFF` | Links, indicador ativo na sidebar |
| Background | `#F5F5F7` | Canvas geral |
| Card | `#FFFFFF` | Superfície de cards |
| Text Primary | `#1D1D1F` | Títulos e corpo |
| Text Secondary | `#6E6E73` | Labels, subtítulos |
| Text Tertiary | `#86868B` | Placeholders |
| Border | `#D2D2D7` | Bordas de cards |
| Destructive | `#FF3B30` | Erros, alertas |

**Dark Mode:**

| Token | Valor | Uso |
|-------|-------|-----|
| Primary/Accent | `#8b5cf6` (Violet-500) | CTAs, indicador ativo |
| Background | `#09090B` | Canvas geral |
| Card | `#1C1C1E` | Superfície de cards |
| Text Primary | `#FFFFFF` | Títulos e corpo |
| Text Secondary | `rgba(255,255,255,0.6)` | Labels |
| Text Tertiary | `rgba(255,255,255,0.4)` | Placeholders |
| Text Quaternary | `rgba(255,255,255,0.2)` | Hints |

**Cores de status** (consistentes entre light/dark):

| Cor | Hex | Uso |
|-----|-----|-----|
| Emerald | `#16a34a` | Sucesso, treinos concluídos |
| Amber | `#f59e0b` | Alerta, pendente |
| Red | `#FF3B30` | Erro, atenção urgente |
| Violet | `#7C3AED → #A855F7` | Gradiente principal de CTAs |

**Fonte:** `web/src/app/globals.css` (variáveis CSS em `:root` e `.dark`), `tailwind.config.ts`

### 1.2 Tipografia

| Fonte | Uso | Referência |
|-------|-----|------------|
| Plus Jakarta Sans | Headlines, títulos | `--font-jakarta` em `layout.tsx` |
| Inter | Corpo, UI geral | `--font-inter` em `layout.tsx` |
| system-ui | Fallback | Stack nativo |

**Hierarquia de tamanhos** (escala Tailwind):

| Classe | Tamanho | Uso típico |
|--------|---------|------------|
| `text-xs` | 12px | Labels, badges, timestamps |
| `text-sm` | 14px | Corpo de card, itens de lista |
| `text-base` | 16px | Corpo padrão |
| `text-lg` | 18px | Subtítulos de seção |
| `text-xl` | 20px | Títulos de página |
| `text-3xl` | 30px | Valores de stat cards |
| `text-5xl+` | 48px+ | Hero da landing page |

**Pesos utilizados:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold)

**Fonte:** `web/src/app/layout.tsx`, `globals.css`, uso recorrente nos componentes

### 1.3 Sombras

O sistema de sombras segue o padrão Apple — suaves e multicamadas:

| Token | Valor | Uso |
|-------|-------|-----|
| `shadow-apple-card` | `0 1px 3px rgba(0,0,0,0.08)` | Cards em repouso |
| `shadow-apple-hover` | `0 2px 8px rgba(0,0,0,0.12)` | Hover em cards |
| `shadow-apple-elevated` | `0 4px 16px rgba(0,0,0,0.08)` | Modais, dropdowns |

No dark mode, sombras são desativadas (`shadow-none`) e substituídas por bordas sutis.

**Fonte:** `globals.css` (custom properties de sombra)

### 1.4 Border Radius

| Classe | Tamanho | Uso |
|--------|---------|-----|
| `rounded-lg` | 8px | Botões, inputs |
| `rounded-xl` | 12px | Cards médios |
| `rounded-2xl` | 16px | Cards grandes, containers |
| `rounded-full` | 50% | Avatares, badges |

**Fonte:** Uso recorrente em todos os componentes

### 1.5 Z-Index

O sistema possui 11 camadas definidas semanticamente:

```
content (0) → raised (1) → sticky (10) → header (20) → sidebar (30) →
dropdown (40) → backdrop (45) → modal (50) → float (60) → onboarding (70) →
tooltip (100) → topmost (110)
```

**Fonte:** `globals.css` (variáveis `--z-index-*`)

---

## 2. Componentes UI

### 2.1 Primitivos

O Kinevo possui uma biblioteca de componentes base em `web/src/components/ui/`:

| Componente | Variantes | Detalhes |
|------------|-----------|----------|
| **Button** | `default`, `outline`, `ghost`, `destructive`, `link` | Tamanhos: `sm`, `default`, `lg`, `icon`. Focus ring com 2px, active scale 0.98 |
| **InfoTooltip** | — | Portal-based, posicionamento dinâmico, clamped ao viewport |
| **Skeleton** | — | `animate-pulse`, cores `bg-black/5` (light) / `bg-white/5` (dark) |

**Observação:** A biblioteca de primitivos é enxuta. Componentes como inputs, selects, modais e tabs são implementados inline nos componentes de feature, sem abstração compartilhada.

**Fonte:** `web/src/components/ui/button.tsx`, `info-tooltip.tsx`, `skeleton.tsx`

### 2.2 Padrões de Componentes Recorrentes

**Stat Card** (usado no dashboard e em student detail):
```
┌─────────────────────────────┐
│ Label (text-sm, secondary)  Icon │
│ Valor (text-3xl, bold)          │
│ Sparkline ou sub-info           │
└─────────────────────────────┘
```
Implementação: `rounded-xl`, `border`, `shadow-apple-card`, `p-4`

**Card de Ação** (usado em formulários, prescrição):
```
┌─────────────────────────────┐
│ ● Ícone   Título (bold)        │
│           Descrição (tertiary)  │
│           [CTA Button]          │
└─────────────────────────────┘
```

**Fonte:** `web/src/components/dashboard/stat-cards.tsx`, componentes de prescrição

---

## 3. Layout e Navegação

### 3.1 App Shell (Web)

Estrutura: **Sidebar fixa + Header sticky + Conteúdo principal**

| Elemento | Especificação |
|----------|---------------|
| Sidebar | Fixa, `w-64` (expandida) / `w-[68px]` (colapsada), transição 300ms |
| Header | `h-16`, sticky, `backdrop-blur-sm`, borda inferior |
| Conteúdo | `p-8`, ajusta `padding-left` conforme sidebar |

**Itens de navegação:** Dashboard, Alunos, Exercícios, Programas, Avaliações, Financeiro, Configurações

**Indicador ativo:** Barra lateral esquerda (`w-[3px]`, `rounded-r-full`, cor `#007AFF` ou `violet-500`)

**Tooltip no modo colapsado:** Aparece ao hover com `z-modal`

**Fonte:** `web/src/components/layout/app-layout.tsx`, `sidebar.tsx`, `header.tsx`

### 3.2 Navegação Mobile

Estrutura: **Tab bar inferior** (padrão iOS/Android)

| Tab (Aluno) | Tab (Treinador) |
|-------------|-----------------|
| Home | Dashboard |
| Treinos | Alunos |
| Perfil | Exercícios |
| — | Financeiro |
| — | Perfil |

**Fonte:** `mobile/app/(tabs)/`, `mobile/app/(trainer-tabs)/`

---

## 4. Telas e Fluxos Principais

### 4.1 Landing Page

Estrutura em seções verticais com scroll:

1. **Hero** — Título grande, subtítulo, 2 CTAs (gradiente + ghost), imagem/mockup
2. **Features** — Grid de cards com ícones
3. **Pricing** — Cards de planos
4. **CTA final** — Call to action de fechamento

Animações: Framer Motion com `staggered entry` (opacity 0→1, y 20→0, delay 0.1-0.8s), hover scale 1.05, tap scale 0.98.

Background: Mesh gradient com radial-gradient em violeta (opacidade 5-15%).

**Fonte:** `web/src/app/page.tsx`, componentes em `web/src/components/landing/`

### 4.2 Dashboard

O dashboard do treinador apresenta:

| Seção | Conteúdo |
|-------|----------|
| **Stat Cards** | 3-4 cards (alunos ativos, sessões da semana, aderência média, MRR). Grid responsivo: `grid-cols-1 sm:grid-cols-3` ou `grid-cols-2 md:grid-cols-4` |
| **Ações Pendentes** | Alertas de alunos que precisam de atenção (aderência baixa, programa vencido, formulário pendente) |
| **Atividade Diária** | Feed cronológico de eventos (sessões concluídas, formulários respondidos) |
| **Heatmap de Aderência** | Grid semanal com cores (verde/amarelo/vermelho) |

**Fonte:** `web/src/app/dashboard/page.tsx`, `web/src/components/dashboard/`

### 4.3 Lista de Alunos

Interface com filtros múltiplos e busca:

- **Busca:** Input de texto no topo
- **Filtros:** Nível de atenção (urgente, alerta, ok), modalidade, status do programa
- **Cards de aluno:** Avatar, nome, último treino (timestamp relativo), badge de atenção
- **Estados de atenção:** Vermelho (urgente — sem treino há 7+ dias), amarelo (alerta — aderência baixa), verde (ok)

**Fonte:** `web/src/app/students/page.tsx`, `web/src/components/students/`

### 4.4 Detalhe do Aluno

Layout com **sidebar persistente** (financeiro + avaliações) + conteúdo principal:

| Seção | Conteúdo |
|-------|----------|
| **Header** | Avatar, nome, tags (nível, objetivo), botão "Prescrever com IA" |
| **Programa Ativo** | Nome do programa, progresso, lista de treinos |
| **Histórico de Sessões** | Timeline de sessões com status, duração, exercícios concluídos |
| **Tonelagem** | Tracking de volume total (kg) por semana |
| **Notas do Treinador** | Campo de texto livre para observações |
| **Sidebar Financeiro** | Contrato ativo, status de pagamento |
| **Sidebar Avaliações** | Formulários respondidos, scores |

**Fonte:** `web/src/app/students/[id]/page.tsx`, componentes em `web/src/components/students/`

### 4.5 Fluxo de Prescrição com IA

Stepper de 3 passos: **Configurar → Refinar → Programa**

| Passo | Conteúdo |
|-------|----------|
| **1. Configurar** | Seleção de formulários, configuração rápida (dias, equipamento, duração), instruções adicionais |
| **2. Refinar** | Perguntas condicionais do motor de IA (0-3 perguntas), opção "Pular perguntas" |
| **3. Programa** | Status de geração animado → redirect para edição do programa |

**Modo compacto:** Quando formulários estão selecionados, o form mostra apenas campos essenciais (dias, equipamento, duração) com opção de expandir.

**Fonte:** `web/src/app/students/[id]/prescribe/prescribe-client.tsx`, componentes em `web/src/components/prescription/`

### 4.6 Sala de Treino (Training Room)

Interface de gerenciamento de sessões ao vivo com múltiplos alunos:

| Elemento | Detalhe |
|----------|---------|
| **Multi-aluno** | Lista lateral com alunos em sessão ativa |
| **Exercício atual** | Card com nome, séries, reps, carga, vídeo demonstrativo |
| **Timer de descanso** | Overlay com countdown, feedback de vibração |
| **Swap de exercício** | Modal para substituir exercício durante a sessão |
| **Formulários pré/pós** | Quick forms antes/depois do treino |

**Estado:** Gerenciado via Zustand (`useTrainingRoomStore`)

**Fonte:** `web/src/app/training-room/`, `web/src/components/training-room/`

### 4.7 Financeiro

Dashboard financeiro com:

- **MRR** (Monthly Recurring Revenue) com toggle de privacidade (ocultar valor)
- **Contratos por status** (ativo, vencido, cancelado)
- **Transações recentes**
- **Integração Stripe Connect**

**Fonte:** `web/src/app/financial/page.tsx`

### 4.8 Mobile — Tela do Aluno

| Tela | Conteúdo |
|------|----------|
| **Home** | Calendário semanal/mensal, próximo treino, aderência |
| **Workout Player** | Execução de treino com timer, log de séries, feedback háptico |
| **Perfil** | Dados pessoais, notificações, configurações |

**Animações mobile:** React Native Reanimated com spring physics (damping: 15, stiffness: 200), haptic feedback (`Haptics.impactAsync`), Apple Watch sync, Live Activity.

**Fonte:** `mobile/app/(tabs)/home.tsx`, `mobile/app/workout/[id].tsx`

---

## 5. Dark Mode

A implementação de dark mode é completa e estruturada:

| Aspecto | Implementação |
|---------|---------------|
| **Provider** | `next-themes` com storage key `kinevo-theme` |
| **Default** | Light mode |
| **Detecção de sistema** | Habilitada |
| **CSS** | Variáveis em `:root` (light) e `.dark` (dark) |
| **Tailwind** | Prefixo `dark:` para overrides pontuais |

**Rotas com tema forçado:**
- Light forçado: `/`, `/login`, `/signup`, `/auth/*`
- Dark forçado: `/terms`, `/privacy`, `/subscription`
- Área logada: Respeita preferência do usuário

**Estratégia de cores no dark:** Usa `rgba(255,255,255,X)` para opacidades de texto e `glass-bg` com `backdrop-blur` para superfícies semi-transparentes.

**Fonte:** `web/src/components/theme-provider.tsx`, `globals.css`

---

## 6. Animações e Microinterações

### Web

| Animação | Implementação | Uso |
|----------|---------------|-----|
| Staggered entry | Framer Motion: `opacity 0→1, y 20→0, delay 0.1-0.8s` | Landing page |
| Hover scale | `whileHover={{ scale: 1.05 }}` | Cards, botões |
| Tap scale | `whileTap={{ scale: 0.98 }}` | Botões |
| Shimmer | CSS `linear-gradient` animado 3s infinite | Botão CTA premium |
| Float | CSS `translateY(-12px)` 6s ease-in-out infinite | Elementos decorativos |
| Gradient rotate | CSS `gradient-angle 0→360deg` 4s linear infinite | Bordas de destaque |
| Shake | CSS `translateX ±6px` | Validação de formulário |
| Pulse soft | CSS `opacity 1→0.5` 2s ease-in-out | Indicadores de loading |
| Breathing button | Scale `1→1.04` com repeat, 1500ms | CTA principal mobile |

### Mobile

| Animação | Implementação |
|----------|---------------|
| Spring press | `withSpring(0.95, { damping: 15, stiffness: 200 })` |
| Haptic feedback | `Haptics.impactAsync(ImpactFeedbackStyle.Light)` |
| Breathing CTA | `withRepeat(withTiming(1.04, 1500ms), -1, true)` |

**Fonte:** `globals.css` (keyframes), componentes landing (`framer-motion`), `mobile/` (Reanimated)

---

## 7. Responsividade

### Breakpoints utilizados

| Breakpoint | Largura | Uso principal |
|------------|---------|---------------|
| `sm` | 640px | Grid de stats, stack de cards |
| `md` | 768px | Sidebar colapsa, grid 2→4 cols |
| `lg` | 1024px | Layout completo desktop |
| `xl` | 1280px | Larguras máximas de conteúdo |

### Padrões responsivos

- **Dashboard stats:** `grid-cols-1 sm:grid-cols-3` ou `grid-cols-2 md:grid-cols-4`
- **Landing page:** `flex-col lg:flex-row` para hero e feature sections
- **Sidebar:** Colapsável em todas as telas, auto-collapse em certas rotas
- **Formulários:** Full-width em mobile, max-width em desktop

**Fonte:** Uso recorrente de classes responsivas Tailwind nos componentes

---

## 8. Acessibilidade

### O que está implementado

| Recurso | Status | Referência |
|---------|--------|------------|
| `aria-label` em toggles de navegação | ✅ Presente | `sidebar.tsx` |
| `role="switch"` em toggles | ✅ Presente | Componentes de settings |
| `aria-checked` para estado | ✅ Presente | Toggle components |
| `role="combobox"` + `aria-expanded` | ✅ Presente | Dropdowns de busca |
| `role="listbox"` + `role="option"` | ✅ Presente | Listas de seleção |
| `aria-activedescendant` | ✅ Presente | Combobox |
| Focus visible (ring 2px) | ✅ Presente | `button.tsx`, inputs |
| `tabIndex={0}` em interativos | ✅ Presente | Cards clicáveis |
| Navegação por teclado | ⚠️ Parcial | Arrow keys em combobox, não em todas as listas |
| `aria-label` em icon buttons | ⚠️ Parcial | Presente em alguns, ausente em outros |
| Screen reader descriptions | ⚠️ Parcial | `aria-hidden` em decorativos, mas não universal |
| Skip navigation link | ❌ Ausente | Não implementado |
| Contrast ratio compliance | ⚠️ Não verificado | Cores parecem adequadas mas sem auditoria formal |

**Fonte:** Inspeção de componentes UI, layout e formulários

---

## 9. Onboarding

O sistema de onboarding utiliza dois mecanismos:

### Welcome Modal
Modal de boas-vindas no primeiro acesso do treinador com introdução às funcionalidades principais.

### Tour System
Tours guiados por feature usando `TourRunner` com steps definidos em `tour-definitions.ts`:

- Tour de prescrição (auto-start na primeira visita à tela de prescrever)
- Potencial para mais tours (estrutura genérica)

**Estado:** Gerenciado via Zustand (`useOnboardingStore`), persiste progresso do usuário.

**Fonte:** `web/src/components/onboarding/tours/tour-runner.tsx`, `tour-definitions.ts`, `welcome-modal.tsx`

---

## 10. Pontos Fortes

1. **Design system consistente** — Tokens semânticos de cor, tipografia e espaçamento aplicados uniformemente em 13+ telas. Dark mode não é um patch — é parte integral do sistema de variáveis.

2. **Timestamps relativos** — "Hoje", "Ontem", "há 3 dias" reduzem carga cognitiva vs. datas absolutas. Presente em student list, dashboard, sessões.

3. **Indicadores de atenção** — Sistema de cores (vermelho/amarelo/verde) para priorização rápida de alunos que precisam de ação. O treinador bate o olho e sabe onde agir.

4. **Dual CTA** — Botão primário (gradiente) + link secundário em toda ação principal. Reduz paralisia de decisão.

5. **Sidebar persistente no detalhe do aluno** — Informações financeiras e de avaliação sempre visíveis sem clicar. Contexto disponível sem navegação.

6. **Stepper de prescrição** — 3 passos claros com checkmark de conclusão e animação ring-pulse. Fluxo linear que reduz ansiedade.

7. **Sala de treino multi-aluno** — Feature diferenciadora com gerenciamento simultâneo de múltiplos alunos em sessão. Zustand para estado complexo.

8. **Mobile nativo** — Haptic feedback, Apple Watch sync, Live Activity. Não é um web wrapper — é experiência nativa de verdade.

9. **Glass morphism no dark mode** — Backgrounds semi-transparentes com `backdrop-blur` criam profundidade sem peso visual.

10. **Animações com personalidade** — Spring physics (stiffness 400, damping 17), breathing buttons, shimmer em CTAs. Microinterações que dão vida à interface.

---

## 11. Oportunidades de Melhoria

### 11.1 Empty States

**Problema:** Não foram identificados designs de empty state para listas vazias (alunos, exercícios, programas, formulários).

**Impacto:** Na primeira vez que o treinador acessa, vê telas vazias sem orientação. Isso é crítico para retenção — o momento mais frágil é o primeiro uso.

**Sugestão:** Criar componentes de empty state com ilustração, mensagem explicativa e CTA para a primeira ação (ex: "Adicione seu primeiro aluno").

### 11.2 Feedback e Recuperação de Erro

**Problema:** Erros são exibidos como banners vermelhos inline. Não há sistema de toast/snackbar para confirmações de sucesso, nem botões de retry para falhas de rede.

**Impacto:** O treinador salva um perfil e não tem feedback visual claro de sucesso. Em erro de rede, precisa recarregar a página.

**Sugestão:** Implementar sistema de toast (ex: sonner ou react-hot-toast) para feedback de ações. Adicionar retry automático ou manual em falhas de rede.

### 11.3 Loading States

**Problema:** Skeleton loaders existem como primitivo (`skeleton.tsx`) mas seu uso nos componentes de feature não é generalizado.

**Impacto:** Em conexões lentas ou carregamento de dados pesados, o usuário pode ver layouts quebrados ou flash de conteúdo.

**Sugestão:** Garantir que toda transição de dados tenha skeleton ou spinner contextualizado.

### 11.4 Paginação

**Problema:** Não foi identificada paginação ou infinite scroll nas listas principais (alunos, exercícios, programas).

**Impacto:** Com 50+ alunos, a performance degrada e a usabilidade cai. O treinador precisa scrollar extensivamente.

**Sugestão:** Implementar paginação server-side ou infinite scroll com intersection observer.

### 11.5 Confirmações em Ações Destrutivas

**Problema:** Diálogos de confirmação existem apenas para exclusão. Outras ações destrutivas (substituir programa ativo, cancelar contrato) não têm confirmação visível.

**Impacto:** Risco de ações acidentais irreversíveis.

**Sugestão:** Modal de confirmação para qualquer ação irreversível. Pattern: "Tem certeza? Esta ação não pode ser desfeita."

### 11.6 Acessibilidade

**Problema:** Base sólida (aria-labels em combobox, roles corretos), mas gaps em icon buttons sem aria-label, ausência de skip navigation, navegação por teclado incompleta em listas.

**Impacto:** Usuários com necessidades de acessibilidade podem ter dificuldade em certas áreas.

**Sugestão:** Auditoria com Lighthouse/axe-core, adicionar aria-labels em todos os botões de ícone, implementar skip navigation link.

### 11.7 Offline Support (Mobile)

**Problema:** Não foi identificado suporte offline no código do app mobile.

**Impacto:** Em academias com sinal fraco, o aluno pode perder dados de treino ou não conseguir carregar o programa.

**Sugestão:** Cache local dos dados do treino ativo + sync quando reconectar. Service worker ou AsyncStorage.

### 11.8 Biblioteca de Componentes

**Problema:** Apenas 3 primitivos UI compartilhados (Button, InfoTooltip, Skeleton). Inputs, selects, modais, tabs, badges são implementados inline em cada feature.

**Impacto:** Inconsistência sutil entre implementações (ex: padding de input diferente em duas telas), dificuldade de manutenção.

**Sugestão:** Extrair componentes recorrentes para `ui/` (Input, Select, Modal, Badge, Tab, Toast). Considerar Storybook para documentação visual.

---

## 12. Arquitetura Técnica de UI

| Aspecto | Web | Mobile |
|---------|-----|--------|
| **Framework** | Next.js 16 | React Native + Expo SDK 54 |
| **Estilização** | Tailwind CSS v4 | NativeWind (Tailwind para RN) |
| **Componentes** | Server Components + Client Components | Expo Router + Screens |
| **Estado** | Server Actions + Zustand (onboarding, training room) | Zustand + custom hooks |
| **Animações** | Framer Motion + CSS keyframes | React Native Reanimated |
| **Dados** | Supabase (Postgres + Auth + Realtime) | Supabase client |
| **Temas** | next-themes (CSS variables) | System + NativeWind |
| **Fonte** | Plus Jakarta Sans + Inter | Plus Jakarta Sans |

**Fonte:** `package.json`, `tailwind.config.ts`, `layout.tsx`, `mobile/package.json`

---

## 13. Resumo Executivo

O Kinevo apresenta maturidade de UX/UI **intermediária a avançada** para um SaaS de personal training em fase de crescimento. O design system é coeso, o dark mode é integral (não um patch), e a experiência mobile é genuinamente nativa.

**Os principais diferenciais de UX são:** o sistema de atenção por cores para priorização de alunos, a sala de treino multi-aluno, o fluxo de prescrição com IA em 3 passos, e as microinterações com personalidade (spring physics, haptics, breathing buttons).

**As maiores oportunidades estão em:** empty states para onboarding, sistema de feedback (toasts), paginação de listas, e consolidação da biblioteca de componentes compartilhados. Essas melhorias impactariam diretamente a retenção de novos treinadores e a escalabilidade da interface.
