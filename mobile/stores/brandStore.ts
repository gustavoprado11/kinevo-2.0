// Marca do estúdio — store global (Zustand) hidratado por MMKV.
// O Home seta a marca a partir do coach (profile.coach); demais telas
// consomem via useBrand(). O cache MMKV permite aplicar a marca instantânea
// no próximo boot (ex.: splash) antes mesmo do perfil carregar.
import { create } from 'zustand';
import { KINEVO_BRAND, resolveBrand, type Brand, type CoachBrandFields } from '../lib/brandColor';

let store: any;
function mmkv() {
    if (!store) {
        const { createMMKV } = require('react-native-mmkv');
        store = createMMKV({ id: 'kinevo-brand' });
    }
    return store;
}

const KEY = 'coach_brand_v1';

function readCache(): Brand | null {
    try {
        const raw = mmkv().getString(KEY);
        return raw ? (JSON.parse(raw) as Brand) : null;
    } catch {
        return null;
    }
}

function writeCache(brand: Brand): void {
    try {
        mmkv().set(KEY, JSON.stringify(brand));
    } catch {
        // best-effort (Expo Go sem MMKV) — cai no fallback Kinevo
    }
}

interface BrandState {
    brand: Brand;
    /** Resolve e persiste a marca a partir do coach do aluno. */
    setBrandFromCoach: (coach: CoachBrandFields | null | undefined) => void;
}

export const useBrandStore = create<BrandState>((set) => ({
    brand: readCache() ?? KINEVO_BRAND,
    setBrandFromCoach: (coach) => {
        const next = resolveBrand(coach);
        writeCache(next);
        set({ brand: next });
    },
}));

/** Hook de leitura da marca atual (re-renderiza ao trocar). */
export const useBrand = (): Brand => useBrandStore((s) => s.brand);
