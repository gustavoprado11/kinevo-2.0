import { describe, it, expect } from 'vitest';

import {
    applyPreset,
    expandToSetScheme,
    inferMethodKeyFromScheme,
    summarizeSetScheme,
} from '@kinevo/shared/lib/prescription/set-scheme';
import { SYSTEM_PRESETS } from '@kinevo/shared/lib/prescription/set-scheme-presets';

// SetSchemeEditor é um componente RN. O workspace mobile não tem
// @testing-library configurado (jsdom only), então este teste exercita os
// caminhos de dados que o componente percorre internamente: expandir
// agregados → aplicar preset → editar → resumir → "voltar para modo simples".

describe('SetSchemeEditor data flow', () => {
    it('opens with expanded sets when no scheme exists', () => {
        const initial = expandToSetScheme(3, '10', 60);
        expect(initial).toHaveLength(3);
        expect(initial.every((s) => s.reps === '10' && s.rest_seconds === 60)).toBe(true);
    });

    it('falls back to defaults when aggregates are null (first-open default)', () => {
        const initial = expandToSetScheme(null, null, null);
        expect(initial).toHaveLength(3);
        expect(initial[0].reps).toBe('10');
    });

    it('applying a preset replaces the scheme and matches the system preset', () => {
        const start = expandToSetScheme(3, '10', 60);
        const next = applyPreset('pyramid_down');
        expect(next.map((s) => s.reps)).toEqual(['12', '10', '8', '6']);
        // Inferring back the key returns the same preset.
        expect(inferMethodKeyFromScheme(next)).toBe('pyramid_down');
        // The original was discarded.
        expect(next.length).not.toBe(start.length);
    });

    it('user edit demotes to custom but inferring still recognises full preset matches', () => {
        // Trainer applied a preset, then bumped the last rep up to 7 — clearly custom.
        const base = applyPreset('pyramid_down');
        const customized = base.map((s, i) =>
            i === base.length - 1 ? { ...s, reps: '7' } : s,
        );
        expect(inferMethodKeyFromScheme(customized)).toBe('custom');
    });

    it('exit advanced summary preserves the agg values for legacy reads', () => {
        const scheme = applyPreset('pyramid_down');
        const summary = summarizeSetScheme(scheme);
        expect(summary.sets).toBe(4);
        expect(summary.reps).toBe('12-10-8-6');
        expect(summary.rest_seconds).toBe(90); // min rest
    });

    it('every system preset roundtrips through inferMethodKeyFromScheme', () => {
        const keys = Object.keys(SYSTEM_PRESETS) as Array<keyof typeof SYSTEM_PRESETS>;
        keys.forEach((k) => {
            const scheme = applyPreset(k);
            expect(inferMethodKeyFromScheme(scheme)).toBe(k);
        });
    });
});
