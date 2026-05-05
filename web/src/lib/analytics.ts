/**
 * Analytics shim — log-only por enquanto. Quando uma integração real
 * (PostHog/Mixpanel/etc.) for adicionada, basta substituir esta função.
 */
export function track(event: string, properties?: Record<string, unknown>) {
    if (typeof window === 'undefined') return
    if (properties) {
        console.log(`[analytics] ${event}`, properties)
    } else {
        console.log(`[analytics] ${event}`)
    }
}
