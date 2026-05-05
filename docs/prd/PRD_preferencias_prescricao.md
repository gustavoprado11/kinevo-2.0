# PRD — Preferências de prescrição (treinador)

Status: pronto para implementação
Owner: Gustavo
Última atualização: 2026-05-05

## 1. Contexto e objetivo

Hoje, sempre que um treinador entra na tela de prescrição (`program-builder-client.tsx`) ele começa do zero: configura visualização, valores padrão de séries/reps/descanso, bloco de aquecimento, etc. Isso é repetitivo e gera fricção.

Esta feature dá ao treinador uma forma de configurar **preferências persistentes de prescrição**, acessíveis a um clique na própria tela, que ditam como a tela se apresenta e quais valores entram por padrão em novos programas, treinos e exercícios.

### Objetivos

- Reduzir cliques repetitivos na criação de novos programas/treinos.
- Personalizar a tela de prescrição ao estilo de cada treinador (campos visíveis, view padrão).
- Onboarding leve para o treinador configurar o essencial em menos de 1 minuto.

### Não-objetivos (fora do escopo desta versão)

- Múltiplos perfis nomeados de prescrição (ex: "Hipertrofia iniciante", "Força avançado").
- Override de preferências por aluno.
- Aplicação retroativa em programas/treinos já criados.
- Sincronização com mobile/app do aluno (preferências são exclusivas da experiência do treinador na web).

## 2. Decisões de design (consolidação)

| Tópico | Decisão |
|---|---|
| Localização do gatilho | Engrenagem na barra superior da prescrição, logo após o cluster de toggles de view, separada por um divisor sutil |
| Container | Drawer estreito (380px) abrindo pela direita |
| Subtítulo do drawer | "Aplicam apenas em novos treinos" — manter |
| Persistência | Salva em background a cada alteração; toast discreto "Preferências salvas" |
| Onboarding | Wizard de 4 passos no primeiro acesso, com botão "Pular" sempre visível |
| Banner | Faixa fina no topo da tela quando o wizard foi pulado, com link pro wizard |
| Override por aluno | Não — global por treinador |
| Perfis nomeados | Não — um único conjunto de preferências |
| Retroatividade | Não — só vale para futuros programas/treinos/exercícios |
| Acesso à engrenagem antes do wizard | Abre drawer direto (não força wizard) |
| Refazer onboarding | Link no rodapé do drawer reabre o wizard |
| Restaurar padrões da Kinevo | Botão no rodapé do drawer com confirmação |
| Telas pequenas | Drawer mantém 380px de largura (não expande para fullscreen) |

## 3. Modelo de dados

### 3.1. Migração SQL

Criar nova migração em `supabase/migrations/` (próximo número disponível) seguindo o padrão da migração `039_trainer_onboarding_state.sql` (coluna JSONB com DEFAULT, índice GIN, aditivo, sem afetar dados existentes).

```sql
-- Migration NNN: Add prescription preferences to trainers
-- Aditivo: nova coluna JSONB com DEFAULT contendo os padrões da Kinevo.
-- Treinadores existentes recebem o default e veem o banner do wizard.

ALTER TABLE trainers
ADD COLUMN IF NOT EXISTS prescription_preferences JSONB DEFAULT '{
  "wizard_completed": false,
  "wizard_dismissed": false,
  "visualization": {
    "default_view": "preview",
    "library_open_on_enter": true
  },
  "set_defaults": {
    "sets": "3-4",
    "reps": "8-12",
    "rest_compound_seconds": 90,
    "rest_isolation_seconds": 60,
    "tempo": null,
    "load_method": "kg",
    "visible_fields": ["sets", "reps", "load", "rest"]
  },
  "add_exercise": {
    "open_mode": "simplified",
    "auto_warmup": false
  },
  "quick_blocks": {
    "warmup_template": null,
    "aerobic_template": null,
    "note_template": null
  },
  "program_structure": {
    "default_weeks": 4,
    "default_workout_count": 3,
    "naming_convention": "letter"
  },
  "ai": {
    "focus": "hypertrophy",
    "variation": "moderate"
  }
}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_trainers_prescription_preferences
ON trainers USING gin (prescription_preferences);
```

### 3.2. Tipos TypeScript

