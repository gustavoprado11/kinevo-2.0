/**
 * Fonte única da navegação do app — consumida pela Sidebar global
 * (components/layout/sidebar.tsx), que serve os dois modos (Clássico e
 * Assistente). Não duplicar estes arrays.
 */

import {
    LayoutDashboard, Users, Megaphone, CalendarDays, FileText, Wallet,
    Calendar, Dumbbell,
} from 'lucide-react'

export interface NavItem {
    name: string
    href: string
    icon: React.ElementType
    onboardingId?: string
    /** Prefixos extras de path que também ativam este item (ex.: /forms ativa em /avaliacoes). */
    extraActivePrefixes?: string[]
}

export const MAIN_NAV: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, onboardingId: 'sidebar-dashboard' },
    { name: 'Alunos', href: '/students', icon: Users, onboardingId: 'sidebar-students' },
    { name: 'Marketing', href: '/marketing', icon: Megaphone, onboardingId: 'sidebar-marketing', extraActivePrefixes: ['/leads', '/landing'] },
    { name: 'Agenda', href: '/schedule', icon: CalendarDays, onboardingId: 'sidebar-schedule' },
    { name: 'Formulários e Avaliações', href: '/forms', icon: FileText, onboardingId: 'sidebar-forms', extraActivePrefixes: ['/avaliacoes'] },
    { name: 'Financeiro', href: '/financial', icon: Wallet, onboardingId: 'sidebar-financial' },
]

export const BIBLIOTECA_NAV: NavItem[] = [
    { name: 'Programas', href: '/programs', icon: Calendar, onboardingId: 'sidebar-programs' },
    { name: 'Exercícios', href: '/exercises', icon: Dumbbell, onboardingId: 'sidebar-exercises' },
]
