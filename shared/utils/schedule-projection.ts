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
  | 'done_historic'
  | 'missed'
  | 'compensated'
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

export interface PendingWorkout {
  assignedWorkoutId: string
  workoutName: string
  originalDay: string       // "Quarta"
  missedDate: string        // "12/03"
  exerciseCount: number
  notes?: string
}

export interface WeeklyProgress {
  expectedCount: number
  completedCount: number
  pendingWorkouts: PendingWorkout[]
  isWeekComplete: boolean
  completionPercentage: number
  /** Per-workout: how many completed vs expected this week */
  workoutCounts: Map<string, { expected: number; completed: number }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip time from a Date, returning a new Date at midnight local time. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Strip time from a Date in a specific timezone, returning midnight for that calendar day. */
function startOfDayTz(d: Date, timeZone: string): Date {
  const dateKey = d.toLocaleDateString('en-CA', { timeZone }) // YYYY-MM-DD
  return new Date(dateKey + 'T00:00:00')
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
// Weekly Progress
// ---------------------------------------------------------------------------

const WEEK_DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export interface WorkoutWithMeta extends ScheduledWorkoutRef {
  items?: { id: string }[]
  notes?: string
}

/**
 * Calculate weekly progress: expected vs completed, with pending workout details.
 * Counts by OCCURRENCE: if Treino A is scheduled 3 days, the student needs 3 sessions.
 */
export function calculateWeeklyProgress(
  workouts: WorkoutWithMeta[],
  sessions: SessionRef[],
  weekStart: Date,
): WeeklyProgress {
  const wkStart = startOfDay(weekStart)
  const wkEnd = addDays(wkStart, 6)
  const today = startOfDay(new Date())

  // Count completed sessions per workout this week
  const completedByWorkout = new Map<string, number>()
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    const d = startOfDay(new Date(s.completed_at ?? s.started_at))
    if (d >= wkStart && d <= wkEnd) {
      completedByWorkout.set(
        s.assigned_workout_id,
        (completedByWorkout.get(s.assigned_workout_id) || 0) + 1,
      )
    }
  }

  // Build expected occurrences per workout and total
  let expectedCount = 0
  let hasSchedules = false
  const workoutCounts = new Map<string, { expected: number; completed: number }>()

  // Track each scheduled occurrence for pending calculation
  interface ScheduledOccurrence {
    workoutId: string
    workoutName: string
    dayOfWeek: number
    date: Date
    exerciseCount: number
    notes?: string
  }
  const allOccurrences: ScheduledOccurrence[] = []

  for (const w of workouts) {
    if (w.scheduled_days && w.scheduled_days.length > 0) {
      hasSchedules = true
      const expected = w.scheduled_days.length
      const completed = completedByWorkout.get(w.id) || 0
      workoutCounts.set(w.id, { expected, completed })
      expectedCount += expected

      // Build individual occurrences for this workout
      for (const dow of w.scheduled_days) {
        // Find the actual date for this day-of-week within the week
        const daysFromStart = ((dow - wkStart.getDay()) + 7) % 7
        const occDate = addDays(wkStart, daysFromStart)
        allOccurrences.push({
          workoutId: w.id,
          workoutName: w.name,
          dayOfWeek: dow,
          date: occDate,
          exerciseCount: w.items?.length || 0,
          notes: w.notes,
        })
      }
    }
  }

  if (!hasSchedules) {
    expectedCount = workouts.length > 0 ? 3 : 0
  }

  const completedCount = Array.from(completedByWorkout.values()).reduce((a, b) => a + b, 0)

  // Determine pending workouts: for each workout, if completed < expected,
  // find the oldest missed occurrence(s)
  const pendingWorkouts: PendingWorkout[] = []

  if (hasSchedules) {
    // Sort occurrences by date ascending
    allOccurrences.sort((a, b) => a.date.getTime() - b.date.getTime())

    // Group by workout
    const occByWorkout = new Map<string, ScheduledOccurrence[]>()
    for (const occ of allOccurrences) {
      const arr = occByWorkout.get(occ.workoutId) || []
      arr.push(occ)
      occByWorkout.set(occ.workoutId, arr)
    }

    for (const [workoutId, occs] of occByWorkout) {
      const counts = workoutCounts.get(workoutId)
      if (!counts) continue
      if (counts.completed >= counts.expected) continue

      // Filter to past/today occurrences only, sorted chronologically (already sorted)
      const pastOccs = occs.filter(occ => occ.date <= today)

      // Consume completed sessions against the oldest occurrences first.
      // This ensures that a session done on Monday "covers" the Monday occurrence,
      // so only truly uncovered occurrences are marked as missed.
      let availableSessions = counts.completed
      for (const occ of pastOccs) {
        if (availableSessions > 0) {
          // This occurrence is covered by a completed session
          availableSessions--
          continue
        }
        // No sessions left to cover this occurrence — it's missed
        pendingWorkouts.push({
          assignedWorkoutId: occ.workoutId,
          workoutName: occ.workoutName,
          originalDay: WEEK_DAYS_PT[occ.dayOfWeek],
          missedDate: `${String(occ.date.getDate()).padStart(2, '0')}/${String(occ.date.getMonth() + 1).padStart(2, '0')}`,
          exerciseCount: occ.exerciseCount,
          notes: occ.notes,
        })
      }
    }
  }

  // Sort pending by date ascending (oldest missed first)
  pendingWorkouts.sort((a, b) => {
    const [dA, mA] = a.missedDate.split('/').map(Number)
    const [dB, mB] = b.missedDate.split('/').map(Number)
    return mA !== mB ? mA - mB : dA - dB
  })

  return {
    expectedCount,
    completedCount,
    pendingWorkouts,
    isWeekComplete: completedCount >= expectedCount,
    completionPercentage: expectedCount > 0 ? Math.min((completedCount / expectedCount) * 100, 100) : 0,
    workoutCounts,
  }
}

/**
 * Build a compensation map for a given week: for each workout, how many
 * sessions have been completed vs expected. Used by calendar to determine
 * if a "missed" day has been compensated.
 */
export function getWeekCompensationMap(
  workouts: ScheduledWorkoutRef[],
  sessions: SessionRef[],
  weekStart: Date,
): Map<string, { expected: number; completed: number }> {
  const wkStart = startOfDay(weekStart)
  const wkEnd = addDays(wkStart, 6)

  const completedByWorkout = new Map<string, number>()
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    const d = startOfDay(new Date(s.completed_at ?? s.started_at))
    if (d >= wkStart && d <= wkEnd) {
      completedByWorkout.set(
        s.assigned_workout_id,
        (completedByWorkout.get(s.assigned_workout_id) || 0) + 1,
      )
    }
  }

