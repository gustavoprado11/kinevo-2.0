'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { inferModality } from '@/actions/trainer/infer-modality'
import { updateTrainerModality } from '@/actions/trainer/update-trainer-modality'
import type { TrainerModalityFocus } from '@kinevo/shared/types/onboarding'
import { AssistantMark } from '@/components/assistant/assistant-mark'

const TIP_KEY = 'modality_inference_v1'

const LABEL: Record<NonNullable<TrainerModalityFocus>, string> = {
  presencial: 'presencialmente',
  online: 'online',
  ambos: 'os dois modelos',
}

interface ModalityInferenceToastProps {
  studentsCount: number
}

/**
 * Fase 17b — banner inline (não usa o ToastProvider) no topo do dashboard.
 *
 * Condições pra renderizar:
 *   1. modalityFocus === null (trainer não respondeu)
 *   2. tip `modality_inference_v1` não foi dispensada
 *   3. studentsCount >= 3
 *   4. inferModality() retornou uma sugestão (>= 80% dominância)
 */
export function ModalityInferenceToast({
  studentsCount,
}: ModalityInferenceToastProps) {
  const isHydrated = useOnboardingStore((s) => s.isHydrated)
  const modalityFocus = useOnboardingStore((s) => s.modalityFocus)
  const isTipDismissed = useOnboardingStore((s) => s.isTipDismissed)
  const dismissTip = useOnboardingStore((s) => s.dismissTip)
  const setModalityFocus = useOnboardingStore((s) => s.setModalityFocus)

  const [suggestion, setSuggestion] = useState<NonNullable<TrainerModalityFocus> | null>(null)
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)

  const tipDismissed = isHydrated ? isTipDismissed(TIP_KEY) : true

  useEffect(() => {
    if (!isHydrated) return
    if (modalityFocus !== null) return
    if (tipDismissed) return
    if (studentsCount < 3) return

    let cancelled = false
    void inferModality().then((result) => {
      if (cancelled) return
      if (result.inferred && result.inferred !== 'ambos') {
        setSuggestion(result.inferred as NonNullable<TrainerModalityFocus>)
        setVisible(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [isHydrated, modalityFocus, tipDismissed, studentsCount])

  const handleAccept = async () => {
    if (!suggestion || busy) return
    setBusy(true)
    setModalityFocus(suggestion)
    void updateTrainerModality(suggestion).catch(() => {})
    dismissTip(TIP_KEY)
    setVisible(false)
  }

  const handleKeep = () => {
    dismissTip(TIP_KEY)
    setVisible(false)
  }

  if (!visible || !suggestion) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="mb-5 relative rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 shadow-sm overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-violet-500/10 blur-3xl rounded-full pointer-events-none" />

          <button
            onClick={handleKeep}
            disabled={busy}
            className="absolute top-3 right-3 p-1 text-muted-foreground/40 hover:text-foreground rounded-md transition-colors disabled:opacity-50"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>

          <div className="flex items-start gap-3 pr-6">
            <div className="w-9 h-9 bg-violet-500/15 rounded-xl flex items-center justify-center border border-violet-500/30 flex-shrink-0">
              <AssistantMark size={16} className="text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground">
                Notei que você atende {LABEL[suggestion]}.
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Quer ajustar seu onboarding pra mostrar só o que faz sentido pra
                esse perfil?
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => void handleAccept()}
                  disabled={busy}
                  className="px-3 py-1.5 bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold rounded-control transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? 'Salvando…' : 'Sim, ajustar'}
                </button>
                <button
                  onClick={handleKeep}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors disabled:opacity-50"
                >
                  Manter como está
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
