// Onboarding do aluno (boas-vindas no primeiro login + hint de primeiro treino).
// Fonte de verdade: students.onboarding_state (migration 267), lida junto do
// perfil e escrita via RPC mark_student_onboarding (o aluno não tem self-UPDATE
// em students). MMKV é cache otimista local — evita flash entre boot e fetch e
// segura o "nunca reaparece" mesmo offline. Pattern espelha healthOnboardingFlag.
import { supabase } from './supabase';
import { logProductEvent } from './analytics';

export type StudentOnboardingKey = 'welcome_seen' | 'first_workout_hint_seen';

let getFlag: (key: string) => boolean;
let setFlag: (key: string) => void;

try {
  const { createMMKV } = require('react-native-mmkv');
  const mmkv = createMMKV({ id: 'kinevo-student-onboarding' });
  getFlag = (key: string) => mmkv.getBoolean(key) ?? false;
  setFlag = (key: string) => mmkv.set(key, true);
} catch {
  const mem = new Set<string>();
  getFlag = (key: string) => mem.has(key);
  setFlag = (key: string) => {
    mem.add(key);
  };
}

export function hasSeenStudentOnboardingLocally(key: StudentOnboardingKey): boolean {
  return getFlag(key);
}

// Reidrata o cache local a partir do estado vindo do banco (jsonb de students).
// Reinstalou o app → MMKV zera, mas o banco lembra — e nada reaparece.
export function seedStudentOnboardingFromServer(state: unknown): void {
  if (typeof state !== 'object' || state === null) return;
  const record = state as Record<string, unknown>;
  (['welcome_seen', 'first_workout_hint_seen'] as const).forEach((key) => {
    if (record[key] === true) setFlag(key);
  });
}

// Marca local + banco + evento de funil. Fire-and-forget: nunca bloqueia UI.
export function markStudentOnboarding(key: StudentOnboardingKey): void {
  if (getFlag(key)) return;
  setFlag(key);
  try {
    void supabase
      .rpc('mark_student_onboarding', { p_key: key })
      .then(({ error }) => {
        if (error) console.warn('[studentOnboarding]', key, error.message);
      });
  } catch {
    // MMKV já garante que não reaparece neste device; banco pega no próximo mark
  }
  logProductEvent(`student_${key}`);
}
