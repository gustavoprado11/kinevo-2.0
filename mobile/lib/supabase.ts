import "react-native-url-polyfill/auto";

import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@kinevo/shared";

// ─────────────────────────────────────────────────────────────────────────────
// SecureStore Adapter para persistência segura de sessão
// ─────────────────────────────────────────────────────────────────────────────

const ExpoSecureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        return await SecureStore.getItemAsync(key);
    },
    setItem: async (key: string, value: string): Promise<void> => {
        await SecureStore.setItemAsync(key, value);
    },
    removeItem: async (key: string): Promise<void> => {
        await SecureStore.deleteItemAsync(key);
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Client (tipado com Database)
// ─────────────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Debug solicitado para diagnóstico
console.log('Supabase Config:', supabaseUrl ? 'URL Found' : 'URL Missing');
console.log('Supabase Key:', supabaseAnonKey ? 'Key Found' : 'Key Missing');

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
