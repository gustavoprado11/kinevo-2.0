import { describe, it, expect } from 'vitest';
import { formatBRL, parseBRL } from '../currency';

describe('formatBRL', () => {
    it('formata com separador de milhar e vírgula decimal', () => {
        expect(formatBRL(1234.56)).toBe('R$ 1.234,56');
        expect(formatBRL(1500000)).toBe('R$ 1.500.000,00');
    });

    it('formata valores pequenos e zero', () => {
        expect(formatBRL(0)).toBe('R$ 0,00');
        expect(formatBRL(9.9)).toBe('R$ 9,90');
        expect(formatBRL(999)).toBe('R$ 999,00');
    });

    it('preserva o sinal de negativos', () => {
        expect(formatBRL(-1234.5)).toBe('-R$ 1.234,50');
    });

    it('NaN/Infinity viram R$ 0,00 em vez de quebrar a UI', () => {
        expect(formatBRL(NaN)).toBe('R$ 0,00');
        expect(formatBRL(Infinity)).toBe('R$ 0,00');
    });

    it('arredonda para 2 casas', () => {
        expect(formatBRL(10.005)).toBe('R$ 10,01');
        expect(formatBRL(79.9)).toBe('R$ 79,90');
    });
});

describe('parseBRL', () => {
    it('aceita formato pt-BR completo', () => {
        expect(parseBRL('R$ 1.234,56')).toBe(1234.56);
        expect(parseBRL('1.500,00')).toBe(1500);
    });

    it('aceita número puro e vírgula decimal', () => {
        expect(parseBRL('1500')).toBe(1500);
        expect(parseBRL('79,90')).toBe(79.9);
    });

    it('inválido vira 0', () => {
        expect(parseBRL('')).toBe(0);
        expect(parseBRL('abc')).toBe(0);
    });

    it('round-trip com formatBRL', () => {
        expect(parseBRL(formatBRL(1234.56))).toBe(1234.56);
    });
});
