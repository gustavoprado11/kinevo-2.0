/**
 * useV2Colors — devolve a paleta v2 ajustada à preferência do usuário.
 *
 * Modos suportados:
 *  - 'system' (default): segue useColorScheme() do iOS/Android.
 *  - 'light': força paleta light.
 *  - 'dark':  força paleta dark.
 *
 * Preferência persistida via themePreferenceStore (MMKV).
 *
 * Surface/text/border alternam; brand/semantic/neutral mantêm valores
 * (cores de identidade independem de modo).
 */
import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { v2 } from "@kinevo/shared/tokens";
import { useThemePreferenceStore, type ThemeMode } from "../stores/themePreferenceStore";

const { colors, colorsDark } = v2;

export type V2Palette = typeof colors;

function pickPalette(mode: ThemeMode, systemScheme: ReturnType<typeof useColorScheme>): V2Palette {
    const effective: 'light' | 'dark' =
        mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
    return effective === 'dark' ? (colorsDark as unknown as V2Palette) : colors;
}

export function useV2Colors(): V2Palette {
    const mode = useThemePreferenceStore((s) => s.mode);
    const systemScheme = useColorScheme();
    return useMemo(() => pickPalette(mode, systemScheme), [mode, systemScheme]);
}

export function useIsDark(): boolean {
    const mode = useThemePreferenceStore((s) => s.mode);
    const systemScheme = useColorScheme();
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return systemScheme === 'dark';
}
