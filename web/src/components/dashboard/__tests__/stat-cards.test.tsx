import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatCards } from '../stat-cards'
import type { DashboardStats } from '@/lib/dashboard/get-dashboard-data'

// ── Mock localStorage ──
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// ── Fixtures ──

const mockStats: DashboardStats = {
  activeStudentsCount: 25,
  sessionsThisWeek: 48,
  expectedSessionsThisWeek: 100,
  mrr: 12500,
  adherencePercent: 72,
  hasActivePrograms: true,
  sessionsPerDay: [0, 8, 12, 10, 9, 7, 2],
  sessionsLastWeek: 40,
  mrrLastMonth: 10000,
  adherenceLastWeek: 65,
  activeStudentsLastWeek: 22,
}

const mockStatsNoAdherence: DashboardStats = {
  ...mockStats,
  hasActivePrograms: false,
}

describe('StatCards', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('renders all 4 cards when hasActivePrograms is true', () => {
    render(<StatCards stats={mockStats} />)

    expect(screen.getByText('Alunos ativos')).toBeInTheDocument()
    expect(screen.getByText('Treinos esta semana')).toBeInTheDocument()
    expect(screen.getByText('Receita mensal')).toBeInTheDocument()
    expect(screen.getByText('Aderência geral')).toBeInTheDocument()
  })

  it('renders only 3 cards when hasActivePrograms is false', () => {
    render(<StatCards stats={mockStatsNoAdherence} />)

    expect(screen.getByText('Alunos ativos')).toBeInTheDocument()
    expect(screen.getByText('Treinos esta semana')).toBeInTheDocument()
    expect(screen.getByText('Receita mensal')).toBeInTheDocument()
    expect(screen.queryByText('Aderência geral')).not.toBeInTheDocument()
  })

  it('displays correct student count', () => {
    render(<StatCards stats={mockStats} />)
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('displays correct sessions count with denominator', () => {
    render(<StatCards stats={mockStats} />)
    expect(screen.getByText('48')).toBeInTheDocument()
    expect(screen.getByText('/100')).toBeInTheDocument()
  })

  it('displays MRR formatted as BRL currency', () => {
    render(<StatCards stats={mockStats} />)
    // BRL currency format: R$ 12.500,00
    expect(screen.getByText(/R\$\s*12\.500,00/)).toBeInTheDocument()
  })

  it('displays adherence percentage', () => {
    render(<StatCards stats={mockStats} />)
    expect(screen.getByText('72%')).toBeInTheDocument()
  })

  it('toggles MRR visibility on click', () => {
    render(<StatCards stats={mockStats} />)

    // MRR should be visible initially
    expect(screen.getByText(/R\$\s*12\.500,00/)).toBeInTheDocument()

    // Click the toggle button (eye icon)
    const toggleButton = screen.getByText('Receita mensal').closest('div')?.parentElement?.querySelector('button')
    if (toggleButton) {
      fireEvent.click(toggleButton)
    }

    // MRR should be hidden
    expect(screen.getByText('R$ •••••')).toBeInTheDocument()
    expect(localStorageMock.setItem).toHaveBeenCalledWith('kinevo:mrr-visible', 'false')
  })

  it('shows trend badges with correct percentages', () => {
    render(<StatCards stats={mockStats} />)

    // Active students: 25 vs 22 = +14%
    expect(screen.getByText('+14%')).toBeInTheDocument()

    // Sessions: 48 vs 40 = +20%
    expect(screen.getByText('+20%')).toBeInTheDocument()
  })

  it('shows session progress bar percentage', () => {
    render(<StatCards stats={mockStats} />)
    expect(screen.getByText('48% concluído')).toBeInTheDocument()
  })

  it('does not show progress bar when expected sessions is 0', () => {
    const stats = { ...mockStats, expectedSessionsThisWeek: 0 }
    render(<StatCards stats={stats} />)
    expect(screen.queryByText(/concluído/)).not.toBeInTheDocument()
  })

  it('does not show trend badge when previous value is null', () => {
    const stats = { ...mockStats, sessionsLastWeek: null, activeStudentsLastWeek: null }
    render(<StatCards stats={stats} />)
    // Only MRR and adherence trends should show
    expect(screen.queryByText('+14%')).not.toBeInTheDocument()
    expect(screen.queryByText('+20%')).not.toBeInTheDocument()
  })
})
