import { Upload } from 'lucide-react'
import { colors, spacing, typography } from './preview-design-tokens'
import type { PreviewQuestion } from './builder-to-preview'

interface PreviewFieldProps {
    question: PreviewQuestion
}

export function PreviewField({ question }: PreviewFieldProps) {
    if (question.type === 'short_text') {
        return (
            <div
                style={{
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: colors.inputBorder,
                    borderRadius: spacing.inputRadius,
                    padding: spacing.inputPadding,
                    backgroundColor: colors.inputBg,
                    minHeight: spacing.inputMinHeightShort,
                    marginTop: spacing.fieldMarginTop,
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <span style={{ color: colors.textPlaceholder, fontSize: typography.inputText.fontSize }}>
                    Ex: 80 kg
                </span>
            </div>
        )
    }

    if (question.type === 'long_text') {
        return (
            <div
                style={{
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: colors.inputBorder,
                    borderRadius: spacing.inputRadius,
                    padding: spacing.inputPadding,
                    backgroundColor: colors.inputBg,
                    minHeight: spacing.inputMinHeightLong,
                    marginTop: spacing.fieldMarginTop,
                }}
            >
                <span style={{ color: colors.textPlaceholder, fontSize: typography.inputText.fontSize }}>
                    Digite sua resposta...
                </span>
            </div>
        )
    }

    if (question.type === 'single_choice') {
        const mockSelectedIdx = question.options.length > 1 ? 1 : 0
        return (
            <div style={{ marginTop: spacing.fieldMarginTop, display: 'flex', flexDirection: 'column', gap: spacing.optionGap }}>
                {question.options.map((opt, idx) => {
                    const isSelected = idx === mockSelectedIdx
                    return (
                        <div
                            key={opt.value}
                            style={{
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor: isSelected ? colors.selectedBorder : colors.inputBorder,
                                backgroundColor: isSelected ? colors.selectedBg : colors.inputBg,
                                borderRadius: spacing.optionRadius,
                                padding: spacing.optionPadding,
                            }}
                        >
                            <span style={{ color: colors.textPrimary, fontSize: typography.optionText.fontSize }}>
                                {opt.label}
                            </span>
                        </div>
                    )
                })}
            </div>
        )
    }

    if (question.type === 'multi_choice') {
        const mockSelectedIdx = 0
        return (
            <div style={{ marginTop: spacing.fieldMarginTop, display: 'flex', flexDirection: 'column', gap: spacing.optionGap }}>
                {question.options.map((opt, idx) => {
                    const isSelected = idx === mockSelectedIdx
                    return (
                        <div
                            key={opt.value}
                            style={{
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor: isSelected ? colors.selectedBorder : colors.inputBorder,
                                backgroundColor: isSelected ? colors.selectedBg : colors.inputBg,
                                borderRadius: spacing.optionRadius,
                                padding: spacing.optionPadding,
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <div
                                style={{
                                    width: spacing.checkboxSize,
                                    height: spacing.checkboxSize,
                                    borderRadius: spacing.checkboxRadius,
                                    borderWidth: 1.5,
                                    borderStyle: 'solid',
                                    borderColor: isSelected ? colors.checkboxSelected : colors.checkboxBorder,
                                    backgroundColor: isSelected ? colors.checkboxSelected : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                {isSelected && (
                                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>
                                )}
                            </div>
                            <span style={{ color: colors.textPrimary, fontSize: typography.optionText.fontSize, flex: 1 }}>
                                {opt.label}
                            </span>
                        </div>
                    )
                })}
            </div>
        )
    }

    if (question.type === 'scale') {
        const values = Array.from(
            { length: question.scaleMax - question.scaleMin + 1 },
            (_, i) => question.scaleMin + i,
        )
        // Mock: select the second-to-last value for realism
        const mockSelected = values.length >= 2 ? values[values.length - 2] : values[0]
        return (
            <div style={{ marginTop: spacing.fieldMarginTop, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.scaleGap }}>
                {values.map((value) => {
                    const isSelected = value === mockSelected
                    return (
                        <div
                            key={value}
                            style={{
                                width: spacing.scaleSize,
                                height: spacing.scaleSize,
                                borderRadius: spacing.scaleRadius,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor: isSelected ? colors.selectedBorder : colors.inputBorder,
                                backgroundColor: isSelected ? colors.selectedBg : colors.inputBg,
                            }}
                        >
                            <span style={{ color: colors.textPrimary, fontWeight: typography.scaleNumber.fontWeight }}>
                                {value}
                            </span>
                        </div>
                    )
                })}
            </div>
        )
    }

    if (question.type === 'photo') {
        return (
            <div style={{ marginTop: spacing.fieldMarginTop }}>
                <div
                    style={{
                        backgroundColor: colors.photoBg,
                        borderRadius: spacing.photoRadius,
                        padding: spacing.photoPadding,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: colors.photoBorder,
                    }}
                >
                    <Upload size={16} color={colors.photoText} />
                    <span style={{ color: colors.photoText, fontWeight: typography.photoButtonText.fontWeight, fontSize: typography.photoButtonText.fontSize }}>
                        Selecionar foto
                    </span>
                </div>
            </div>
        )
    }

    return null
}