Adicionar em `web/src/types/prescription-preferences.ts` (criar arquivo):

```ts
export type DefaultView = 'preview' | 'compare' | 'normal' | 'ai_prescribe'
//   preview     = mock do celular
//   compare     = comparador
//   normal      = checklist (tela padrão de edição)
//   ai_prescribe = texto para treino

export type LoadMethod = 'kg' | 'percent_1rm' | 'rir' | 'rpe'
export type VisibleField = 'sets' | 'reps' | 'load' | 'rest' | 'tempo' | 'rir' | 'rpe'
export type AddExerciseMode = 'simplified' | 'set_editor'
export type NamingConvention = 'letter' | 'free'
export type AiFocus = 'hypertrophy' | 'strength' | 'conditioning' | 'mixed'
export type AiVariation = 'conservative' | 'moderate' | 'varied'

export interface PrescriptionPreferences {
    wizard_completed: boolean
    wizard_dismissed: boolean
    visualization: {
        default_view: DefaultView
        library_open_on_enter: boolean
    }
    set_defaults: {
        sets: string                         // ex: "3" ou "3-4"
        reps: string                         // ex: "10" ou "8-12"
        rest_compound_seconds: number
        rest_isolation_seconds: number
        tempo: string | null                 // ex: "2-0-2" ou null
        load_method: LoadMethod
        visible_fields: VisibleField[]
    }
    add_exercise: {
        open_mode: AddExerciseMode
        auto_warmup: boolean
    }
    quick_blocks: {
        warmup_template: string | null
        aerobic_template: string | null
        note_template: string | null
    }
    program_structure: {
        default_weeks: number
        default_workout_count: number
        naming_convention: NamingConvention
    }
    ai: {
        focus: AiFocus
        variation: AiVariation
    }
}

export const KINEVO_DEFAULT_PREFERENCES: PrescriptionPreferences = {
    wizard_completed: false,
    wizard_dismissed: false,
    visualization: {
        default_view: 'preview',
        library_open_on_enter: true,
    },
    set_defaults: {
        sets: '3-4',
        reps: '8-12',
        rest_compound_seconds: 90,
        rest_isolation_seconds: 60,
        tempo: null,
        load_method: 'kg',
        visible_fields: ['sets', 'reps', 'load', 'rest'],
    },
    add_exercise: {
        open_mode: 'simplified',
        auto_warmup: false,
    },
    quick_blocks: {
        warmup_template: null,
        aerobic_template: null,
        note_template: null,
    },
    program_structure: {
        default_weeks: 4,
        default_workout_count: 3,
        naming_convention: 'letter',
    },
    ai: {
        focus: 'hypertrophy',
        variation: 'moderate',
    },
}
```

## 4. Server actions

Criar em `web/src/actions/trainer/`:

### 4.1. `update-prescription-preferences.ts`

Atualiza um patch parcial das preferências (deep-merge no servidor com o objeto existente, depois persiste). Segue o padrão de `update-auto-publish-reports.ts`: 'use server', autenticação por `supabase.auth.getUser()`, retorno `{ success, message? }`, `revalidatePath` no final.

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PrescriptionPreferences } from '@/types/prescription-preferences'
import { KINEVO_DEFAULT_PREFERENCES } from '@/types/prescription-preferences'

