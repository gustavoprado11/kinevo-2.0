import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockShow = vi.fn();
const mockNotificationAsync = vi.fn();

vi.mock('react-native-toast-message', () => ({
    default: { show: (...args: unknown[]) => mockShow(...args) },
}));

vi.mock('expo-haptics', () => ({
    notificationAsync: (...args: unknown[]) => mockNotificationAsync(...args),
    NotificationFeedbackType: {
        Success: 'success',
        Error: 'error',
        Warning: 'warning',
    },
}));

import { toast } from '../toast';

describe('toast utility', () => {
    beforeEach(() => {
        mockShow.mockClear();
        mockNotificationAsync.mockClear();
    });

    describe('toast.success', () => {
        it('triggers success haptic feedback', () => {
            toast.success('Salvo!');
            expect(mockNotificationAsync).toHaveBeenCalledWith('success');
        });

        it('shows toast with type "success"', () => {
            toast.success('Salvo!', 'Programa criado');
            expect(mockShow).toHaveBeenCalledWith({
                type: 'success',
                text1: 'Salvo!',
                text2: 'Programa criado',
                visibilityTime: 3000,
            });
        });

        it('text2 is undefined when no message provided', () => {
            toast.success('Feito');
            expect(mockShow).toHaveBeenCalledWith(
                expect.objectContaining({ text2: undefined })
            );
        });
    });

    describe('toast.error', () => {
        it('triggers error haptic feedback', () => {
            toast.error('Erro!');
            expect(mockNotificationAsync).toHaveBeenCalledWith('error');
        });

        it('shows toast with type "error" and 4s visibility', () => {
            toast.error('Falha', 'Tente novamente');
            expect(mockShow).toHaveBeenCalledWith({
                type: 'error',
                text1: 'Falha',
                text2: 'Tente novamente',
                visibilityTime: 4000,
            });
        });
    });

    describe('toast.info', () => {
        it('does NOT trigger haptic feedback', () => {
            toast.info('Informação');
            expect(mockNotificationAsync).not.toHaveBeenCalled();
        });

        it('shows toast with type "info" and 3s visibility', () => {
            toast.info('Atualização', 'Nova versão disponível');
            expect(mockShow).toHaveBeenCalledWith({
                type: 'info',
                text1: 'Atualização',
                text2: 'Nova versão disponível',
                visibilityTime: 3000,
            });
        });
    });

    describe('visibility times', () => {
        it('success = 3s, error = 4s, info = 3s', () => {
            toast.success('a');
            toast.error('b');
            toast.info('c');

            const calls = mockShow.mock.calls;
            expect(calls[0][0].visibilityTime).toBe(3000);
            expect(calls[1][0].visibilityTime).toBe(4000);
            expect(calls[2][0].visibilityTime).toBe(3000);
        });
    });
});
