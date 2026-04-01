import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from '@testing-library/react'
import { WidgetPicker } from '../widget-picker'
import { useDashboardLayoutStore, WIDGET_REGISTRY } from '@/stores/dashboard-layout-store'

describe('WidgetPicker', () => {
  beforeEach(() => {
    act(() => {
      useDashboardLayoutStore.getState().resetLayout()
      useDashboardLayoutStore.getState().setCustomizing(false)
    })
  })

  it('renders nothing when not in customizing mode', () => {
    const { container } = render(<WidgetPicker />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the panel when customizing is true', () => {
    act(() => {
      useDashboardLayoutStore.getState().setCustomizing(true)
    })

    render(<WidgetPicker />)
    expect(screen.getByText('Personalizar dashboard')).toBeInTheDocument()
    expect(screen.getByText(/Arraste para reordenar/)).toBeInTheDocument()
  })

  it('shows all 7 widgets from registry', () => {
    act(() => {
      useDashboardLayoutStore.getState().setCustomizing(true)
    })

    render(<WidgetPicker />)

    Object.values(WIDGET_REGISTRY).forEach(config => {
      expect(screen.getByText(config.label)).toBeInTheDocument()
    })
  })

  it('disables the non-removable widget (KPIs/stats)', () => {
    act(() => {
      useDashboardLayoutStore.getState().setCustomizing(true)
    })

    render(<WidgetPicker />)

    // Find the button containing 'KPIs' label
    const kpisButton = screen.getByText('KPIs').closest('button')
    expect(kpisButton).toBeDisabled()
  })

  it('adds a widget when clicking an inactive one', () => {
    act(() => {
      useDashboardLayoutStore.getState().setCustomizing(true)
    })

    render(<WidgetPicker />)

    // 'Metas semanais' is not in default layout
    const goalsButton = screen.getByText('Metas semanais').closest('button')
    expect(goalsButton).not.toBeDisabled()

    fireEvent.click(goalsButton!)

    const { widgets } = useDashboardLayoutStore.getState()
    expect(widgets.find(w => w.id === 'weekly-goals')).toBeDefined()
  })

  it('removes a widget when clicking an active removable one', () => {
    act(() => {
      useDashboardLayoutStore.getState().setCustomizing(true)
    })

    render(<WidgetPicker />)

    // 'Treinos de hoje' (activity-feed) is in default layout and removable
    const activityButton = screen.getByText('Treinos de hoje').closest('button')
    fireEvent.click(activityButton!)

    const { widgets } = useDashboardLayoutStore.getState()
    expect(widgets.find(w => w.id === 'activity-feed')).toBeUndefined()
  })

  it('closes customizing mode when clicking "Concluir"', () => {
    act(() => {
      useDashboardLayoutStore.getState().setCustomizing(true)
    })

    render(<WidgetPicker />)
    fireEvent.click(screen.getByText('Concluir'))

    expect(useDashboardLayoutStore.getState().isCustomizing).toBe(false)
  })

  it('resets layout when clicking "Resetar"', () => {
    act(() => {
      useDashboardLayoutStore.getState().setCustomizing(true)
      useDashboardLayoutStore.getState().addWidget('weekly-goals')
      useDashboardLayoutStore.getState().removeWidget('activity-feed')
    })

    render(<WidgetPicker />)
    fireEvent.click(screen.getByText('Resetar'))

    const { widgets } = useDashboardLayoutStore.getState()
    expect(widgets).toHaveLength(4)
    expect(widgets.map(w => w.id)).toEqual([
      'stats', 'insights', 'expiring-programs', 'activity-feed',
    ])
  })
})
