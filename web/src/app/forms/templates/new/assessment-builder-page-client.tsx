'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AssessmentTemplateSchema } from '@kinevo/shared/types/assessments'
import {
    createAssessmentTemplate,
    updateAssessmentTemplate,
} from '@/actions/assessments/update-template'
import { useToast } from '@/components/ui/toast'
import { AssessmentBuilderCanvas } from '@/components/assessments/builder/assessment-builder-canvas'

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

    return (
        <div className="h-[calc(100vh-8rem)]">
            <AssessmentBuilderCanvas
                templateId={templateId}
                initialTitle={initialTitle}
                initialDescription={initialDescription}
                initialSchema={initialSchema}
                saving={saving}
                onCancel={() => router.push('/forms?tab=assessments')}
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
                        // Edit-existing returns success with no id; create returns templateId.
                        // For new templates land back on /forms tab assessments.
                        router.push('/forms?tab=assessments')
                        router.refresh()
                        return { success: true }
                    } finally {
                        setSaving(false)
                    }
                }}
            />
        </div>
    )
}
