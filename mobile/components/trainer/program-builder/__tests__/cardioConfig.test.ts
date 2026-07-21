import { describe, it, expect } from 'vitest';
import {
    buildCardioConfig,
    formatCardioPreview,
    parseCardioConfig,
} from '../cardio-config';

// ── parseCardioConfig ──

describe('parseCardioConfig', () => {
    it('lê o schema canônico (web): contínuo por tempo', () => {
        const p = parseCardioConfig({
            mode: 'continuous',
            equipment: 'treadmill',
            objective: 'time',
            duration_minutes: 20,
            intensity: 'Zona 2',
            notes: 'Inclinação 5%',
        });
        expect(p).toEqual({
            isInterval: false,
            isPhased: false,
            equipment: 'treadmill',
            objective: 'time',
            target: 20,
            intensity: 'Zona 2',
            notes: 'Inclinação 5%',
        });
    });

    it('lê o schema canônico: contínuo por distância', () => {
        const p = parseCardioConfig({ mode: 'continuous', objective: 'distance', distance_km: 5 });
        expect(p.objective).toBe('distance');
        expect(p.target).toBe(5);
    });

    it('lê o legado mobile (modality/target) e mapeia modalidade conhecida pro enum', () => {
        const p = parseCardioConfig({
            mode: 'continuous',
            modality: 'Esteira',
            objective: 'time',
            target: 20,
            notes: 'FC 130',
        });
        expect(p.equipment).toBe('treadmill');
        expect(p.target).toBe(20);
        expect(p.notes).toBe('FC 130');
    });

    it('modalidade legada desconhecida → equipment null (não inventa)', () => {
        const p = parseCardioConfig({ modality: 'Circuito funcional', target: 15 });
        expect(p.equipment).toBeNull();
        expect(p.target).toBe(15);
    });

    it('detecta protocolo intervalado', () => {
        const p = parseCardioConfig({
            mode: 'interval',
            equipment: 'bike',
            intervals: { work_seconds: 30, rest_seconds: 30, rounds: 10 },
        });
        expect(p.isInterval).toBe(true);
        expect(p.equipment).toBe('bike');
    });

    it('detecta modo por fases (só com segments válidos)', () => {
        const p = parseCardioConfig({
            mode: 'phased',
            segments: [{ kind: 'steady', duration_minutes: 10 }],
        });
        expect(p.isPhased).toBe(true);
        // 'phased' sem segments não é tratado como phased
        expect(parseCardioConfig({ mode: 'phased' }).isPhased).toBe(false);
        expect(parseCardioConfig({ mode: 'phased', segments: [] }).isPhased).toBe(false);
    });
});

// ── buildCardioConfig ──