export type UpdatePreferencesResult =
    | { success: true; preferences: PrescriptionPreferences }
    | { success: false; message: string }

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export async function updatePrescriptionPreferences(
    patch: DeepPartial<PrescriptionPreferences>,
): Promise<UpdatePreferencesResult> {
    // 1. auth
    // 2. SELECT prescription_preferences FROM trainers WHERE auth_user_id = user.id
    // 3. deep-merge current with patch (com fallback para KINEVO_DEFAULT_PREFERENCES se null)
    // 4. UPDATE trainers SET prescription_preferences = merged WHERE auth_user_id = user.id
    // 5. revalidatePath('/programs') + return merged
}
```

### 4.2. `reset-prescription-preferences.ts`

Reseta completamente para `KINEVO_DEFAULT_PREFERENCES` (mantendo `wizard_completed` e `wizard_dismissed` no estado atual — restaurar padrões não força refazer onboarding).

### 4.3. `mark-wizard-completed.ts`

Marca `prescription_preferences.wizard_completed = true` (ou `wizard_dismissed = true` quando o usuário clica "Pular"). Usado pelo wizard.

## 5. State management (Zustand)

Criar `web/src/stores/prescription-preferences-store.ts`:

```ts
interface PrescriptionPreferencesStore {
    preferences: PrescriptionPreferences
    isDrawerOpen: boolean
    isWizardOpen: boolean
    setPreferences: (p: PrescriptionPreferences) => void
    updatePatch: (patch: DeepPartial<PrescriptionPreferences>) => void  // optimistic
    rollback: (previous: PrescriptionPreferences) => void
    openDrawer: () => void
    closeDrawer: () => void
    openWizard: () => void
    closeWizard: () => void
}
```

A store é hidratada server-side em `program-builder-client.tsx` com as preferências do trainer (via prop) e mantém sincronia client-side.

## 6. Componentes UI

Todos os componentes ficam em `web/src/components/programs/preferences/` (criar a pasta).

### 6.1. Botão da engrenagem

**Onde:** dentro de `program-builder-client.tsx`, no cluster de toggles de view (logo após o `<button>` do `FileText` em ~linha 1727).

**Antes (estado atual):**

```tsx
<button onClick={...}><FileText className="w-4 h-4" /></button>
</div>  {/* fim do cluster de toggles */}
```

**Depois:**

```tsx
<button onClick={...}><FileText className="w-4 h-4" /></button>

{/* Divisor sutil */}
<span className="mx-1 h-5 w-px bg-k-border-subtle" aria-hidden />

{/* Engrenagem — Preferências */}
<button
    onClick={() => preferencesStore.openDrawer()}
    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#AEAEB2] dark:text-k-text-quaternary hover:bg-[#F5F5F7]/60 dark:hover:bg-glass-bg/50 hover:text-[#1D1D1F] dark:hover:text-k-text-primary transition-colors duration-150"
    title="Preferências de prescrição"
    aria-label="Abrir preferências de prescrição"
>
    <Settings className="w-4 h-4" />
</button>
</div>  {/* fim do cluster de toggles */}
```

Importar `Settings` de `lucide-react`. Reutilizar a classe de divisor já existente (linha 1674 usa `mx-1 h-5 w-px bg-k-border-subtle` — usar a mesma).

### 6.2. PreferencesDrawer

Arquivo: `web/src/components/programs/preferences/preferences-drawer.tsx`.

Comportamento:
- Largura fixa 380px (em qualquer breakpoint).
- Slide-in pela direita usando `framer-motion` (seguir padrão de animações já presente em `program-builder-client.tsx`).
- Fundo com overlay semi-transparente que fecha o drawer ao clicar fora.
- Foco vai para o primeiro campo interativo ao abrir; ESC fecha.
- Cabeçalho com título "Preferências" (16px, font-medium) e subtítulo "Aplicam apenas em novos treinos" (12px, k-text-tertiary).
- Botão `X` no canto superior direito para fechar.
- Conteúdo: 6 seções colapsáveis, todas começam fechadas exceto na primeira abertura após o wizard (todas fechadas — usuário expande o que quer).
- Rodapé fixo (não rola junto com o conteúdo): link "Refazer onboarding" à esquerda + botão "Restaurar padrões" à direita.

Cada `<section>` segue este shape:

```tsx
<section className="border-b border-k-border-subtle">
    <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={isOpen}
    >
        <span className="text-sm font-medium text-k-text-primary">{title}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && <div className="px-4 pb-4 space-y-3">{children}</div>}
