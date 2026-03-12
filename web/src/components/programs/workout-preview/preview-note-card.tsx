import { StickyNote, ChevronUp } from 'lucide-react'
import { colors, spacing, typography } from './preview-design-tokens'

interface PreviewNoteCardProps {
    text: string
}

export function PreviewNoteCard({ text }: PreviewNoteCardProps) {
    return (
        <div
            style={{
                backgroundColor: colors.noteBg,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: colors.noteBorder,
                borderRadius: spacing.noteBorderRadius,
                padding: spacing.notePadding,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: spacing.noteMarginBottom,
            }}
        >
            <StickyNote size={16} color={colors.violet500} style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
                <span
                    style={{
                        fontSize: typography.noteCard.fontSize,
                        lineHeight: `${typography.noteCard.lineHeight}px`,
                        color: colors.textSecondary,
                    }}
                >
                    {text}
                </span>
            </div>
            <ChevronUp size={14} color={colors.violet500} style={{ marginTop: 2, flexShrink: 0 }} />
        </div>
    )
}
