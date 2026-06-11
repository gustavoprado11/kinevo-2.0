'use client'

import { LazyMotion, domAnimation } from 'framer-motion'

// Carrega só o subconjunto domAnimation do framer-motion (animações DOM,
// AnimatePresence, exit/variants) em vez da engine completa (~70KB).
// Os componentes da landing usam `m.*` em vez de `motion.*`; com `strict`,
// qualquer `motion.*` esquecido lança erro em dev — garantia de que a
// engine completa nunca entra no bundle da landing.
export function LandingMotionProvider({ children }: { children: React.ReactNode }) {
    return (
        <LazyMotion features={domAnimation} strict>
            {children}
        </LazyMotion>
    )
}
