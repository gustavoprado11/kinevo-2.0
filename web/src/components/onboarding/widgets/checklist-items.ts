import type { OnboardingMilestones } from '@kinevo/shared/types/onboarding'
import {
  UserPlus,
  Calendar,
  Send,
  Dumbbell,
  FileText,
  Wallet,
  Share2,
  type LucideIcon,
} from 'lucide-react'

export interface ChecklistItem {
  key: keyof OnboardingMilestones
  label: string
  description: string
  href: string
  icon: LucideIcon
}

export const CHECKLIST_ITEMS: ChecklistItem[] = [
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
    key: 'first_program_assigned',
    label: 'Atribuir programa a um aluno',
    description: 'Publique um programa para alguém',
    href: '/students',
    icon: Send,
  },
  {
    key: 'first_exercise_added',
    label: 'Adicionar exercício personalizado',
    description: 'Crie um exercício com seu nome',
    href: '/exercises',
    icon: Dumbbell,
  },
  {
    key: 'first_form_sent',
    label: 'Enviar formulário',
    description: 'Envie anamnese ou check-in',
    href: '/forms/templates/new',
    icon: FileText,
  },
  {
    key: 'financial_setup',
    label: 'Configurar financeiro',
    description: 'Conecte Stripe ou crie planos',
    href: '/financial',
    icon: Wallet,
  },
  {
    key: 'app_link_shared',
    label: 'Compartilhar link do App',
    description: 'Envie o App para um aluno',
    href: '/dashboard',
    icon: Share2,
  },
]
