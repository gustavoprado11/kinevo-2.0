import { redirect } from 'next/navigation'

/**
 * Decisão 16/jul: o estúdio usa as telas normais do Kinevo. A "Visão geral"
 * que vivia aqui migrou para o Dashboard do gestor; a aba Estúdio ficou só
 * com administração (Treinadores + Plano).
 */
export default function EstudioPage() {
    redirect('/dashboard')
}
