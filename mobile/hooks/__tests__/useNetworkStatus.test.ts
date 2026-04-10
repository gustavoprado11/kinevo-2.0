import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the useNetworkStatus state machine logic.
 *
 * The hook manages two pieces of state:
 *   - isConnected: current connectivity
 *   - wasDisconnected: true after a disconnect, resets 5s after reconnection
 *
 * State transitions:
 *   1. connected=true  → disconnect event  → isConnected=false, wasDisconnected=true
 *   2. disconnected    → reconnect event   → isConnected=true, wasDisconnected=true
 *   3. reconnected     → 5s timer fires    → wasDisconnected=false
 *
 * ConnectionBanner visibility logic:
 *   - hidden when isConnected && !wasDisconnected
 *   - shows "offline" when !isConnected
 *   - shows "reconnected" when isConnected && wasDisconnected
 */

interface NetworkState {
    isConnected: boolean;
    wasDisconnected: boolean;
}

/**
 * Pure state machine replicating useNetworkStatus behavior
 */
function createNetworkStateMachine() {
    let state: NetworkState = { isConnected: true, wasDisconnected: false };
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function onNetInfoChange(connected: boolean) {
        if (!connected) {
            state = { ...state, wasDisconnected: true };
        }
        state = { ...state, isConnected: connected };

        // Clear existing reconnect timer
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        // Start 5s timer if reconnected
        if (state.isConnected && state.wasDisconnected) {
            reconnectTimer = setTimeout(() => {
                state = { ...state, wasDisconnected: false };
                reconnectTimer = null;
            }, 5000);
        }
    }

    return {
        get state() { return { ...state }; },
        onNetInfoChange,
        destroy() {
            if (reconnectTimer) clearTimeout(reconnectTimer);
        },
    };
}

/**
 * ConnectionBanner visibility logic
 */
function getBannerState(state: NetworkState) {
    if (state.isConnected && !state.wasDisconnected) return 'hidden';
    if (!state.isConnected) return 'offline';
    return 'reconnected';
}

describe('useNetworkStatus state machine', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts connected with no disconnect history', () => {
        const sm = createNetworkStateMachine();
        expect(sm.state).toEqual({ isConnected: true, wasDisconnected: false });
    });

    it('marks wasDisconnected on disconnect', () => {
        const sm = createNetworkStateMachine();
        sm.onNetInfoChange(false);

        expect(sm.state.isConnected).toBe(false);
        expect(sm.state.wasDisconnected).toBe(true);
    });

    it('keeps wasDisconnected=true on reconnect', () => {
        const sm = createNetworkStateMachine();
        sm.onNetInfoChange(false);
        sm.onNetInfoChange(true);

        expect(sm.state.isConnected).toBe(true);
        expect(sm.state.wasDisconnected).toBe(true);
    });

    it('resets wasDisconnected after 5s of reconnection', () => {
        const sm = createNetworkStateMachine();
        sm.onNetInfoChange(false);
        sm.onNetInfoChange(true);

        vi.advanceTimersByTime(5000);

        expect(sm.state.isConnected).toBe(true);
        expect(sm.state.wasDisconnected).toBe(false);
    });

    it('does NOT reset wasDisconnected before 5s', () => {
        const sm = createNetworkStateMachine();
        sm.onNetInfoChange(false);
        sm.onNetInfoChange(true);

        vi.advanceTimersByTime(3000);

        expect(sm.state.wasDisconnected).toBe(true);
    });

    it('cancels 5s timer if disconnected again', () => {
        const sm = createNetworkStateMachine();
        sm.onNetInfoChange(false);
        sm.onNetInfoChange(true);

        vi.advanceTimersByTime(3000);
        sm.onNetInfoChange(false); // disconnect again before timer fires

        vi.advanceTimersByTime(5000);
        expect(sm.state.isConnected).toBe(false);
        expect(sm.state.wasDisconnected).toBe(true);
    });

    it('handles rapid connect/disconnect cycles', () => {
        const sm = createNetworkStateMachine();

        sm.onNetInfoChange(false);
        sm.onNetInfoChange(true);
        sm.onNetInfoChange(false);
        sm.onNetInfoChange(true);
        sm.onNetInfoChange(false);

        expect(sm.state.isConnected).toBe(false);
        expect(sm.state.wasDisconnected).toBe(true);

        sm.onNetInfoChange(true);
        vi.advanceTimersByTime(5000);

        expect(sm.state).toEqual({ isConnected: true, wasDisconnected: false });
    });

    it('stays connected if no events', () => {
        const sm = createNetworkStateMachine();
        vi.advanceTimersByTime(60000);

        expect(sm.state).toEqual({ isConnected: true, wasDisconnected: false });
    });
});

describe('ConnectionBanner visibility logic', () => {
    it('hidden when connected and never disconnected', () => {
        expect(getBannerState({ isConnected: true, wasDisconnected: false })).toBe('hidden');
    });

    it('shows offline when disconnected', () => {
        expect(getBannerState({ isConnected: false, wasDisconnected: true })).toBe('offline');
    });

    it('shows reconnected when just reconnected', () => {
        expect(getBannerState({ isConnected: true, wasDisconnected: true })).toBe('reconnected');
    });

    it('hidden again after wasDisconnected resets', () => {
        expect(getBannerState({ isConnected: true, wasDisconnected: false })).toBe('hidden');
    });
});
