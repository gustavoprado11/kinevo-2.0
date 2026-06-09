import "react-native-url-polyfill/auto";

import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@kinevo/shared";

// ─────────────────────────────────────────────────────────────────────────────
// SecureStore Adapter para persistência segura de sessão
// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Use AFTER_FIRST_UNLOCK so the keychain is accessible when the app
// is launched in the background (e.g., after a Watch workout completes).
// The default (WHEN_UNLOCKED) fails with "User interaction is not allowed"
// if the device is locked or the app hasn't been foregrounded yet.
// ─────────────────────────────────────────────────────────────────────────────

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const ExpoSecureStoreAdapter = {
    // CRITICAL (auth restore on cold start): a missing key resolves to `null` WITHOUT
    // throwing, while a keychain *access* failure (e.g. "User interaction is not allowed"
    // right after launch, before the keychain is ready) THROWS. The old code swallowed
    // both as `null`, so a transient read failure looked like "no session" and logged
    // the user out — they reopened the app and it was logged in again (keychain ready by
    // then). We now retry the read a few times (the keychain becomes ready within a few
    // hundred ms) so the persisted session is found on the first launch.
    getItem: async (key: string): Promise<string | null> => {
        const maxAttempts = 5;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
            } catch (errWithOptions) {
                // Items stored with old accessibility — retry once without options.
                try {
                    return await SecureStore.getItemAsync(key);
                } catch (errPlain) {
                    if (attempt < maxAttempts - 1) {
                        // Keychain not ready yet — wait briefly and retry instead of
                        // returning null (which would spuriously log the user out).
                        await sleep(150 * (attempt + 1));
                        continue;
                    }
                    // Exhausted retries — last resort. Surfacing null here keeps the
                    // previous behaviour for genuinely unreadable keychains.
                    if (__DEV__) console.warn(`[Supabase] SecureStore read failed for "${key}" after ${maxAttempts} attempts`);
                    return null;
                }
            }
        }
        return null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
        await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
    },
    removeItem: async (key: string): Promise<void> => {
        await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Client (tipado com Database)
// ─────────────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;


if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        "[Supabase] ERRO: Variáveis de ambiente não configuradas. Verifique se o arquivo .env existe na raiz da pasta mobile e se as variáveis começam com EXPO_PUBLIC_"
    );
}

export const supabase = createClient<Database>(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-key",
    {
        auth: {
            storage: ExpoSecureStoreAdapter,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    }
);
