import { describe, it, expect } from 'vitest';
import { normalizeForSearch, matchesSearch } from '../search-text';

describe('normalizeForSearch', () => {
    it('remove acentos e baixa a caixa', () => {
        expect(normalizeForSearch('Léo')).toBe('leo');
        expect(normalizeForSearch('Búlgaro')).toBe('bulgaro');
        expect(normalizeForSearch('Agachamento Áÿü')).toBe('agachamento ayu');
        expect(normalizeForSearch('Inclinação')).toBe('inclinacao');
    });

    it('trata null/undefined/vazio', () => {
        expect(normalizeForSearch(null)).toBe('');
        expect(normalizeForSearch(undefined)).toBe('');
        expect(normalizeForSearch('  ')).toBe('');
    });
});

describe('matchesSearch', () => {
    it('casa ignorando acento e caixa em ambos os lados', () => {
        expect(matchesSearch('Léo', 'leo')).toBe(true);
        expect(matchesSearch('Leo', 'léo')).toBe(true);
        expect(matchesSearch('Supino Inclinado', 'inclinado')).toBe(true);
        expect(matchesSearch('Agachamento Búlgaro', 'bulgaro')).toBe(true);
    });

    it('query vazia casa com tudo', () => {
        expect(matchesSearch('qualquer', '')).toBe(true);
        expect(matchesSearch('qualquer', null)).toBe(true);
    });

    it('não casa quando não é substring', () => {
        expect(matchesSearch('Léo', 'ana')).toBe(false);
        expect(matchesSearch(null, 'leo')).toBe(false);
    });
});
