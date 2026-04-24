import { create } from 'zustand'

/**
 * Coordinates global ⌘K behavior between the modal CommandPalette and the
 * inline search bar rendered in the dashboard header.
 *
 * When the inline bar mounts, it registers itself via `registerInlineSearch()`.
 * While registered, the global modal palette ignores ⌘K / Ctrl+K so the inline
 * bar is the only surface that opens.
 */
interface SearchState {
    /** True while an inline search bar is mounted and visible on the page. */
    inlineSearchMounted: boolean
    /** Inline bar open/closed state. */
    isInlineOpen: boolean

    registerInlineSearch: () => void
    unregisterInlineSearch: () => void
    openInline: () => void
    closeInline: () => void
    toggleInline: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
    inlineSearchMounted: false,
    isInlineOpen: false,

    registerInlineSearch: () => set({ inlineSearchMounted: true }),
    unregisterInlineSearch: () => set({ inlineSearchMounted: false, isInlineOpen: false }),
    openInline: () => set({ isInlineOpen: true }),
    closeInline: () => set({ isInlineOpen: false }),
    toggleInline: () => set(state => ({ isInlineOpen: !state.isInlineOpen })),
}))
