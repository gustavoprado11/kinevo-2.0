import { useColorScheme } from "react-native";

// Famílias Plus Jakarta Sans já carregadas no root layout (app/_layout.tsx).
export const FONT = {
    medium: "MonaSans_500Medium",
    semibold: "MonaSans_600SemiBold",
    bold: "MonaSans_700Bold",
    extrabold: "MonaSans_800ExtraBold",
} as const;

export type AuthScheme = "light" | "dark";

export interface AuthTheme {
    scheme: AuthScheme;
    surface: string;
    sheetSurface: string;
    fgPrimary: string;
    fgSecondary: string;
    fgTertiary: string;
    fieldBg: string;
    fieldBorder: string;
    fieldBorderFocus: string;
    /** CTA neutra (não violeta) — o maior delta visual da spec §2.1. */
    ctaBg: string;
    ctaFg: string;
    /** O único momento de marca por tela: palavra de acento, eyebrow da sheet, outline selecionado. */
    brand: string;
    brandSoft: string;
    brandBorder: string;
    blob: string;
    progressInactive: string;
    progressActive: string;
    backdrop: string;
    handle: string;
}

const dark: AuthTheme = {
    scheme: "dark",
    surface: "#0B0B0F",
    sheetSurface: "#1C1C1E",
    fgPrimary: "#FFFFFF",
    fgSecondary: "rgba(255,255,255,0.62)",
    fgTertiary: "rgba(255,255,255,0.42)",
    fieldBg: "rgba(255,255,255,0.04)",
    fieldBorder: "rgba(255,255,255,0.10)",
    fieldBorderFocus: "#FFFFFF",
    ctaBg: "#FFFFFF",
    ctaFg: "#09090B",
    brand: "#A78BFA",
    brandSoft: "rgba(124,58,237,0.12)",
    brandBorder: "rgba(139,92,246,0.9)",
    blob: "rgba(124,58,237,0.30)",
    progressInactive: "rgba(255,255,255,0.10)",
    progressActive: "#A78BFA",
    backdrop: "rgba(0,0,0,0.40)",
    handle: "rgba(255,255,255,0.30)",
};

const light: AuthTheme = {
    scheme: "light",
    surface: "#FFFFFF",
    sheetSurface: "#FFFFFF",
    fgPrimary: "#09090B",
    fgSecondary: "rgba(0,0,0,0.62)",
    fgTertiary: "rgba(0,0,0,0.42)",
    fieldBg: "rgba(0,0,0,0.04)",
    fieldBorder: "rgba(0,0,0,0.10)",
    fieldBorderFocus: "#09090B",
    ctaBg: "#09090B",
    ctaFg: "#FFFFFF",
    brand: "#6D28D9",
    brandSoft: "rgba(124,58,237,0.06)",
    brandBorder: "rgba(124,58,237,0.9)",
    blob: "rgba(124,58,237,0.30)",
    progressInactive: "rgba(0,0,0,0.10)",
    progressActive: "#6D28D9",
    backdrop: "rgba(0,0,0,0.40)",
    handle: "rgba(0,0,0,0.20)",
};

export function useAuthTheme(): AuthTheme {
    const scheme = useColorScheme();
    return scheme === "light" ? light : dark;
}
