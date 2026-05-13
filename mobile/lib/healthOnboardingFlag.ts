// Fase 14a — Flag de "onboarding visto pelo aluno".
// Pattern espelha themePreferenceStore: MMKV com fallback in-memory pra Expo Go.

let getFlag: () => boolean;
let setFlag: (value: boolean) => void;

try {
  const { createMMKV } = require('react-native-mmkv');
  const mmkv = createMMKV({ id: 'kinevo-health-onboarding' });
  getFlag = () => mmkv.getBoolean('seen-v1') ?? false;
  setFlag = (value: boolean) => mmkv.set('seen-v1', value);
} catch {
  let memVal = false;
  getFlag = () => memVal;
  setFlag = (value: boolean) => { memVal = value; };
}

export function hasSeenHealthOnboarding(): boolean {
  return getFlag();
}

export function markHealthOnboardingSeen(): void {
  setFlag(true);
}
