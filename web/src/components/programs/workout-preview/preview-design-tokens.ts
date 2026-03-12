/**
 * Design tokens extracted from the mobile workout execution screen.
 * These ensure pixel-perfect fidelity between the web preview and the actual mobile app.
 */

// ── Colors ──────────────────────────────────────────────────────────────────
export const colors = {
    // Primary
    violet600: '#7c3aed',
    violet500: '#8b5cf6',

    // Text
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    textTertiary: '#94a3b8',
    textQuaternary: '#cbd5e1',

    // Backgrounds
    bgScreen: '#f8fafc',    // slate-50
    bgCard: 'rgba(255, 255, 255, 0.7)',
    bgCardBorder: 'rgba(255, 255, 255, 0.6)',
    bgInput: '#f5f5f7',
    bgInputCompleted: 'rgba(124, 58, 237, 0.08)',
    bgSetCompleted: 'rgba(124, 58, 237, 0.06)',
    bgSetBadge: '#f1f5f9',
    bgSetBadgeCompleted: 'rgba(124, 58, 237, 0.15)',
    bgCheckDefault: '#e8e8ed',
    bgCheckCompleted: '#7c3aed',
    bgCheckCircleBorder: '#c7c7cc',

    // Trainer Note
    trainerNoteBg: 'rgba(124, 58, 237, 0.08)',

    // Workout Note Card
    noteBg: 'rgba(124, 58, 237, 0.06)',
    noteBorder: 'rgba(124, 58, 237, 0.12)',

    // Superset
    supersetBorder: 'rgba(124, 58, 237, 0.25)',
    supersetBg: 'rgba(124, 58, 237, 0.03)',
    supersetDoneBorder: 'rgba(16, 185, 129, 0.3)',
    supersetDoneBg: 'rgba(16, 185, 129, 0.03)',
    supersetBadgeBg: 'rgba(124, 58, 237, 0.08)',
    supersetRoundBg: 'rgba(124, 58, 237, 0.1)',
    supersetConnector: 'rgba(124, 58, 237, 0.15)',
    supersetRestBg: 'rgba(124, 58, 237, 0.06)',
    emerald500: '#10b981',

    // Header
    headerBorder: '#e2e8f0',
    progressTrack: '#e2e8f0',
    progressFill: '#7c3aed',

    // Button
    btnFinishActive: '#7c3aed',
    btnFinishInactive: '#e2e8f0',

    // Action buttons
    actionBtnBg: 'rgba(124, 58, 237, 0.1)',

    // Section header
    sectionHeaderColor: 'rgba(0,0,0,0.40)',
} as const

// ── Typography ──────────────────────────────────────────────────────────────
export const typography = {
    workoutName: { fontSize: 17, fontWeight: 700 },
    timer: { fontSize: 13, fontFamily: 'ui-monospace, "SF Mono", monospace' },
    exerciseName: { fontSize: 15, fontWeight: 700 },
    exerciseMeta: { fontSize: 12 },
    columnHeader: { fontSize: 10, fontWeight: 600 },
    setNumber: { fontSize: 12, fontWeight: 600 },
    previousData: { fontSize: 12, fontWeight: 500 },
    inputText: { fontSize: 15, fontWeight: 600 },
    trainerNote: { fontSize: 14, lineHeight: 20 },
    noteCard: { fontSize: 14, lineHeight: 20 },
    sectionHeader: { fontSize: 11, fontWeight: 700, letterSpacing: 2 },
    supersetLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 1 },
    supersetRound: { fontSize: 11, fontWeight: 600 },
    supersetConnector: { fontSize: 10, fontWeight: 500 },
    supersetRest: { fontSize: 11, fontWeight: 500 },
    supersetBadge: { fontSize: 11, fontWeight: 500 },
    finishBtn: { fontSize: 16, fontWeight: 700 },
    progressCount: { fontSize: 11 },
    previousLoad: { fontSize: 12 },
    swapBadge: { fontSize: 11 },
} as const

// ── Spacing & Sizing ────────────────────────────────────────────────────────
export const spacing = {
    cardPadding: 12,
    cardMarginBottom: 12,
    cardBorderRadius: 16,   // rounded-2xl

    setRowPaddingV: 5,
    setRowPaddingH: 4,
    setRowBorderRadius: 10,
    setRowMarginBottom: 4,

    setBadgeSize: 26,
    previousColWidth: 58,
    inputHeight: 38,
    inputBorderRadius: 10,
    checkBtnSize: 40,
    checkIconSize: 18,

    supersetPadding: 12,
    supersetBorderRadius: 20,
    supersetBorderWidth: 1.5,

    notePadding: 14,
    noteBorderRadius: 16,
    noteMarginBottom: 12,

    trainerNotePadding: 12,
    trainerNoteBorderRadius: 12,
    trainerNoteMarginTop: 8,

    headerPaddingH: 20,
    headerPaddingTop: 16,
    headerPaddingBottom: 12,
    progressHeight: 3,

    sectionHeaderMarginTop: 20,
    sectionHeaderMarginBottom: 8,

    finishBtnHeight: 52,
    finishBtnRadius: 16,
    footerPaddingH: 20,
    footerPaddingTop: 12,
    footerPaddingBottom: 16,

    actionBtnPadding: 8,
    actionBtnRadius: 20,
} as const

// ── Section function labels (must match mobile) ─────────────────────────────
export const FUNCTION_LABELS: Record<string, string> = {
    warmup: 'AQUECIMENTO',
    activation: 'ATIVAÇÃO',
    main: 'PRINCIPAL',
    accessory: 'ACESSÓRIO',
    conditioning: 'CONDICIONAMENTO',
}
