/**
 * MMKV-backed map of `recurringAppointmentId → notificationId[]`.
 *
 * Each rule may schedule N local pushes (one per upcoming occurrence, capped
 * at 12). When the rule is cancelled or rescheduled, we read the stored ids
 * and call `Notifications.cancelScheduledNotificationAsync` for each.
 */

interface MMKVStore {
    getString: (key: string) => string | undefined;
    set: (key: string, value: string) => void;
    delete: (key: string) => void;
    getAllKeys: () => string[];
}

let store: MMKVStore | null = null;
try {
    const { createMMKV } = require("react-native-mmkv");
    store = createMMKV({ id: "kinevo-appointment-reminders" }) as MMKVStore;
} catch {
    // Expo Go fallback — silent no-op.
}

const KEY_PREFIX = "rule:";

function keyFor(ruleId: string): string {
    return `${KEY_PREFIX}${ruleId}`;
}

export function getReminderIds(ruleId: string): string[] {
    try {
        const raw = store?.getString(keyFor(ruleId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
    } catch {
        return [];
    }
}

export function setReminderIds(ruleId: string, ids: string[]): void {
    try {
        if (ids.length === 0) {
            store?.delete(keyFor(ruleId));
            return;
        }
        store?.set(keyFor(ruleId), JSON.stringify(ids));
    } catch {
        // silent
    }
}

export function clearReminderIds(ruleId: string): void {
    try {
        store?.delete(keyFor(ruleId));
    } catch {
        // silent
    }
}

export function getAllRuleIds(): string[] {
    try {
        const all = store?.getAllKeys() ?? [];
        return all
            .filter((k) => k.startsWith(KEY_PREFIX))
            .map((k) => k.slice(KEY_PREFIX.length));
    } catch {
        return [];
    }
}
