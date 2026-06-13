// Minimal .env.local parser — reads web/.env.local without extra deps.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const WEB_DIR = resolve(__dirname, "../../../web");

export function loadEnv() {
  const raw = readFileSync(resolve(WEB_DIR, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

// supabase-js lives in the monorepo root node_modules
export const SUPABASE_JS = resolve(WEB_DIR, "../node_modules/@supabase/supabase-js/dist/index.mjs");