</section>
```

#### 6.2.1. Seção "Visualização"

Campos:
- **View padrão** — chip-row (single-select) com 4 opções: Mock (`preview`), Comparador (`compare`), Texto (`ai_prescribe`), Checklist (`normal`).
- **Biblioteca aberta ao entrar** — toggle (mesmo componente switch da `reports-preferences-section.tsx`, com classe `bg-violet-600` quando ligado).

#### 6.2.2. Seção "Padrões de série"

Campos:
- **Séries** + **Reps** — dois inputs `text` lado-a-lado em `grid-cols-2 gap-2`. Aceitam string (suportam faixa "3-4") com validação `/^\d+(-\d+)?$/`.
- **Descanso composto** + **Descanso isolado** — dois inputs numéricos com sufixo "s" em `grid-cols-2 gap-2`. Range válido 0–600.
- **Cadência** — input de texto opcional (placeholder "ex: 2-0-2").
- **Método de carga** — chip-row (single-select): kg, %1RM, RIR, RPE.
- **Campos visíveis** — chip-row (multi-select): Séries, Reps, Carga, Descanso, Cadência, RIR. Os 4 primeiros vêm marcados por padrão. Pelo menos 1 chip deve permanecer ativo (não deixa desmarcar todos).

#### 6.2.3. Seção "Adicionar exercício"

Campos:
- **Modo padrão** — chip-row (single-select): Simplificado (`simplified`), Editor de séries (`set_editor`).
- **Adicionar aquecimento automático** — toggle.

#### 6.2.4. Seção "Blocos rápidos"

Três `<textarea>` com max-length 500, rows={3}, label acima:
- Aquecimento — texto livre. Quando preenchido, ao clicar no botão "Aquecimento" da prescrição, esse texto é pré-preenchido na nota gerada.
- Aeróbio — texto livre, mesma lógica.
- Nota — texto livre, mesma lógica.

Placeholder explicativo em cada um: "Esse texto é pré-preenchido toda vez que você clicar em [Aquecimento/Aeróbio/Nota] em um treino."

#### 6.2.5. Seção "Estrutura do programa"

Campos:
- **Duração padrão** — input numérico em `grid-cols-2`, sufixo "semanas". Range 1–52.
- **Quantidade de treinos** — input numérico em `grid-cols-2`. Range 1–14.
- **Nomenclatura** — chip-row (single-select): Letras A/B/C (`letter`), Livre (`free`).

#### 6.2.6. Seção "IA"

Campos:
- **Foco** — chip-row (single-select): Hipertrofia (`hypertrophy`), Força (`strength`), Condicionamento (`conditioning`), Misto (`mixed`).
- **Variação** — chip-row (single-select): Conservadora (`conservative`), Moderada (`moderate`), Variada (`varied`).

#### 6.2.7. Rodapé do drawer

```tsx
<footer className="flex items-center justify-between px-4 py-3 border-t border-k-border-subtle bg-surface-inset">
    <button
        onClick={() => { closeDrawer(); openWizard(); }}
        className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
    >
        Refazer onboarding
    </button>
    <button
        onClick={handleResetWithConfirm}
        className="text-xs text-k-text-tertiary px-3 py-1.5 rounded-lg border border-k-border-primary hover:bg-surface-card"
    >
        Restaurar padrões
    </button>
</footer>
```

`handleResetWithConfirm` mostra um `window.confirm` (ou um mini-modal de confirmação inline, à preferência) com texto: "Restaurar todos os campos para os padrões da Kinevo? Sua resposta do onboarding não será afetada." Se OK, chama `resetPrescriptionPreferences()`.

### 6.3. Padrão de chip-row reutilizável

Criar `web/src/components/programs/preferences/chip-row.tsx`:

```tsx
interface ChipOption<T> { value: T; label: string }

