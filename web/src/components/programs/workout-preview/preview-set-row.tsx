import { colors, spacing, typography } from './preview-design-tokens'
import { Check } from 'lucide-react'

interface PreviewSetRowProps {
    index: number
}

export function PreviewSetRow({ index }: PreviewSetRowProps) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                paddingTop: spacing.setRowPaddingV,
                paddingBottom: spacing.setRowPaddingV,
                paddingLeft: spacing.setRowPaddingH,
                paddingRight: spacing.setRowPaddingH,
                borderRadius: spacing.setRowBorderRadius,
                marginBottom: spacing.setRowMarginBottom,
            }}
        >
            {/* Set Number Badge */}
            <div
                style={{
                    width: spacing.setBadgeSize,
                    height: spacing.setBadgeSize,
                    borderRadius: spacing.setBadgeSize / 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 6,
                    backgroundColor: colors.bgSetBadge,
                }}
            >
                <span style={{ fontSize: typography.setNumber.fontSize, fontWeight: typography.setNumber.fontWeight, color: colors.textSecondary }}>
                    {index + 1}
                </span>
            </div>

            {/* Previous Data */}
            <div style={{ width: spacing.previousColWidth, textAlign: 'center', marginRight: 6 }}>
                <span style={{ fontSize: typography.previousData.fontSize, fontWeight: typography.previousData.fontWeight, color: colors.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                    —
                </span>
            </div>

            {/* Weight Input */}
            <div
                style={{
                    flex: 1,
                    height: spacing.inputHeight,
                    backgroundColor: colors.bgInput,
                    borderRadius: spacing.inputBorderRadius,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 6,
                }}
            >
                <span style={{ fontSize: typography.inputText.fontSize, fontWeight: typography.inputText.fontWeight, color: colors.textQuaternary }}>
                    kg
                </span>
            </div>

            {/* Reps Input */}
            <div
                style={{
                    flex: 1,
                    height: spacing.inputHeight,
                    backgroundColor: colors.bgInput,
                    borderRadius: spacing.inputBorderRadius,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 6,
                }}
            >
                <span style={{ fontSize: typography.inputText.fontSize, fontWeight: typography.inputText.fontWeight, color: colors.textQuaternary }}>
                    &nbsp;
                </span>
            </div>

            {/* Check Button */}
            <div
                style={{
                    width: spacing.checkBtnSize,
                    height: spacing.checkBtnSize,
                    borderRadius: spacing.checkBtnSize / 2,
                    backgroundColor: colors.bgCheckDefault,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div
                    style={{
                        width: spacing.checkIconSize,
                        height: spacing.checkIconSize,
                        borderRadius: spacing.checkIconSize / 2,
                        border: `2px solid ${colors.bgCheckCircleBorder}`,
                    }}
                />
            </div>
        </div>
    )
}
