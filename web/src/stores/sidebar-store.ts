import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
    isCollapsed: boolean
    isAutoCollapsed: boolean
    toggle: () => void
    collapse: () => void
    expand: () => void
    setAutoCollapse: (collapsed: boolean) => void
}

// Routes that should auto-collapse the sidebar
const AUTO_COLLAPSE_PATTERNS = [
    /^\/programs\/new/,
    /^\/programs\/[^/]+$/,       // /programs/[id] but not /programs
    /\/program\/new/,            // /students/[id]/program/new
    /\/program\/[^/]+\/edit/,    // /students/[id]/program/[id]/edit
    /^\/training-room/,
    /^\/students\/[^/]+\/prescribe/, // AI prescription
]

export function shouldAutoCollapse(pathname: string): boolean {
    return AUTO_COLLAPSE_PATTERNS.some(pattern => pattern.test(pathname))
}

export const useSidebarStore = create<SidebarState>()(
    persist(
        (set) => ({
            isCollapsed: false,
            isAutoCollapsed: false,

            toggle: () => set(state => ({
                isCollapsed: !state.isCollapsed,
                isAutoCollapsed: false, // manual toggle clears auto flag
            })),

            collapse: () => set({ isCollapsed: true }),
            expand: () => set({ isCollapsed: false }),

            setAutoCollapse: (collapsed) => set({
                isCollapsed: collapsed,
                isAutoCollapsed: true,
            }),
        }),
        {
            name: 'kinevo-sidebar',
            partialize: (state) => ({
                // Only persist manual preference, not auto-collapse state
                isCollapsed: state.isAutoCollapsed ? false : state.isCollapsed,
            }),
        }
    )
)