describe('buildCardioConfig', () => {
    const edits = {
        equipment: 'treadmill' as const,
        objective: 'time' as const,
        target: 25,
        intensity: 'Zona 2',
        notes: '',
    };

    it('grava o schema canônico e migra/strippa o legado mobile', () => {
        const out = buildCardioConfig(
            { mode: 'continuous', modality: 'Esteira', target: 20, objective: 'time' },
            edits,
        );
        expect(out).toEqual({
            mode: 'continuous',
            equipment: 'treadmill',
            objective: 'time',
            duration_minutes: 25,
            intensity: 'Zona 2',
        });
        expect(out).not.toHaveProperty('modality');
        expect(out).not.toHaveProperty('target');
    });

    it('PRESERVA protocolo intervalado do web (mode/intervals/duração intocados)', () => {
        // Bug C3: o save antigo substituía o item_config inteiro e destruía
        // intervals/equipment/duration de um cardio criado no web.
        const webConfig = {
            mode: 'interval',
            equipment: 'bike',
            intervals: { work_seconds: 30, rest_seconds: 30, rounds: 10 },
            duration_minutes: 10,
        };
        const out = buildCardioConfig(webConfig, {
            equipment: 'rower',
            objective: 'time',
            target: 99,          // ignorado em modo intervalado
            intensity: 'RPE 8',
            notes: 'nota nova',
        });
        expect(out.mode).toBe('interval');
        expect(out.intervals).toEqual({ work_seconds: 30, rest_seconds: 30, rounds: 10 });
        expect(out.duration_minutes).toBe(10);
        expect(out.equipment).toBe('rower');
        expect(out.intensity).toBe('RPE 8');
        expect(out.notes).toBe('nota nova');
    });

    it('PRESERVA treino por fases do web (mode/segments/derivados intocados)', () => {
        const webConfig = {
            mode: 'phased',
            equipment: 'treadmill',
            segments: [
                { kind: 'steady', duration_minutes: 10, intensity: 'Zona 1' },
                { kind: 'interval', intervals: { work_seconds: 20, rest_seconds: 10, rounds: 8 }, intensity: 'RPE 9' },
            ],
            duration_minutes: 14,          // derivado (total)
            intensity: '10min Zona 1 → 8× 20/10 RPE 9', // derivado (resumo)
        };
        const out = buildCardioConfig(webConfig, {
            equipment: 'bike',
            objective: 'time',
            target: 99,          // ignorado em modo phased
            intensity: 'tentou sobrescrever', // ignorado: derivada dos segments
            notes: 'nota nova',
        });
        expect(out.mode).toBe('phased');
        expect(out.segments).toEqual(webConfig.segments);
        expect(out.duration_minutes).toBe(14);
        expect(out.intensity).toBe('10min Zona 1 → 8× 20/10 RPE 9');
        expect(out.equipment).toBe('bike');
        expect(out.notes).toBe('nota nova');
    });

    it('trocar objetivo tempo→distância limpa duration_minutes', () => {
        const out = buildCardioConfig(
            { mode: 'continuous', objective: 'time', duration_minutes: 20 },
            { ...edits, objective: 'distance', target: 5 },
        );
        expect(out.distance_km).toBe(5);
        expect(out).not.toHaveProperty('duration_minutes');
    });

    it('campos opcionais vazios são removidos, não gravados como ""', () => {
        const out = buildCardioConfig({}, {
            equipment: null,
            objective: 'time',
            target: null,
            intensity: '  ',
            notes: '',
        });
        expect(out).toEqual({ mode: 'continuous', objective: 'time' });
    });
});

// ── formatCardioPreview ──

describe('formatCardioPreview', () => {
    it('canônico: equipamento + duração + intensidade', () => {
        expect(formatCardioPreview({
            mode: 'continuous', equipment: 'treadmill', objective: 'time',
            duration_minutes: 20, intensity: 'Zona 2',
        })).toBe('Esteira · 20min · Zona 2');
    });

    it('canônico: distância', () => {
        expect(formatCardioPreview({
            mode: 'continuous', equipment: 'outdoor_run', objective: 'distance', distance_km: 5,
        })).toBe('Corrida Outdoor · 5km');
    });

    it('intervalado: resumo do protocolo', () => {
        expect(formatCardioPreview({
            mode: 'interval', equipment: 'bike',
            intervals: { work_seconds: 30, rest_seconds: 30, rounds: 10 },
        })).toBe('Bicicleta · 10× 30s/30s');
    });

    it('legado mobile continua legível', () => {
        expect(formatCardioPreview({
            mode: 'continuous', modality: 'Esteira', objective: 'time', target: 20,
        })).toBe('Esteira · 20min');
    });

    it('legado com modalidade desconhecida mostra o texto livre', () => {
        expect(formatCardioPreview({ modality: 'Circuito', target: 15 })).toBe('Circuito · 15min');
    });

    it('por fases: contagem + total derivado', () => {
        expect(formatCardioPreview({
            mode: 'phased', equipment: 'treadmill',
            segments: [{ kind: 'steady' }, { kind: 'interval' }, { kind: 'steady' }],
            duration_minutes: 23,
        })).toBe('Esteira · 3 fases · 23min');
    });

    it('vazio → "Cardio livre"', () => {
        expect(formatCardioPreview({})).toBe('Cardio livre');
        expect(formatCardioPreview(null)).toBe('Cardio livre');
    });
});