interface ChipRowProps<T> {
    options: ChipOption<T>[]
    value: T | T[]
    onChange: (next: T | T[]) => void
    multi?: boolean
    minSelected?: number  // multi-only; default 0
}
```

Visual: `flex flex-wrap gap-1.5`. Chip ativo: `bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border-transparent`. Chip inativo: `bg-surface-card text-k-text-tertiary border-k-border-subtle hover:text-k-text-primary`. Padding `px-3 py-1`, `rounded-full`, `text-xs`, `border`.

### 6.4. PreferencesWizard

Arquivo: `web/src/components/programs/preferences/preferences-wizard.tsx`.

Modal centralizado (não drawer) com 4 passos. Botão "Pular" sempre visível à esquerda do rodapé; à direita "Próximo" (ou "Concluir" no passo 4).

**Passo 1 — Quais campos você usa?**
Multi-select de chips: Séries, Reps, Carga (kg), %1RM, RIR, RPE, Cadência, Descanso. Persiste em `set_defaults.visible_fields` (mapeamento direto) e em `set_defaults.load_method` quando o treinador escolheu apenas um entre kg/%1RM/RIR/RPE.

**Passo 2 — Seus valores padrão**
Três inputs numéricos lado-a-lado: Séries (default 3), Reps (default 10), Descanso (default 60s). Persiste em `set_defaults.sets`, `.reps`, `.rest_compound_seconds` (e copia o mesmo valor para `.rest_isolation_seconds`). Nota explicativa: "Faixas (ex: 3–4 séries) você configura nas Preferências quando quiser refinar."

**Passo 3 — Ao adicionar um exercício, prefere ver:**
Single-select de cards grandes: Simplificado (faixa única) ou Editor de séries (cada série individual). Persiste em `add_exercise.open_mode`.

**Passo 4 — Sua view favorita pra trabalhar:**
Single-select de cards grandes: Mock do celular, Comparador, Texto, Checklist. Persiste em `visualization.default_view`. Botão "Concluir" → marca `wizard_completed = true` → fecha modal → mostra toast "Tudo pronto. Você pode mudar isso a qualquer momento na engrenagem."

**Pular:** marca `wizard_dismissed = true` (sem `wizard_completed`), fecha modal, mantém defaults da Kinevo, exibe banner.

**Indicador de progresso:** quatro pontos no rodapé central (●●○○ no passo 2, etc.).

### 6.5. Banner de wizard pulado

Quando `wizard_completed === false && wizard_dismissed === true`, mostrar banner fino abaixo do header da tela de prescrição:

```tsx
<div className="bg-violet-50 dark:bg-violet-500/10 border-b border-violet-200 dark:border-violet-500/20 px-6 py-2 flex items-center justify-between">
    <p className="text-xs text-violet-700 dark:text-violet-300">
        Configure suas preferências em 1 minuto pra acelerar a criação de treinos.
    </p>
    <div className="flex items-center gap-2">
        <button onClick={openWizard} className="text-xs font-medium text-violet-700 dark:text-violet-300 hover:underline">
            Configurar agora →
        </button>
        <button onClick={dismissBanner} aria-label="Dispensar"><X className="w-3 h-3" /></button>
    </div>