  const result = new Map<string, { expected: number; completed: number }>()
  for (const w of workouts) {
    if (w.scheduled_days && w.scheduled_days.length > 0) {
      result.set(w.id, {
        expected: w.scheduled_days.length,
        completed: completedByWorkout.get(w.id) || 0,
      })
    }
  }
  return result
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
  allSessions?: SessionRef[],
): CalendarDay[] {
  const today = startOfDay(new Date())
  const start = startOfDay(rangeStart)
  const end = startOfDay(rangeEnd)

  // Index sessions by date key for O(1) lookup
  // Use completed_at when available (canonical "when workout happened"), fallback to started_at
  const sessionsByDate = new Map<string, SessionRef[]>()
  for (const s of sessions) {
    const dateSource = s.completed_at ?? s.started_at
    const key = toDateKey(new Date(dateSource))
    const arr = sessionsByDate.get(key) || []
    arr.push(s)
    sessionsByDate.set(key, arr)
  }

  // Index ALL sessions (cross-program) for historic display
  const allSessionsByDate = new Map<string, SessionRef[]>()
  if (allSessions) {
    for (const s of allSessions) {
      const dateSource = s.completed_at ?? s.started_at
      const key = toDateKey(new Date(dateSource))
      const arr = allSessionsByDate.get(key) || []
      arr.push(s)
      allSessionsByDate.set(key, arr)
    }
  }

  // Pre-compute compensation maps per week (keyed by week start dateKey)
  const compensationCache = new Map<string, Map<string, { expected: number; completed: number }>>()
  function getCompensation(date: Date) {
    const weekRange = getWeekRange(date)
    const wkKey = toDateKey(weekRange.start)
    if (!compensationCache.has(wkKey)) {
      compensationCache.set(wkKey, getWeekCompensationMap(workouts, sessions, weekRange.start))
    }
    return compensationCache.get(wkKey)!
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

    // Check for historic sessions (cross-program) on this day
    const allDaySessions = allSessionsByDate.get(dateKey) || []
    const historicCompleted = allDaySessions.filter((s) => s.status === 'completed')

    // Determine status
    let status: CalendarDayStatus
    if (!inProgram) {
      // Outside current program: show historic sessions if any
      status = historicCompleted.length > 0 ? 'done_historic' : 'rest'
    } else if (completedSessions.length > 0) {
      status = 'done'
    } else if (scheduled.length > 0) {
      if (d < today) {
        // Missed day — check if all scheduled workouts were compensated elsewhere in the week
        const comp = getCompensation(d)
        const allCompensated = scheduled.every((sw) => {
          const c = comp.get(sw.id)
          return c ? c.completed >= c.expected : false
        })
        status = allCompensated ? 'compensated' : 'missed'
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

/** Get the Sunday–Saturday range containing `date`. Optionally timezone-aware.
 *  `end` is set to 23:59:59.999 of Saturday so that timestamp-based comparisons
 *  (Supabase `.lte()`, `d <= end`) include the entire last day of the week. */
export function getWeekRange(date: Date, timeZone?: string): DateRange {
  const d = timeZone ? startOfDayTz(date, timeZone) : startOfDay(date)
  const start = addDays(d, -d.getDay()) // Sunday 00:00
  const end = addDays(start, 6) // Saturday 00:00
  end.setHours(23, 59, 59, 999) // Saturday 23:59:59.999
  return { start, end }
}

/** Get the 1st–last day range for the month containing `date`. */
export function getMonthRange(date: Date): DateRange {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0) // last day
  end.setHours(23, 59, 59, 999)
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
  const { start: monthStart } = getMonthRange(date)
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0) // last day at midnight
  // Extend to full weeks
  const start = addDays(monthStart, -monthStart.getDay()) // back to Sunday
  const end = addDays(monthEnd, 6 - monthEnd.getDay()) // forward to Saturday
  end.setHours(23, 59, 59, 999)
  return { start, end }
}
