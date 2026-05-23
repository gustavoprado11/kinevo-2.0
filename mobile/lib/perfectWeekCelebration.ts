// Guard "1x por semana" pro momento comemorativo de Semana Perfeita.
// Guarda só a última weekKey comemorada (basta — só interessa a semana atual).
let store: any;
function mmkv() {
    if (!store) {
        const { createMMKV } = require('react-native-mmkv');
        store = createMMKV({ id: 'kinevo-perfect-week' });
    }
    return store;
}

const KEY = 'celebrated_week';

export function wasPerfectWeekCelebrated(weekKey: string): boolean {
    try {
        return mmkv().getString(KEY) === weekKey;
    } catch {
        return false;
    }
}

export function markPerfectWeekCelebrated(weekKey: string): void {
    try {
        mmkv().set(KEY, weekKey);
    } catch {
        // best-effort — pior caso, a folha aparece de novo na próxima abertura
    }
}
