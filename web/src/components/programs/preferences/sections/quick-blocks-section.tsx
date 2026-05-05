'use client'

import { usePrescriptionPreferencesStore } from '@/stores/prescription-preferences-store'
import { CollapsibleSection } from '../collapsible-section'
import { useDraftSync } from '../use-draft-sync'
import { usePreferenceSaver } from '../use-preference-saver'

type TemplateField = 'warmup_template' | 'aerobic_template' | 'note_template'

interface BlockProps {
    id: string
    label: string
    placeholder: string
    field: TemplateField
}

function TemplateBlock({ id, label, placeholder, field }: BlockProps) {
    const current = usePrescriptionPreferencesStore((s) => s.preferences.quick_blocks[field]) ?? ''
    const savePatch = usePreferenceSaver()
    const [draft, setDraft] = useDraftSync(current)

    const handleBlur = () => {
        const trimmed = draft.trim()
        const next = trimmed === '' ? null : trimmed
        const currentNormalized = current.trim() === '' ? null : current.trim()
        if (next === currentNormalized) return
        savePatch({ quick_blocks: { [field]: next } })
    }

    return (
        <div className="space-y-1">
            <label htmlFor={id} className="text-xs text-k-text-tertiary">{label}</label>
            <textarea
                id={id}
                rows={3}
                maxLength={500}
                placeholder={placeholder}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={handleBlur}
                className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-card border border-k-border-subtle text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
            />
        </div>
    )
}

export function QuickBlocksSection() {
    return (
        <CollapsibleSection title="Blocos rápidos">
            <TemplateBlock
                id="pref-quick-warmup"
                label="Aquecimento"
                placeholder="Esse texto é pré-preenchido toda vez que você clicar em Aquecimento em um treino."
                field="warmup_template"
            />
            <TemplateBlock
                id="pref-quick-aerobic"
                label="Aeróbio"
                placeholder="Esse texto é pré-preenchido toda vez que você clicar em Aeróbio em um treino."
                field="aerobic_template"
            />
            <TemplateBlock
                id="pref-quick-note"
                label="Nota"
                placeholder="Esse texto é pré-preenchido toda vez que você clicar em Nota em um treino."
                field="note_template"
            />
        </CollapsibleSection>
    )
}
