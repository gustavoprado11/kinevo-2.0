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
import { useBrandStore } from "../stores/brandStore";
import { deriveBrandScale } from "../lib/brandColor";

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
    const brand = useBrandStore((s) => s.brand);
    return useMemo(() => {
        const base = pickPalette(mode, systemScheme);
        // Quando o coach do aluno tem marca custom, sobrescrevemos os tokens
        // brand.* — componentes que usam `colors.brand.primary` ganham marca
        // automaticamente (AchievementCard, sidebar, trainer-mode quando dual-role,
        // etc.). Brand default Kinevo → palette base intacta (zero impacto).
        if (!brand.isCustom) return base;
        // Reescala a paleta `purple` inteira a partir da marca custom, pra
        // que TODOS os componentes que consomem `colors.purple[N]` pintem na
        // marca automaticamente (~80 ocorrências em ~15 arquivos do trainer
        // + componentes v2 compartilhados). Sem isso, só os componentes que
        // usam `colors.brand.*` reagem ao branding — surfaces como dashboard
        // trainer, KButton, KCard, program-builder ficam roxas mesmo com
        // marca trocada. Os tons claros (100/200) mantêm leveza, os escuros
        // (700–950) mantêm profundidade, via mix com white/black.
        const purple = deriveBrandScale(brand.color);
        return {
            ...base,
            purple,
            brand: {
                primary: brand.color,
                primaryLight: purple[100],
                primaryDark: brand.dark,
            },
        } as unknown as V2Palette;
    }, [mode, systemScheme, brand]);
}

export function useIsDark(): boolean {
    const mode = useThemePreferenceStore((s) => s.mode);
    const systemScheme = useColorScheme();
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return systemScheme === 'dark';
}