</div>
```

`dismissBanner` chama `updatePrescriptionPreferences({ wizard_dismissed: false, wizard_completed: true })` — isto é, dispensar o banner conta como "completou implicitamente" (não vai voltar a aparecer).

### 6.6. Toast helper

Como o projeto não tem biblioteca de toast, criar um helper minimalista em `web/src/components/ui/toast.tsx`:

- Componente `<ToastProvider>` que renderiza um container fixed-bottom-right com z-index alto.
- Hook `useToast()` que expõe `toast({ message, type?: 'success' | 'error' })`.
- Auto-dismiss em 2.5s.
- Animação de slide+fade via framer-motion.
- Visual: pill 12px text, fundo `surface-card` com border `k-border-primary`, ícone `Check` (success) ou `AlertCircle` (error) à esquerda.

Adicionar `<ToastProvider>` no layout raiz da app (`web/src/app/layout.tsx`) ou no `AppLayout`. Não afeta áreas que não chamem `toast()`.

## 7. Como as preferências fluem na tela

A store de preferências é consumida nos seguintes pontos:

| Preferência | Consumido em |
|---|---|
| `visualization.default_view` | `program-builder-client.tsx`, useState inicial de `builderViewMode` (linha ~283). Substituir `useState<BuilderViewMode>('preview')` por `useState<BuilderViewMode>(preferences.visualization.default_view)` |
| `visualization.library_open_on_enter` | Estado inicial do painel `ExerciseLibraryPanel` |
| `set_defaults.sets / reps / rest_*` | Componente que renderiza um `<ExerciseQuickFields>` ou similar, ao adicionar um novo exercício |
| `set_defaults.load_method` | Mesmo ponto acima — define qual campo de carga aparece |
| `set_defaults.visible_fields` | Mesmo ponto — controla quais colunas/campos são visíveis |
| `add_exercise.open_mode` | Função que adiciona um novo exercício à lista de itens; decide se abre `ExerciseQuickFields` ou expande `ExerciseAdvancedSection` |
| `add_exercise.auto_warmup` | Função que adiciona exercício; se true, gera um `WarmupItemCard` automaticamente |
| `quick_blocks.*_template` | Handlers dos botões "Aquecimento", "Aeróbio", "Nota" do builder |
| `program_structure.default_weeks` | Defaults do form em `web/src/app/students/[id]/program/new/page.tsx` |
| `program_structure.default_workout_count` | Mesmo ponto: ao criar programa, gera N abas de treino com nomenclatura escolhida |
| `program_structure.naming_convention` | Mesmo ponto: `letter` gera "Treino A, B, C..."; `free` gera "Treino 1" sem letras |
| `ai.focus / ai.variation` | `ai-prescribe-panel.tsx` — pré-seleciona os parâmetros do prompt |

**Importante:** mudar uma preferência **não retroage** em programas/treinos abertos. As preferências entram em ação:
1. Na próxima vez que a tela for aberta (para `default_view`, `library_open_on_enter`).
2. Ao criar um novo programa, novo treino, ou adicionar um novo exercício (para os defaults de séries/reps/descanso, modo de adição, blocos rápidos).

## 8. Hidratação e fluxo de dados

1. Server: `program-builder-client.tsx` é renderizado por `web/src/app/programs/[id]/page.tsx`. Buscar `prescription_preferences` da tabela `trainers` no server component e passar como prop para `ProgramBuilderClient`.
2. Cliente: `ProgramBuilderClient` chama `usePrescriptionPreferencesStore.getState().setPreferences(props.preferences)` no primeiro render.
3. Toda mutação chama `updatePatch()` (otimista) + `updatePrescriptionPreferences(patch)` server action; em caso de erro, `rollback(previous)`.
4. `mark-wizard-completed.ts` é chamado no fim do wizard.

## 9. Eventos de analytics

Adicionar eventos (via mecanismo de tracking já existente — verificar se há `track()` ou similar no codebase; se não, simplesmente console.log com prefixo `[analytics]` para futura integração):

- `prescription_preferences_drawer_opened`
- `prescription_preferences_changed` (com `field` e `value`)
- `prescription_preferences_reset`
- `prescription_preferences_wizard_started`
- `prescription_preferences_wizard_completed`
- `prescription_preferences_wizard_skipped`
- `prescription_preferences_banner_dismissed`

## 10. Acceptance criteria

- [ ] Migração SQL aplicada e rollback testado.
- [ ] Coluna `trainers.prescription_preferences` retorna o default da Kinevo para qualquer treinador novo ou existente.
- [ ] Engrenagem aparece logo após o cluster de toggles de view, separada por divisor sutil.
- [ ] Click na engrenagem abre o drawer da direita em 380px com slide animation suave.
- [ ] Drawer tem cabeçalho com título "Preferências" e subtítulo "Aplicam apenas em novos treinos".
- [ ] Drawer contém as 6 seções colapsáveis, todas iniciam fechadas.
- [ ] Cada alteração em qualquer campo persiste em background com toast "Preferências salvas".
- [ ] Em caso de erro de rede, o estado faz rollback e toast de erro aparece.
- [ ] Botão "Restaurar padrões" pede confirmação e reseta tudo (exceto wizard_completed/wizard_dismissed).
- [ ] Link "Refazer onboarding" fecha o drawer e abre o wizard.
- [ ] No primeiro acesso a `/programs/[id]` por um treinador com `wizard_completed === false && wizard_dismissed === false`, o wizard aparece automaticamente.
- [ ] Wizard tem 4 passos com botão "Pular" sempre visível e indicador de progresso.
- [ ] Concluir o wizard marca `wizard_completed = true` e mostra toast de confirmação.
- [ ] Pular o wizard marca `wizard_dismissed = true` e exibe o banner.
- [ ] Banner aparece quando `wizard_dismissed === true && wizard_completed === false`. Dispensar o banner marca `wizard_completed = true`.
- [ ] `default_view` define o `BuilderViewMode` inicial ao abrir a tela.
- [ ] `library_open_on_enter` define se a `ExerciseLibraryPanel` abre por padrão.
- [ ] Adicionar um novo exercício respeita `add_exercise.open_mode` e popula séries/reps/descanso conforme `set_defaults`.
- [ ] Botões "Aquecimento", "Aeróbio", "Nota" do builder pré-preenchem com os templates configurados (quando não-nulos).
- [ ] Criar um novo programa popula a duração e quantidade de treinos a partir de `program_structure`.
- [ ] Mudar preferências não afeta programas/treinos já criados.
- [ ] Acessibilidade: drawer tem foco gerenciado, ESC fecha, Tab navega ordenadamente, todos os inputs têm labels associados.

## 11. Edge cases

- **Treinador sem coluna preenchida (legado):** o DEFAULT da migração resolve. Mesmo assim, o cliente deve fazer `?? KINEVO_DEFAULT_PREFERENCES` defensivamente.
- **Conflito de aba:** se o treinador tem duas abas abertas e edita preferências em uma, a outra mostra valores antigos até refresh. Aceitável para v1.
- **Conexão offline ao editar:** otimismo + rollback + toast de erro.
- **`visible_fields` vazio:** nunca permitir; `ChipRow` com `minSelected={1}`.
- **Valor de input inválido (ex: descanso < 0 ou > 600):** validar no cliente antes de chamar a server action; mostrar borda vermelha e não persistir.
- **Wizard abandonado no meio:** se o treinador fechar o tab no passo 2, ao voltar ele recomeça do passo 1 (não persistimos progresso parcial).
- **Programa novo aberto enquanto wizard está aberto:** wizard fica acima de tudo (z-modal); ao fechar, volta para a tela.

## 12. Estrutura de arquivos final

```
web/src/
├── actions/trainer/
│   ├── update-prescription-preferences.ts        (novo)
│   ├── reset-prescription-preferences.ts          (novo)
│   └── mark-wizard-completed.ts                   (novo)
├── components/programs/
│   ├── program-builder-client.tsx                 (editado: gear button + hidratação)
│   └── preferences/                               (novo)
│       ├── preferences-drawer.tsx
│       ├── preferences-wizard.tsx
│       ├── preferences-banner.tsx
│       ├── chip-row.tsx
│       └── sections/
│           ├── visualization-section.tsx
│           ├── set-defaults-section.tsx
│           ├── add-exercise-section.tsx
│           ├── quick-blocks-section.tsx
│           ├── program-structure-section.tsx
│           └── ai-section.tsx
├── components/ui/
│   └── toast.tsx                                  (novo)
├── stores/
│   └── prescription-preferences-store.ts          (novo)
├── types/
│   └── prescription-preferences.ts                (novo)
└── app/
    ├── layout.tsx                                 (editado: <ToastProvider>)
    └── programs/[id]/page.tsx                     (editado: passar preferences como prop)

