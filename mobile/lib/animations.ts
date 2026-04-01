import { Easing } from 'react-native-reanimated';

/**
 * Centralised animation presets for the Kinevo mobile app.
 *
 * Philosophy:
 * - Animations should be *felt*, not *seen*.
 * - Use `timing` (easing curves) for almost everything.
 * - Reserve `spring` for physically-motivated motion only
 *   (drag snap-back, pill following a finger).
 */
export const ANIM = {
    // ── Timing presets (most transitions) ──
    timing: {
        fast:   { duration: 150, easing: Easing.out(Easing.cubic) },
        normal: { duration: 250, easing: Easing.out(Easing.cubic) },
        slow:   { duration: 350, easing: Easing.out(Easing.cubic) },
    },

    // ── Spring presets (physics-motivated only) ──
    spring: {
        tight:  { damping: 28, stiffness: 300 },   // segmented pill, accordion
        snappy: { damping: 25, stiffness: 250 },    // drag snap-back
    },

    // ── Entering-animation defaults ──
    enter: {
        duration: 300,
        easing: Easing.out(Easing.cubic),
        stagger: 50, // ms between staggered items
    },
} as const;
