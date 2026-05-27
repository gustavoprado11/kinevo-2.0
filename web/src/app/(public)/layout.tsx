import { Fraunces } from 'next/font/google'

/**
 * Layout das rotas públicas (sem auth, sem AppLayout).
 * Carrega Fraunces — usada como display font nas landings.
 */
const fraunces = Fraunces({
    subsets: ['latin'],
    variable: '--font-fraunces',
    display: 'swap',
    weight: ['400', '500', '600', '700'],
    style: ['normal', 'italic'],
})

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return <div className={fraunces.variable}>{children}</div>
}
