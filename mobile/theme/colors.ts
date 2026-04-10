export const colors = {
  background: {
    primary: "#F2F2F7",
    card: "#FFFFFF",
    elevated: "#FFFFFF",
    inset: "#E5E7EB",
  },
  text: {
    primary: "#0f172a",
    secondary: "#64748b",
    tertiary: "#94a3b8",
    quaternary: "#cbd5e1",
    inverse: "#FFFFFF",
  },
  brand: {
    primary: "#7c3aed",
    primaryLight: "#ede9fe",
    primaryDark: "#6d28d9",
  },
  success: {
    default: "#16a34a",
    light: "#f0fdf4",
  },
  warning: {
    default: "#f59e0b",
    light: "#fffbeb",
  },
  error: {
    default: "#ef4444",
    light: "#fef2f2",
  },
  info: {
    default: "#3b82f6",
    light: "#eff6ff",
  },
  border: {
    primary: "rgba(0,0,0,0.04)",
    secondary: "rgba(0,0,0,0.08)",
    focused: "#7c3aed",
  },
  status: {
    active: "#16a34a",
    activeBg: "#f0fdf4",
    inactive: "#94a3b8",
    inactiveBg: "#f1f5f9",
    pending: "#f59e0b",
    pendingBg: "#fffbeb",
    online: "#3b82f6",
    onlineBg: "#eff6ff",
    presencial: "#8b5cf6",
    presencialBg: "#f5f3ff",
  },
} as const;

export type Colors = typeof colors;
