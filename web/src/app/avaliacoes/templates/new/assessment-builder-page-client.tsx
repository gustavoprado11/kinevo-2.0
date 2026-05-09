'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AssessmentTemplateSchema } from '@kinevo/shared/types/assessments'
import {
    createAssessmentTemplate,
    updateAssessmentTemplate,
} from '@/actions/assessments/update-template'
import { useToast } from '@/components/ui/toast'
import { AssessmentBuilderCanvas } from '@/components/assessments/builder/assessment-builder-canvas'
import { BuilderShell } from '@/components/shared/builder-shell'

interface AssessmentBuilderPageClientProps {
    templateId: string | null
    initialTitle: string
    initialDescription: string | null
    initialSchema: AssessmentTemplateSchema
}

export function AssessmentBuilderPageClient({
    templateId,
    initialTitle,
    initialDescription,
    initialSchema,
}: AssessmentBuilderPageClientProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [saving, setSaving] = useState(false)
    // Estado vivo do canvas, propagado via onStateChange.
    const [shellState, setShellState] = useState({
        title: initialTitle,
        isDirty: false,
        canSave: false,
        save: async () => { /* placeholder até canvas montar */ },
    })

    const handleStateChange = useCallback((s: {
        title: string
        isDirty: boolean
        canSave: boolean
        save: () => Promise<void>
    }) => {
        setShellState(s)
    }, [])

    return (
        <BuilderShell
            title={shellState.title || 'Novo template de avaliação'}
            subtitle={templateId ? 'Editando template' : 'Criando novo template'}
            isDirty={shellState.isDirty}
            isSaving={saving}
            canSave={shellState.canSave && !saving}
            onExit={() => router.push('/avaliacoes')}
            onSave={() => shellState.save()}
            draftKey={`assessment-builder-draft:${templateId ?? 'new'}`}
        >
            <div className="min-h-0 flex-1">
                <AssessmentBuilderCanvas
                    templateId={templateId}
                    initialTitle={initialTitle}
                    initialDescription={initialDescription}
                    initialSchema={initialSchema}
                    saving={saving}
                    renderTopbar={false}
                    onStateChange={handleStateChange}
                    onSave={async ({ title, description, schema }) => {
                        setSaving(true)
                        try {
                            const result = templateId
                                ? await updateAssessmentTemplate({
                                    templateId,
                                    title,
                                    description,
                                    schema,
                                })
                                : await createAssessmentTemplate({
                                    title,
                                    description,
                                    schema,
                                })

                            if (!result.success) {
                                toast({ type: 'error', message: result.error ?? 'Erro ao salvar' })
                                return { success: false, error: result.error }
                            }

                            toast({ type: 'success', message: 'Template salvo' })
                            router.push('/avaliacoes')
                            router.refresh()
                            return { success: true }
                        } finally {
                            setSaving(false)
                        }
                    }}
                />
            </div>
        </BuilderShell>
    )
}
