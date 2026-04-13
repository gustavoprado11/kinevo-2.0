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

const ExpoSecureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        try {
            return await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
        } catch {
            // Fallback: try without options (reads items stored with old accessibility)
            try {
                return await SecureStore.getItemAsync(key);
            } catch {
                return null;
            }
        }
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

// Debug solicitado para diagnóstico (somente em dev)
if (__DEV__) {
    console.log('Supabase Config:', supabaseUrl ? 'URL Found' : 'URL Missing');
    console.log('Supabase Key:', supabaseAnonKey ? 'Key Found' : 'Key Missing');
}

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
