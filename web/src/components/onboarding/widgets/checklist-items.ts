import type {
  OnboardingMilestones,
  TrainerModalityFocus,
} from '@kinevo/shared/types/onboarding'
import {
  UserPlus,
  Calendar,
  Send,
  Dumbbell,
  FileText,
  Wallet,
  Share2,
  Smartphone,
  Activity,
  Globe,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

/** Fase 17b · fix BUG 3+4 — alguns itens não navegam, só abrem um dialog inline. */
export type ChecklistAction = 'navigate' | 'open_app_links_dialog'

export interface ChecklistItem {
  key: keyof OnboardingMilestones
  label: string
  description: string
  href: string
  icon: LucideIcon
  /** Fase 17b — undefined = sempre visível. */
  visibleFor?: TrainerModalityFocus[]
  /** Fase 17b · fix — default 'navigate' (usa href). 'open_app_links_dialog'
   *  abre o modal com QR codes do app sem sair da página. */
  action?: ChecklistAction
}

/**
 * Fase 17b — ordem reflete a sequência sugerida do onboarding.
 *
 * Counts resolvidos por `getChecklistItemsForModality`:
 * - presencial: 9 (universais 8 + training_room)
 * - online: 10 (universais 8 + form + financial)
 * - ambos/null: 11 (todos)
 */
export const ALL_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    key: 'first_student_created',
    label: 'Cadastrar primeiro aluno',
    description: 'Adicione um aluno à plataforma',
    href: '/students',
    icon: UserPlus,
  },
  {
    key: 'first_program_created',
    label: 'Criar um programa',
    description: 'Monte um programa de treino',
    href: '/programs/new',
    icon: Calendar,
  },
  {
    key: 'first_form_sent',
    label: 'Enviar formulário',
    description: 'Envie anamnese ou check-in',
    href: '/forms/templates/new',
    icon: FileText,
    visibleFor: ['online', 'ambos'],
  },
  {
    key: 'app_link_shared',
    label: 'Compartilhar link do App',
    description: 'Envie o App para um aluno',
    href: '#',
    icon: Share2,
    action: 'open_app_links_dialog',
  },
  {
    key: 'mobile_logged_in',
    label: 'Entre no App Mobile',
    description: 'Baixe e faça login com o mesmo email do web',
    href: '#',
    icon: Smartphone,
    action: 'open_app_links_dialog',
  },
  {
    key: 'first_training_room_session',
    label: '1ª sessão na Sala de Treino',
    description: 'Treine presencialmente com um aluno',
    href: '/training-room',
    icon: Activity,
    visibleFor: ['presencial', 'ambos'],
  },
  {
    key: 'first_exercise_added',
    label: 'Adicionar exercício personalizado',
    description: 'Crie um exercício com seu nome',
    href: '/exercises',
    icon: Dumbbell,
  },
  {
    key: 'financial_setup',
    label: 'Configurar financeiro',
    description: 'Conecte Stripe ou crie planos',
    href: '/financial',
    icon: Wallet,
    visibleFor: ['online', 'ambos'],
  },
  {
    key: 'first_program_assigned',
    label: 'Atribuir programa a um aluno',
    description: 'Publique um programa para alguém',
    href: '/students',
    icon: Send,
  },
  {
    key: 'first_assistant_chat',
    label: 'Converse com o Assistente IA',
    description: 'Peça em português — ele executa por você',
    href: '/assistente',
    icon: Sparkles,
  },
  {
    key: 'landing_published',
    label: 'Publicar sua landing',
    description: 'Crie a página pública pra captar alunos',
    href: '/marketing/landing',
    icon: Globe,
  },
]

/** Fase 17b — null tratado como 'ambos' (mostra tudo). */
export function getChecklistItemsForModality(
  focus: TrainerModalityFocus,
): ChecklistItem[] {
  const resolved: Exclude<TrainerModalityFocus, null> = focus ?? 'ambos'
  return ALL_CHECKLIST_ITEMS.filter(
    (item) => !item.visibleFor || item.visibleFor.includes(resolved),
  )
}

/** Legacy export — mantido pra retro-compat de código fora deste arquivo
 *  ainda referenciando `CHECKLIST_ITEMS`. Equivale a items pra 'ambos'. */
export const CHECKLIST_ITEMS = ALL_CHECKLIST_ITEMS
