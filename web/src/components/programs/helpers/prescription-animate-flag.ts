// sessionStorage gate for the Fase 1.5 progressive reveal.
//
// When the AI panel finishes generating, it sets a flag tied to the new
// generationId BEFORE navigating the builder to ?source=prescription&generationId=…
// The builder reads + removes the flag on mount: if present, it enables the
// animated reveal. Any subsequent navigation (refresh, other tab, shared link)
// finds no flag and shows the whole program immediately.
//
// Keying by generationId avoids animating a stale generation if the trainer
// opens a second one in quick succession.

const STORAGE_PREFIX = 'prescription:animate:'

function storageKey(generationId: string): string {
    return `${STORAGE_PREFIX}${generationId}`
}

/** Mark a generation as eligible for animated reveal on the next mount. */
export function setPrescriptionAnimateFlag(generationId: string): void {
    if (typeof window === 'undefined') return
    try {
        window.sessionStorage.setItem(storageKey(generationId), '1')
    } catch {
        // sessionStorage can throw in incognito / quota-exceeded; animation is
        // a nice-to-have, so swallow silently.
    }
}

/**
 * Read and clear the animate flag for a generation. Returns true if the flag
 * was set (caller should animate). Safe to call during SSR (returns false).
 */
export function consumePrescriptionAnimateFlag(generationId: string): boolean {
    if (typeof window === 'undefined') return false
    try {
        const key = storageKey(generationId)
        const value = window.sessionStorage.getItem(key)
        if (value) {
            window.sessionStorage.removeItem(key)
            return true
        }
        return false
    } catch {
        return false
    }
}