supabase/migrations/
└── NNN_trainer_prescription_preferences.sql       (novo — N = próximo número livre)
```

## 13. Estratégia de implementação (ordem sugerida)

1. **Migração + tipos**: cria coluna JSONB e tipos TS. Verifica que `SELECT prescription_preferences FROM trainers` retorna o default.
2. **Server actions**: três actions (update, reset, mark-wizard-completed) com testes manuais via Supabase Studio.
3. **Toast helper**: componente standalone, plugado no layout raiz.
4. **Store Zustand**: `prescription-preferences-store.ts` com hidratação inicial.
5. **Engrenagem + drawer mínimo (sem seções)**: provar que abre/fecha, animação ok, persistência básica.
6. **Seções uma a uma**: Visualização → Padrões de série → Adicionar exercício → Blocos rápidos → Estrutura do programa → IA. Cada uma testa persistência.
7. **Wizard**: 4 passos, navegação, conclusão e pulo.
8. **Banner**: aparece quando devido, dispensa funciona.
9. **Consumo das preferências**: aplicar em todos os pontos da seção 7 desta spec.
10. **Polish**: animações, foco, acessibilidade, eventos de analytics.

Recomenda-se commits pequenos a cada etapa para review incremental.

## 14. Limitações conhecidas v1

A entrega v1 (Maio 2026) divergiu da spec em quatro pontos por escopo. Detalhes, motivos e sugestões para v2 estão em [`PRD_preferencias_prescricao_LIMITACOES_V1.md`](./PRD_preferencias_prescricao_LIMITACOES_V1.md).
