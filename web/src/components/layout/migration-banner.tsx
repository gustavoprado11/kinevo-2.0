'use client'

import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { updateOnboardingState } from '@/actions/onboarding/update-onboarding-state'

const TIP_ID = 'fase2_migration_banner'

// M8/D1 — comunica a separação Formulários/Avaliações na primeira visita
// pós-deploy. Persiste em onboarding_state.tips_dismissed.
//
// Importante: o store usa skipHydration:true, então o estado do localStorage
// não é restaurado no mount — server é a fonte da verdade. Por isso fazemos
// o sync direto (sem o debounce do _syncToServer) e só ocultamos o banner
// localmente após a confirmação do server, garantindo que F5 imediato não
// reapresente o banner.
export function MigrationBanner() {
    const isHydrated = useOnboardingStore(s => s.isHydrated)
    const isDismissed = useOnboardingStore(s => s.state.tips_dismissed.includes(TIP_ID))
    const currentState = useOnboardingStore(s => s.state)
    const dismissTipLocal = useOnboardingStore(s => s.dismissTip)
    const [closing, setClosing] = useState(false)
    const [busy, setBusy] = useState(false)

    if (!isHydrated || isDismissed) return null

    const handleDismiss = async () => {
        if (busy) return
        setBusy(true)
        try {
            // Persistência síncrona no server primeiro — protege contra F5
            // antes do debounce de 800ms do store rodar.
            await updateOnboardingState({
                ...currentState,
                tips_dismissed: [...currentState.tips_dismissed, TIP_ID],
            })
        } catch {
            // Fallback: deixa o store tentar via debounce
        }
        setClosing(true)
        dismissTipLocal(TIP_ID)
        setBusy(false)
    }

    return (
        <div
            className={`mb-4 flex items-center gap-3 rounded-xl border border-[#007AFF]/20 bg-[#007AFF]/5 px-4 py-3 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`}
            role="status"
        >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#007AFF]/10">
                <Sparkles className="h-4 w-4 text-[#007AFF] dark:text-violet-400" />
            </div>
            <p className="flex-1 text-sm text-[#1D1D1F] dark:text-k-text-secondary">
                Renomeamos para <strong className="font-semibold">Formulários</strong> e <strong className="font-semibold">Avaliações</strong>. Os 2 estão no menu lateral.
            </p>
            <button
                type="button"
                onClick={handleDismiss}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full bg-[#007AFF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6] dark:bg-violet-600 dark:hover:bg-violet-500 transition-colors"
            >
                Entendi
            </button>
            <button
                type="button"
                onClick={handleDismiss}
                disabled={busy}
                aria-label="Fechar"
                className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-[#86868B] hover:bg-[#007AFF]/10 hover:text-[#1D1D1F] dark:text-k-text-quaternary dark:hover:text-k-text-primary transition-colors"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}
