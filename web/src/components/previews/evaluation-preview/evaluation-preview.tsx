'use client'

import { useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { PhoneFrame } from '@/components/previews/phone-frame'
import { PreviewQuestionCard } from './preview-question-card'
import { builderToPreview, type BuilderQuestion } from './builder-to-preview'
import { colors, spacing, typography } from './preview-design-tokens'

interface EvaluationPreviewProps {
    title: string
    description: string
    questions: BuilderQuestion[]
}

export function EvaluationPreview({ title, description, questions }: EvaluationPreviewProps) {
    const data = useMemo(() => builderToPreview(title, description, questions), [title, description, questions])

    return (
        <PhoneFrame>
            {/* Header — matches mobile inbox/[id].tsx */}
            <div
                style={{
                    paddingLeft: spacing.headerPaddingH,
                    paddingRight: spacing.headerPaddingH,
                    paddingTop: spacing.headerPaddingTop + 40, // extra for dynamic island
                    paddingBottom: spacing.headerPaddingBottom,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.headerBg,
                    flexShrink: 0,
                }}
            >
                <div style={{ marginRight: 10 }}>
                    <ChevronLeft size={22} color={colors.headerIcon} />
                </div>
                <span style={{ color: colors.textPrimary, fontWeight: typography.headerTitle.fontWeight, fontSize: typography.headerTitle.fontSize }}>
                    Detalhe da Inbox
                </span>
            </div>

            {/* Scrollable content */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    paddingLeft: spacing.scrollPaddingH,
                    paddingRight: spacing.scrollPaddingH,
                    paddingBottom: spacing.scrollPaddingB,
                    backgroundColor: colors.screenBg,
                }}
            >
                {/* Title card */}
                <div
                    style={{
                        backgroundColor: colors.titleCardBg,
                        borderRadius: spacing.titleCardRadius,
                        padding: spacing.titleCardPadding,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: colors.titleCardBorder,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        marginTop: 4,
                    }}
                >
                    <div style={{ color: colors.textPrimary, fontWeight: typography.formTitle.fontWeight, fontSize: typography.formTitle.fontSize }}>
                        {data.title}
                    </div>
                    {data.subtitle && (
                        <div style={{ color: colors.textSecondary, marginTop: 6, fontSize: typography.formSubtitle.fontSize }}>
                            {data.subtitle}
                        </div>
                    )}
                </div>

                {/* Questions */}
                <div style={{ marginTop: spacing.questionCardGap }}>
                    {data.questions.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 60 }}>
                            <span style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: '20px' }}>
                                Adicione perguntas para{'\n'}visualizar o formulário.
                            </span>
                        </div>
                    ) : (
                        data.questions.map((q) => (
                            <PreviewQuestionCard key={q.id} question={q} />
                        ))
                    )}
                </div>

                {/* Submit button */}
                {data.questions.length > 0 && (
                    <div
                        style={{
                            marginTop: spacing.submitMarginTop,
                            borderRadius: spacing.submitRadius,
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                background: `linear-gradient(135deg, ${colors.submitGradientStart}, ${colors.submitGradientEnd})`,
                                backgroundColor: colors.submitBg,
                                paddingTop: spacing.submitPaddingV,
                                paddingBottom: spacing.submitPaddingV,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor: colors.submitBorder,
                                borderRadius: spacing.submitRadius,
                            }}
                        >
                            <span style={{ color: '#fff', fontWeight: typography.submitText.fontWeight, fontSize: typography.submitText.fontSize, letterSpacing: typography.submitText.letterSpacing }}>
                                ENVIAR FORMULÁRIO
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </PhoneFrame>
    )
}
