import React from 'react'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// ── Mock IntersectionObserver ──
class MockIntersectionObserver {
  readonly root: Element | null = null
  readonly rootMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []

  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
})

// ── Mock ResizeObserver ──
class MockResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
})

// ── Mock matchMedia ──
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ── Mock next/navigation ──
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// ── Mock next/image ──
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    const { fill, priority, ...rest } = props
    return <img {...rest} />
  },
}))

// ── Mock framer-motion ──
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy(actual.motion, {
      get: (_target, prop: string) => {
        // Return a component that renders the HTML element directly
        const Component = ({ children, ...props }: Record<string, unknown>) => {
          // Strip motion-specific props
          const {
            initial, animate, exit, transition, variants,
            whileHover, whileTap, whileFocus, whileInView,
            layout, layoutId, onAnimationComplete, onAnimationStart,
            ...htmlProps
          } = props
          return React.createElement(prop, htmlProps, children as React.ReactNode)
        }
        Component.displayName = `motion.${prop}`
        return Component
      },
    }),
  }
})
