/**
 * Design tokens extracted from mobile/app/inbox/[id].tsx.
 * Ensures pixel-perfect fidelity between web preview and mobile app.
 */

export const colors = {
    // Screen
    screenBg: '#F2F2F7',

    // Text
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    textTertiary: '#94a3b8',
    textPlaceholder: '#94a3b8',

    // Cards
    titleCardBg: '#ffffff',
    titleCardBorder: 'rgba(0, 0, 0, 0.04)',
    questionCardBg: 'rgba(255, 255, 255, 0.7)',
    questionCardBorder: 'rgba(255, 255, 255, 0.5)',

    // Inputs
    inputBorder: '#e2e8f0',
    inputBg: '#f8fafc',

    // Selection
    selectedBorder: '#7c3aed',
    selectedBg: '#f5f3ff',

    // Checkbox
    checkboxBorder: '#cbd5e1',
    checkboxSelected: '#7c3aed',

    // Photo upload
    photoBg: 'rgba(124, 58, 237, 0.05)',
    photoBorder: 'rgba(124, 58, 237, 0.1)',
    photoText: '#7c3aed',

    // Submit button
    submitGradientStart: 'rgba(139, 92, 246, 0.5)',
    submitGradientEnd: 'rgba(109, 40, 217, 0.5)',
    submitBg: 'rgba(124, 58, 237, 0.85)',
    submitBorder: 'rgba(255, 255, 255, 0.2)',

    // Header
    headerBg: '#F2F2F7',
    headerIcon: '#64748b',
} as const

export const typography = {
    headerTitle: { fontSize: 17, fontWeight: 700 },
    formTitle: { fontSize: 16, fontWeight: 800 },
    formSubtitle: { fontSize: 14 },
    questionLabel: { fontSize: 15, fontWeight: 700 },
    inputText: { fontSize: 14 },
    optionText: { fontSize: 14 },
    scaleNumber: { fontWeight: 700 },
    photoButtonText: { fontSize: 13, fontWeight: 600 },
    submitText: { fontSize: 16, fontWeight: 800, letterSpacing: 0.5 },
} as const

export const spacing = {
    // Screen
    scrollPaddingH: 20,
    scrollPaddingB: 30,

    // Header
    headerPaddingH: 20,
    headerPaddingTop: 12,
    headerPaddingBottom: 10,

    // Title card
    titleCardRadius: 20,
    titleCardPadding: 16,

    // Question card
    questionCardRadius: 20,
    questionCardPadding: 14,
    questionCardMarginBottom: 12,
    questionCardGap: 14,  // marginTop between title card and first question

    // Fields
    fieldMarginTop: 8,
    inputRadius: 10,
    inputPadding: 10,
    inputMinHeightShort: 44,
    inputMinHeightLong: 90,

    // Options
    optionGap: 8,
    optionRadius: 10,
    optionPadding: 10,

    // Checkbox
    checkboxSize: 20,
    checkboxRadius: 4,

    // Scale
    scaleSize: 36,
    scaleRadius: 18,
    scaleGap: 8,

    // Photo
    photoRadius: 12,
    photoPadding: 12,

    // Submit button
    submitRadius: 16,
    submitPaddingV: 16,
    submitMarginTop: 10,
} as const
