/**
 * Global Z-Index Design Tokens
 *
 * Semantic stacking layers for the entire application.
 * Use these constants for inline `zIndex` styles.
 * For Tailwind classes, use: z-sticky, z-header, z-sidebar, z-dropdown, etc.
 * (registered in globals.css via @theme)
 *
 * Layer hierarchy (lowest → highest):
 *
 *   CONTENT (0)     — default flow
 *   RAISED (1)      — grain overlays, slight elevation within a card
 *   STICKY (10)     — sticky headers within scroll containers, relative positioning
 *   HEADER (20)     — app header bar, volume summary bar
 *   SIDEBAR (30)    — sidebar navigation, fixed bottom bars
 *   DROPDOWN (40)   — dropdowns, popovers, rest timer, menus
 *   BACKDROP (45)   — modal backdrops, overlay scrims
 *   MODAL (50)      — modal dialogs, sheets, fixed overlays
 *   FLOAT (60)      — floating widgets, image zoom, video player
 *   ONBOARDING (70) — onboarding overlays, spotlight, welcome modal
 *   TOOLTIP (100)   — tooltips, info popovers
 *   TOPMOST (110)   — highest priority (e.g. nested modal over modal)
 */
export const Z = {
  CONTENT: 0,
  RAISED: 1,
  STICKY: 10,
  HEADER: 20,
  SIDEBAR: 30,
  DROPDOWN: 40,
  BACKDROP: 45,
  MODAL: 50,
  FLOAT: 60,
  ONBOARDING: 70,
  TOOLTIP: 100,
  TOPMOST: 110,
} as const

export type ZLayer = (typeof Z)[keyof typeof Z]
