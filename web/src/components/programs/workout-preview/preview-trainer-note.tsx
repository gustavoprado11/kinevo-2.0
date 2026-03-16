import { MessageSquare } from 'lucide-react'
import { colors, spacing, typography } from './preview-design-tokens'

interface PreviewTrainerNoteProps {
    note: string
}

export function PreviewTrainerNote({ note }: PreviewTrainerNoteProps) {
    return (
        <div
            style={{
                backgroundColor: colors.trainerNoteBg,
                borderRadius: spacing.trainerNoteBorderRadius,
                padding: spacing.trainerNotePadding,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
                marginTop: spacing.trainerNoteMarginTop,
            }}
        >
            <MessageSquare size={14} color={colors.violet500} style={{ marginTop: 1, flexShrink: 0 }} />
            <span
                style={{
                    fontSize: typography.trainerNote.fontSize,
                    lineHeight: `${typography.trainerNote.lineHeight}px`,
                    color: colors.textSecondary,
                    flex: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }}
            >
                {note}
            </span>
        </div>
    )
}
