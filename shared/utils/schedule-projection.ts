/**
 * Schedule Projection Utilities
 *
 * Pure functions for projecting workout schedules across time.
 * Used by both Web (Next.js) and Mobile (Expo) platforms.
 * Zero external dependencies — only native Date math.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduledWorkoutRef {
  id: string
  name: string
  scheduled_days: number[] // 0 = Sunday … 6 = Saturday
}

export interface SessionRef {
  id: string
  assigned_workout_id: string
  started_at: string
  completed_at?: string | null
  status: 'in_progress' | 'completed'
  rpe?: number | null
}

export type CalendarDayStatus =
  | 'done'
  | 'missed'
  | 'scheduled'
  | 'rest'
  | 'out_of_program'

export interface CalendarDay {
  date: Date
  dateKey: string // YYYY-MM-DD — useful as Map/cache key
  dayOfWeek: number // 0-6
  isToday: boolean
  isInProgram: boolean
  programWeek: number | null // 1-indexed
  scheduledWorkouts: { id: string; name: string }[]
  completedSessions: SessionRef[]
  status: CalendarDayStatus
}

export interface DateRange {
  start: Date
  end: Date
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip time from a Date, returning a new Date at midnight local time. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Format date as YYYY-MM-DD (local time). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Add `days` to a Date (returns new Date). */
function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

// ---------------------------------------------------------------------------
// Program Boundaries
// ---------------------------------------------------------------------------

/** Calculate the end date of a program. */
export function getProgramEndDate(
  startedAt: string | Date,
  durationWeeks: number,
): Date {
  const start = startOfDay(new Date(startedAt))
  return addDays(start, durationWeeks * 7 - 1) // inclusive last day
}

/** Check whether a date falls within the program boundaries. */
export function isDateInProgram(
  date: Date,
  startedAt: string | Date,
  durationWeeks: number | null | undefined,
): boolean {
  const d = startOfDay(date)
  const start = startOfDay(new Date(startedAt))
  if (d < start) return false
  if (!durationWeeks) return true // open-ended program
  const end = getProgramEndDate(startedAt, durationWeeks)
  return d <= end
}

/** Return the 1-indexed program week for a given date. Returns null if outside. */
export function getProgramWeek(
  date: Date,
  startedAt: string | Date,
  durationWeeks?: number | null,
): number | null {
  const d = startOfDay(date)
  const start = startOfDay(new Date(startedAt))
  if (d < start) return null
  const diffDays = Math.floor(
    (d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  )
  const week = Math.floor(diffDays / 7) + 1
  if (durationWeeks && week > durationWeeks) return null
  return week
}

// ---------------------------------------------------------------------------
// Schedule Queries
// ---------------------------------------------------------------------------

/** Return workouts scheduled for a specific date. */
export function getScheduledWorkoutsForDate(
  date: Date,
  workouts: ScheduledWorkoutRef[],
  programStartedAt: string | Date,
  durationWeeks?: number | null,
): { id: string; name: string }[] {
  if (!isDateInProgram(date, programStartedAt, durationWeeks)) return []
  const dayOfWeek = date.getDay()
  return workouts
    .filter((w) => w.scheduled_days?.includes(dayOfWeek))
    .map((w) => ({ id: w.id, name: w.name }))
}

// ---------------------------------------------------------------------------
// Calendar Generation
// ---------------------------------------------------------------------------

/**
 * Generate an array of CalendarDay objects for a date range.
 *
 * `sessions` should already be filtered to overlap the requested range
 * (a small buffer is fine — extras are ignored).
 */
export function generateCalendarDays(
  rangeStart: Date,
  rangeEnd: Date,
  workouts: ScheduledWorkoutRef[],
  sessions: SessionRef[],
  programStartedAt: string | Date,
  durationWeeks?: number | null,
): CalendarDay[] {
  const today = startOfDay(new Date())
  const start = startOfDay(rangeStart)
  const end = startOfDay(rangeEnd)

  // Index sessions by date key for O(1) lookup
  const sessionsByDate = new Map<string, SessionRef[]>()
  for (const s of sessions) {
    const key = toDateKey(new Date(s.started_at))
    const arr = sessionsByDate.get(key) || []
    arr.push(s)
    sessionsByDate.set(key, arr)
  }

  const days: CalendarDay[] = []
  let cursor = new Date(start)

  while (cursor <= end) {
    const d = startOfDay(cursor)
    const dateKey = toDateKey(d)
    const dayOfWeek = d.getDay()
    const isToday = d.getTime() === today.getTime()
    const inProgram = isDateInProgram(d, programStartedAt, durationWeeks)
    const programWeek = inProgram
      ? getProgramWeek(d, programStartedAt, durationWeeks)
      : null

    const scheduled = inProgram
      ? getScheduledWorkoutsForDate(d, workouts, programStartedAt, durationWeeks)
      : []

    const daySessions = sessionsByDate.get(dateKey) || []
    const completedSessions = daySessions.filter((s) => s.status === 'completed')

    // Determine status
    let status: CalendarDayStatus
    if (!inProgram) {
      status = 'out_of_program'
    } else if (completedSessions.length > 0) {
      status = 'done'
    } else if (scheduled.length > 0) {
      if (d < today) {
        status = 'missed'
      } else {
        status = 'scheduled' // today or future
      }
    } else {
      status = 'rest'
    }

    days.push({
      date: new Date(d),
      dateKey,
      dayOfWeek,
      isToday,
      isInProgram: inProgram,
      programWeek,
      scheduledWorkouts: scheduled,
      completedSessions,
      status,
    })

    cursor = addDays(cursor, 1)
  }

  return days
}

// ---------------------------------------------------------------------------
// Week / Month Navigation
// ---------------------------------------------------------------------------

/** Get the Sunday–Saturday range containing `date`. */
export function getWeekRange(date: Date): DateRange {
  const d = startOfDay(date)
  const start = addDays(d, -d.getDay()) // Sunday
  const end = addDays(start, 6) // Saturday
  return { start, end }
}

/** Get the 1st–last day range for the month containing `date`. */
export function getMonthRange(date: Date): DateRange {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0) // last day
  return { start, end }
}

/** Shift a date by ±1 week, returning a new Date. */
export function shiftWeek(date: Date, direction: -1 | 1): Date {
  return addDays(startOfDay(date), direction * 7)
}

/** Shift a date by ±1 month, returning a new Date. */
export function shiftMonth(date: Date, direction: -1 | 1): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + direction)
  return startOfDay(d)
}

/** Get the full calendar grid for a month (includes leading/trailing days to fill weeks). */
export function getMonthGridRange(date: Date): DateRange {
  const { start: monthStart, end: monthEnd } = getMonthRange(date)
  // Extend to full weeks
  const start = addDays(monthStart, -monthStart.getDay()) // back to Sunday
  const end = addDays(monthEnd, 6 - monthEnd.getDay()) // forward to Saturday
  return { start, end }
}
