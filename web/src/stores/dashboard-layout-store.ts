import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Widget Types ──

export type WidgetId =
    | 'stats'
    | 'insights'
    | 'expiring-programs'
    | 'activity-feed'
    | 'weekly-goals'
    | 'student-ranking'
    | 'upcoming-appointments'

export type WidgetSize = 'full' | 'half' | 'third'

export interface WidgetConfig {
    id: WidgetId
    label: string
    description: string
    size: WidgetSize
    removable: boolean       // can the user hide this widget?
    defaultEnabled: boolean  // shown by default?
}

export interface WidgetPlacement {
    id: WidgetId
    order: number
}

// ── Registry of all available widgets ──

export const WIDGET_REGISTRY: Record<WidgetId, WidgetConfig> = {
    'stats': {
        id: 'stats',
        label: 'KPIs',
        description: 'Alunos ativos, treinos, receita e aderência',
        size: 'full',
        removable: false,
        defaultEnabled: true,
    },
    'insights': {
        id: 'insights',
        label: 'Assistente Kinevo',
        description: 'Insights de IA e ações pendentes',
        size: 'half',
        removable: true,
        defaultEnabled: true,
    },
    'expiring-programs': {
        id: 'expiring-programs',
        label: 'Programas encerrando',
        description: 'Programas que precisam de renovação',
        size: 'half',
        removable: true,
        defaultEnabled: true,
    },
    'activity-feed': {
        id: 'activity-feed',
        label: 'Treinos de hoje',
        description: 'Atividade dos alunos em tempo real',
        size: 'full',
        removable: true,
        defaultEnabled: true,
    },
    'weekly-goals': {
        id: 'weekly-goals',
        label: 'Metas semanais',
        description: 'Acompanhe metas de treinos, receita e novos alunos',
        size: 'half',
        removable: true,
        defaultEnabled: false,
    },
    'student-ranking': {
        id: 'student-ranking',
        label: 'Ranking de alunos',
        description: 'Top alunos por frequência e aderência',
        size: 'half',
        removable: true,
        defaultEnabled: false,
    },
    'upcoming-appointments': {
        id: 'upcoming-appointments',
        label: 'Próximos agendamentos',
        description: 'Sessões agendadas para os próximos dias',
        size: 'full',
        removable: true,
        defaultEnabled: false,
    },
}

// Default layout order
const DEFAULT_LAYOUT: WidgetPlacement[] = [
    { id: 'stats', order: 0 },
    { id: 'insights', order: 1 },
    { id: 'expiring-programs', order: 2 },
    { id: 'activity-feed', order: 3 },
]

// ── Store ──

interface DashboardLayoutState {
    widgets: WidgetPlacement[]
    isCustomizing: boolean

    // Actions
    setWidgets: (widgets: WidgetPlacement[]) => void
    addWidget: (id: WidgetId) => void
    removeWidget: (id: WidgetId) => void
    reorderWidgets: (activeId: string, overId: string) => void
    resetLayout: () => void
    setCustomizing: (v: boolean) => void
}

export const useDashboardLayoutStore = create<DashboardLayoutState>()(
    persist(
        (set, get) => ({
            widgets: DEFAULT_LAYOUT,
            isCustomizing: false,

            setWidgets: (widgets) => set({ widgets }),

            addWidget: (id) => {
                const { widgets } = get()
                if (widgets.some(w => w.id === id)) return
                const maxOrder = widgets.reduce((max, w) => Math.max(max, w.order), -1)
                set({ widgets: [...widgets, { id, order: maxOrder + 1 }] })
            },

            removeWidget: (id) => {
                const config = WIDGET_REGISTRY[id]
                if (!config?.removable) return
                set({ widgets: get().widgets.filter(w => w.id !== id) })
            },

            reorderWidgets: (activeId, overId) => {
                const { widgets } = get()
                const oldIndex = widgets.findIndex(w => w.id === activeId)
                const newIndex = widgets.findIndex(w => w.id === overId)
                if (oldIndex === -1 || newIndex === -1) return

                const updated = [...widgets]
                const [moved] = updated.splice(oldIndex, 1)
                updated.splice(newIndex, 0, moved)
                // Re-assign orders
                set({ widgets: updated.map((w, i) => ({ ...w, order: i })) })
            },

            resetLayout: () => set({ widgets: DEFAULT_LAYOUT }),

            setCustomizing: (v) => set({ isCustomizing: v }),
        }),
        {
            name: 'kinevo:dashboard-layout',
            // Silent migration: layouts persisted before Fase 4 used the id
            // 'upcoming-schedules' for the placeholder widget. Rename in-place
            // on hydrate so saved layouts don't break. No user-facing change.
            migrate: (state: unknown) => {
                if (
                    state &&
                    typeof state === 'object' &&
                    'widgets' in state &&
                    Array.isArray((state as { widgets: unknown }).widgets)
                ) {
                    const s = state as { widgets: Array<{ id: string; order: number }> }
                    s.widgets = s.widgets.map((w) =>
                        w.id === 'upcoming-schedules'
                            ? { ...w, id: 'upcoming-appointments' }
                            : w,
                    )
                }
                return state as DashboardLayoutState
            },
            version: 1,
        }
    )
)
