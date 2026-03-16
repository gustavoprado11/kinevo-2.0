import { colors, spacing, typography } from './preview-design-tokens'
import { PreviewField } from './preview-field'
import type { PreviewQuestion } from './builder-to-preview'

interface PreviewQuestionCardProps {
    question: PreviewQuestion
}

export function PreviewQuestionCard({ question }: PreviewQuestionCardProps) {
    return (
        <div
            style={{
                backgroundColor: colors.questionCardBg,
                borderRadius: spacing.questionCardRadius,
                padding: spacing.questionCardPadding,
                marginBottom: spacing.questionCardMarginBottom,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: colors.questionCardBorder,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                overflow: 'hidden',
            }}
        >
            <div style={{ fontSize: typography.questionLabel.fontSize, fontWeight: typography.questionLabel.fontWeight, color: colors.textPrimary, marginBottom: 4 }}>
                {question.label}{question.required ? ' *' : ''}
            </div>
            <PreviewField question={question} />
        </div>
    )
}
