import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import {
  useDashboardLayoutStore,
  WIDGET_REGISTRY,
  type WidgetId,
} from '../dashboard-layout-store'

// Helper to get a fresh store state
const getState = () => useDashboardLayoutStore.getState()

describe('dashboard-layout-store', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    act(() => {
      getState().resetLayout()
      getState().setCustomizing(false)
    })
  })

  // ── Default State ──

  describe('default state', () => {
    it('has 4 default widgets in order', () => {
      const { widgets } = getState()
      expect(widgets).toHaveLength(4)
      expect(widgets.map(w => w.id)).toEqual([
        'stats',
        'insights',
        'expiring-programs',
        'activity-feed',
      ])
    })

    it('has sequential order values starting at 0', () => {
      const { widgets } = getState()
      widgets.forEach((w, i) => {
        expect(w.order).toBe(i)
      })
    })

    it('is not in customizing mode by default', () => {
      expect(getState().isCustomizing).toBe(false)
    })
  })

  // ── WIDGET_REGISTRY ──

  describe('WIDGET_REGISTRY', () => {
    it('has 7 registered widgets', () => {
      expect(Object.keys(WIDGET_REGISTRY)).toHaveLength(7)
    })

    it('stats widget is not removable', () => {
      expect(WIDGET_REGISTRY['stats'].removable).toBe(false)
    })

    it('all other widgets are removable', () => {
      const removableIds: WidgetId[] = [
        'insights', 'expiring-programs', 'activity-feed',
        'weekly-goals', 'student-ranking', 'upcoming-appointments',
      ]
      removableIds.forEach(id => {
        expect(WIDGET_REGISTRY[id].removable).toBe(true)
      })
    })

    it('each widget has required fields', () => {
      Object.values(WIDGET_REGISTRY).forEach(config => {
        expect(config.id).toBeTruthy()
        expect(config.label).toBeTruthy()
        expect(config.description).toBeTruthy()
        expect(['full', 'half', 'third']).toContain(config.size)
        expect(typeof config.removable).toBe('boolean')
        expect(typeof config.defaultEnabled).toBe('boolean')
      })
    })
  })

  // ── addWidget ──

  describe('addWidget', () => {
    it('adds a new widget to the end', () => {
      act(() => {
        getState().addWidget('weekly-goals')
      })

      const { widgets } = getState()
      expect(widgets).toHaveLength(5)
      expect(widgets[4].id).toBe('weekly-goals')
      expect(widgets[4].order).toBe(4)
    })

    it('does not add a duplicate widget', () => {
      act(() => {
        getState().addWidget('stats') // already in default layout
      })

      expect(getState().widgets).toHaveLength(4)
    })

    it('assigns order one higher than current max', () => {
      act(() => {
        getState().addWidget('student-ranking')
      })

      const added = getState().widgets.find(w => w.id === 'student-ranking')
      expect(added?.order).toBe(4)
    })

    it('can add multiple widgets sequentially', () => {
      act(() => {
        getState().addWidget('weekly-goals')
        getState().addWidget('student-ranking')
        getState().addWidget('upcoming-appointments')
      })

      expect(getState().widgets).toHaveLength(7)
    })
  })

  // ── removeWidget ──

  describe('removeWidget', () => {
    it('removes a removable widget', () => {
      act(() => {
        getState().removeWidget('insights')
      })

      const { widgets } = getState()
      expect(widgets).toHaveLength(3)
      expect(widgets.find(w => w.id === 'insights')).toBeUndefined()
    })

    it('does NOT remove a non-removable widget (stats)', () => {
      act(() => {
        getState().removeWidget('stats')
      })

      expect(getState().widgets).toHaveLength(4)
      expect(getState().widgets.find(w => w.id === 'stats')).toBeDefined()
    })

    it('does nothing when removing a widget not in layout', () => {
      act(() => {
        getState().removeWidget('weekly-goals') // not in default layout
      })

      expect(getState().widgets).toHaveLength(4)
    })
  })

  // ── reorderWidgets ──

  describe('reorderWidgets', () => {
    it('moves a widget from one position to another', () => {
      act(() => {
        getState().reorderWidgets('activity-feed', 'insights')
      })

      const ids = getState().widgets.map(w => w.id)
      expect(ids).toEqual([
        'stats',
        'activity-feed',
        'insights',
        'expiring-programs',
      ])
    })

    it('reassigns sequential order values after reorder', () => {
      act(() => {
        getState().reorderWidgets('activity-feed', 'stats')
      })

      getState().widgets.forEach((w, i) => {
        expect(w.order).toBe(i)
      })
    })

    it('does nothing if activeId not found', () => {
      const before = getState().widgets
      act(() => {
        getState().reorderWidgets('nonexistent' as WidgetId, 'stats')
      })
      expect(getState().widgets).toEqual(before)
    })

    it('does nothing if overId not found', () => {
      const before = getState().widgets
      act(() => {
        getState().reorderWidgets('stats', 'nonexistent' as WidgetId)
      })
      expect(getState().widgets).toEqual(before)
    })
  })

  // ── resetLayout ──

  describe('resetLayout', () => {
    it('restores default layout after modifications', () => {
      act(() => {
        getState().addWidget('weekly-goals')
        getState().removeWidget('insights')
        getState().reorderWidgets('activity-feed', 'stats')
      })

      // Layout is now different
      expect(getState().widgets).not.toEqual([
        { id: 'stats', order: 0 },
        { id: 'insights', order: 1 },
        { id: 'expiring-programs', order: 2 },
        { id: 'activity-feed', order: 3 },
      ])

      act(() => {
        getState().resetLayout()
      })

      expect(getState().widgets).toEqual([
        { id: 'stats', order: 0 },
        { id: 'insights', order: 1 },
        { id: 'expiring-programs', order: 2 },
        { id: 'activity-feed', order: 3 },
      ])
    })
  })

  // ── setCustomizing ──

  describe('setCustomizing', () => {
    it('toggles customizing mode on', () => {
      act(() => {
        getState().setCustomizing(true)
      })
      expect(getState().isCustomizing).toBe(true)
    })

    it('toggles customizing mode off', () => {
      act(() => {
        getState().setCustomizing(true)
        getState().setCustomizing(false)
      })
      expect(getState().isCustomizing).toBe(false)
    })
  })

  // ── setWidgets (direct) ──

  describe('setWidgets', () => {
    it('replaces the entire widget list', () => {
      const custom = [
        { id: 'stats' as WidgetId, order: 0 },
        { id: 'weekly-goals' as WidgetId, order: 1 },
      ]

      act(() => {
        getState().setWidgets(custom)
      })

      expect(getState().widgets).toEqual(custom)
    })
  })
})
