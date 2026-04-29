import { Activity, Flame, Layers, type LucideIcon } from 'lucide-react'

export type WorkoutCardType = 'warmup' | 'exercise' | 'cardio' | 'superset' | 'superset_child'

export interface WorkoutCardTypeConfig {
  icon: LucideIcon | null
  accentVar: string
  accentBgVar: string
  label: string
}

export const WORKOUT_CARD_TYPE: Record<WorkoutCardType, WorkoutCardTypeConfig> = {
  warmup: {
    icon: Flame,
    accentVar: 'var(--accent-warmup)',
    accentBgVar: 'var(--accent-warmup-bg)',
    label: 'Aquecimento',
  },
  exercise: {
    icon: null,
    accentVar: 'var(--text-primary)',
    accentBgVar: 'transparent',
    label: 'Exercício',
  },
  cardio: {
    icon: Activity,
    accentVar: 'var(--accent-cardio)',
    accentBgVar: 'var(--accent-cardio-bg)',
    label: 'Aeróbio',
  },
  superset: {
    icon: Layers,
    accentVar: 'var(--accent-superset)',
    accentBgVar: 'var(--accent-superset-bg)',
    label: 'Superset',
  },
  superset_child: {
    icon: null,
    accentVar: 'var(--text-primary)',
    accentBgVar: 'transparent',
    label: 'Exercício (filho)',
  },
}

export const DROP_SET_ACCENT = {
  fg: 'var(--accent-dropset)',
  bg: 'var(--accent-dropset-bg)',
} as const
