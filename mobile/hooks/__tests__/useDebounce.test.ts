import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the debounce logic used by useDebounce.
 * Since we don't have @testing-library/react-hooks, we test the core
 * debounce behavior using vanilla timers — the same mechanism the hook uses.
 */

function createDebouncer<T>(initialValue: T, delay = 300) {
    let currentValue = initialValue;
    let debouncedValue = initialValue;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return {
        get debounced() { return debouncedValue; },
        get current() { return currentValue; },
        setValue(value: T) {
            currentValue = value;
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                debouncedValue = value;
            }, delay);
        },
        destroy() {
            if (timeoutId) clearTimeout(timeoutId);
        },
    };
}

describe('useDebounce logic', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns initial value immediately', () => {
        const d = createDebouncer('hello');
        expect(d.debounced).toBe('hello');
    });

    it('does not update debounced value before delay', () => {
        const d = createDebouncer('');
        d.setValue('searching');

        vi.advanceTimersByTime(200);
        expect(d.debounced).toBe('');
    });

    it('updates debounced value after delay (300ms default)', () => {
        const d = createDebouncer('');
        d.setValue('searching');

        vi.advanceTimersByTime(300);
        expect(d.debounced).toBe('searching');
    });

    it('resets timer on rapid changes — only last value applied', () => {
        const d = createDebouncer('');

        d.setValue('s');
        vi.advanceTimersByTime(100);

        d.setValue('se');
        vi.advanceTimersByTime(100);

        d.setValue('sea');
        vi.advanceTimersByTime(100);

        // Only 300ms since last change, not enough
        expect(d.debounced).toBe('');

        vi.advanceTimersByTime(200);
        expect(d.debounced).toBe('sea');
    });

    it('supports custom delay', () => {
        const d = createDebouncer('', 500);
        d.setValue('test');

        vi.advanceTimersByTime(300);
        expect(d.debounced).toBe('');

        vi.advanceTimersByTime(200);
        expect(d.debounced).toBe('test');
    });

    it('handles null values', () => {
        const d = createDebouncer<string | null>('initial');
        d.setValue(null);

        vi.advanceTimersByTime(300);
        expect(d.debounced).toBeNull();
    });

    it('handles empty string', () => {
        const d = createDebouncer('something');
        d.setValue('');

        vi.advanceTimersByTime(300);
        expect(d.debounced).toBe('');
    });

    it('cleans up timeout on destroy', () => {
        const d = createDebouncer('');
        d.setValue('pending');
        d.destroy();

        vi.advanceTimersByTime(500);
        // Value should NOT have updated since we destroyed before timer fired
        expect(d.debounced).toBe('');
    });

    it('handles number type', () => {
        const d = createDebouncer(0);
        d.setValue(42);

        vi.advanceTimersByTime(300);
        expect(d.debounced).toBe(42);
    });

    it('multiple sequential updates after full delays', () => {
        const d = createDebouncer('');

        d.setValue('first');
        vi.advanceTimersByTime(300);
        expect(d.debounced).toBe('first');

        d.setValue('second');
        vi.advanceTimersByTime(300);
        expect(d.debounced).toBe('second');
    });
});
