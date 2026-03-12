// ============================================================================
// Kinevo — AI Prescription Module Types
// ============================================================================
// These types mirror the SQL schema defined in migrations 034, 035, 036, and 079.
// JSONB columns have well-defined TypeScript interfaces — no `any` or `unknown`.
//
// Exercise and MuscleGroup types are NOT redefined here — import from exercise.ts.
// Warmup/Cardio config types are in workout-items.ts.

// ============================================================================
// ENUMS (union types matching SQL CHECK constraints)
// ============================================================================

/** student_prescription_profiles.training_level */
export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced'

/** student_prescription_profiles.goal */
export type PrescriptionGoal = 'hypertrophy' | 'weight_loss' | 'performance' | 'health'

/** student_prescription_profiles.ai_mode */
export type AiMode = 'auto' | 'copilot' | 'assistant'

/** prescription_generations.ai_source */
export type AiSource = 'llm' | 'heuristic' | 'agent'

/** prescription_generations.status */
export type PrescriptionStatus = 'pending_review' | 'approved' | 'rejected' | 'expired'

/** assigned_programs.status (extended in migration 036 to include 'draft') */
export type AssignedProgramStatus = 'draft' | 'active' | 'scheduled' | 'completed' | 'paused'

/** workout_item_templates.exercise_function / assigned_workout_items.exercise_function */
export type ExerciseFunction = 'warmup' | 'activation' | 'main' | 'accessory' | 'conditioning'

export const EXERCISE_FUNCTION_OPTIONS: readonly ExerciseFunction[] = [
    'warmup', 'activation', 'main', 'accessory', 'conditioning',
] as const

export const EXERCISE_FUNCTION_LABELS: Record<ExerciseFunction, string> = {
    warmup: 'Aquecimento',
    activation: 'Ativação',
    main: 'Principal',
    accessory: 'Acessório',
    conditioning: 'Condicionamento',
}

export const EXERCISE_FUNCTION_ORDER: Record<ExerciseFunction, number> = {
    warmup: 0,
    activation: 1,
    main: 2,
    accessory: 3,
    conditioning: 4,
}

// ============================================================================
// JSONB COLUMN INTERFACES
// ============================================================================

/**
 * student_prescription_profiles.medical_restrictions (JSONB array)
 * Each element represents one medical restriction for the student.
 */
export interface MedicalRestriction {
    /** Human-readable description, e.g. "Dor no joelho direito" */
    description: string
    /** Exercise UUIDs that must NEVER appear in generated programs */
    restricted_exercise_ids: string[]
    /** Muscle group names that should be avoided or limited */
    restricted_muscle_groups: string[]
    /** Severity level — 'severe' triggers Mode 3 (assistant) automatically */
    severity: 'mild' | 'moderate' | 'severe'
}

/**
 * prescription_generations.input_snapshot (JSONB)
 * Complete snapshot of all data sent to the prescription engine.
 */
export interface PrescriptionInputSnapshot {
    /** Student profile at time of generation */
    profile: {
        student_id: string
        training_level: TrainingLevel
        goal: PrescriptionGoal
        available_days: number[]
        session_duration_minutes: number
        available_equipment: string[]
        favorite_exercise_ids: string[]
        disliked_exercise_ids: string[]
        medical_restrictions: MedicalRestriction[]
        ai_mode: AiMode
        adherence_rate: number | null
    }
    /** Exercise library available at generation time (IDs + metadata) */
    available_exercises: PrescriptionExerciseRef[]
    /** Recent performance data from set_logs / workout_sessions */
    performance_context: PrescriptionPerformanceContext | null
    /** Engine version for reproducibility */
    engine_version: string
}

/** Lightweight exercise reference for input_snapshot (not the full Exercise type) */
export interface PrescriptionExerciseRef {
    id: string
    name: string
    muscle_group_names: string[]
    equipment: string | null
    is_compound: boolean
    /** Adequacy level: beginner=simple free weights, intermediate=bars/cables, advanced=high technique */
    difficulty_level: 'beginner' | 'intermediate' | 'advanced'
    /** True for compound movements that should open the session (Squat, Bench, Row, etc.) */
    is_primary_movement: boolean
    /** Recommended position: first=heavy compounds, middle=accessories, last=light isolations/finishers */
    session_position: 'first' | 'middle' | 'last'
    /** Biomechanical movement pattern (squat, hinge, lunge, push_h, push_v, pull_h, pull_v, isolation, core, carry) */
    movement_pattern: string | null
    /** Broader movement family for slot matching (knee_dominant, hip_dominant, horizontal_push, etc.) */
    movement_pattern_family: string | null
    /** CNS fatigue classification: high=heavy compounds, moderate=machines/cables, low=isolation */
    fatigue_class: 'high' | 'moderate' | 'low'
    /** Coaching context for AI: why/when to pick this exercise (only for curated exercises) */
    prescription_notes: string | null
}

/** Performance data used for progressive overload decisions */
export interface PrescriptionPerformanceContext {
    /** Number of weeks with session data */
    weeks_of_history: number
    /** Average adherence over last 4 weeks (0-100) */
    recent_adherence_rate: number | null
    /** Average RPE over last 2 weeks (1-10) */
    recent_avg_rpe: number | null
    /** Exercises where load hasn't increased in 3+ weeks */
    stalled_exercise_ids: string[]
    /** Most recent program summary for comparison */
    previous_program: {
        name: string
        duration_weeks: number | null
        workout_count: number
        total_weekly_sets_per_muscle: Record<string, number>
    } | null
}

/**
 * prescription_generations.output_snapshot (JSONB)
 * The raw program structure as returned by the AI (or heuristic builder).
 * This is the canonical output format before it becomes assigned_programs rows.
 */
export interface PrescriptionOutputSnapshot {
    /** Generated program metadata */
    program: {
        name: string
        description: string
        duration_weeks: number
    }
    /** Workouts in order */
    workouts: GeneratedWorkout[]
    /** AI reasoning and rationale (for trainer review panel) */
    reasoning: PrescriptionReasoning
}

/** A single workout day in the generated program */
export interface GeneratedWorkout {
    /** Display name, e.g. "Treino A — Peito e Tríceps" */
    name: string
    /** 0-based order in the program */
    order_index: number
    /** Days of week this workout is scheduled (0=Sun, 6=Sat) */
    scheduled_days: number[]
    /** Exercises in order */
    items: GeneratedWorkoutItem[]
}

/** A single item in a generated workout (exercise, warmup, or cardio) */
export interface GeneratedWorkoutItem {
    /** Item type: 'exercise' (default), 'warmup', or 'cardio' */
    item_type?: 'exercise' | 'warmup' | 'cardio'
    /** exercise.id from the library (null for warmup/cardio) */
    exercise_id?: string | null
    /** Snapshot: exercise name at generation time (null for warmup/cardio) */
    exercise_name?: string | null
    /** Snapshot: primary muscle group (null for warmup/cardio) */
    exercise_muscle_group?: string | null
    /** Snapshot: equipment used (null for warmup/cardio) */
    exercise_equipment?: string | null
    /** Number of sets prescribed (null for warmup/cardio) */
    sets?: number | null
    /** Rep range or target, e.g. "8-12" or "10" (null for warmup/cardio) */
    reps?: string | null
    /** Rest between sets in seconds (null for warmup/cardio) */
    rest_seconds?: number | null
    /** Trainer/AI notes for this exercise */
    notes?: string | null
    /** Pre-approved substitute exercise IDs */
    substitute_exercise_ids?: string[]
    /** 0-based order within the workout */
    order_index: number
    /** Functional category of the exercise in the workout */
    exercise_function?: ExerciseFunction | null
    /** Configuration for warmup/cardio items (JSONB in DB) */
    item_config?: Record<string, unknown>
}

/** AI reasoning attached to the generated program */
export interface PrescriptionReasoning {
    /** Why this structure was chosen (e.g. "Upper/Lower — 4 dias disponíveis") */
    structure_rationale: string
    /** Volume distribution rationale */
    volume_rationale: string
    /** Per-workout decision notes (one entry per workout) */
    workout_notes: string[]
    /** Warnings or attention flags for the trainer */
    attention_flags: string[]
    /** Confidence 0-1 (matches prescription_generations.confidence_score) */
    confidence_score: number
}

/**
 * prescription_generations.rules_violations (JSONB array)
 * Violations detected by the TypeScript rules engine (pre or post-AI).
 */
export interface RulesViolation {
    /** Rule identifier, e.g. "volume_exceeds_max", "missing_compound" */
    rule_id: string
    /** Human-readable description of the violation */
    description: string
    /** Severity: 'error' blocks approval, 'warning' is informational */
    severity: 'error' | 'warning'
    /** Whether the engine was able to auto-fix this violation */
    auto_fixed: boolean
    /** Additional context (e.g. which muscle group, which workout) */
    context: {
        workout_index?: number
        exercise_id?: string
        muscle_group?: string
        actual_value?: number
        expected_range?: { min: number; max: number }
    }
}

// ============================================================================
// ROW TYPES (mirrors SQL tables for use in server actions)
// ============================================================================

/**
 * Row type for student_prescription_profiles (migration 034)
 * Matches every column exactly.
 */
export interface StudentPrescriptionProfile {
    id: string
    student_id: string
    trainer_id: string
    training_level: TrainingLevel
    goal: PrescriptionGoal
    available_days: number[]
    session_duration_minutes: number
    available_equipment: string[]
    favorite_exercise_ids: string[]
    disliked_exercise_ids: string[]
    medical_restrictions: MedicalRestriction[]
    ai_mode: AiMode
    cycle_observation?: string | null
    adherence_rate: number | null
    avg_session_duration_minutes: number | null
    last_calculated_at: string | null
    created_at: string
    updated_at: string
}

/**
 * Row type for prescription_generations (migration 035)
 * Matches every column exactly.
 */
export interface PrescriptionGeneration {
    id: string
    trainer_id: string
    student_id: string
    assigned_program_id: string | null
    ai_mode_used: AiMode
    ai_model: string
    ai_source: AiSource
    input_snapshot: PrescriptionInputSnapshot
    output_snapshot: PrescriptionOutputSnapshot | null
    rules_violations: RulesViolation[]
    status: PrescriptionStatus
    approved_at: string | null
    rejected_at: string | null
    approval_notes: string | null
    trainer_edits_count: number
    trainer_edits_diff: TrainerEditsDiff | null
    generation_time_ms: number | null
    confidence_score: number | null
    expires_at: string
    created_at: string
    updated_at: string
}

// ============================================================================
// METHODOLOGY CONSTANTS (as const for type safety in rules engine)
// ============================================================================

/**
 * Weekly volume ranges per training level (sets per muscle group).
 * PRD §2.2 — AI must always start at min; progress only after validation.
 */
export const VOLUME_RANGES = {
    beginner:     { min: 10, max: 12 },
    intermediate: { min: 12, max: 15 },
    advanced:     { min: 15, max: 20 },
} as const satisfies Record<TrainingLevel, { min: number; max: number }>

/**
 * Recommended program structure by weekly training frequency.
 * PRD §2.3 — determines split type.
 */
export const FREQUENCY_STRUCTURE = {
    2: 'full_body',
    3: 'full_body',
    4: 'upper_lower',
    5: 'ppl_plus',
    6: 'ppl_complete',
} as const satisfies Record<number, string>

/**
 * Periodization block rules (4-week cycle).
 * PRD §2.4 — linear periodization model.
 */
export const PERIODIZATION_BLOCK = {
    weeks: 4,
    week_1: { focus: 'adaptation', volume_position: 'min' },
    week_2: { focus: 'consolidation', volume_progression_if_adherence_above: 80 },
    week_3: { focus: 'overload', load_increment_kg: { lower: 2.5, upper: 5 } },
    week_4: { focus: 'deload', volume_reduction_pct: 20 },
} as const

/**
 * Absolute constraints the AI must never violate.
 * PRD §2.5 — these are validated by the rules engine, not by the AI.
 */
export const PRESCRIPTION_CONSTRAINTS = {
    /** Minimum compound exercises per training day */
    min_compounds_per_day: 1,
    /** Max isolation exercises for small muscle groups (beginners only) */
    max_isolation_small_groups_beginner: 2,
    /** Minimum rest (seconds) for heavy compound exercises */
    min_rest_seconds_compound: 60,
    /** Small muscle groups (subject to isolation limits) — exact DB names */
    small_muscle_groups: ['Bíceps', 'Tríceps', 'Panturrilha', 'Abdominais', 'Adutores', 'Antebraço', 'Trapézio'] as readonly string[],
    /** Adherence threshold for volume progression */
    adherence_threshold_for_progression: 80,
    /** Weeks of stalled load before suggesting exercise variation */
    stall_weeks_before_variation: 3,
    /** Consecutive high-fatigue days before suggesting deload */
    fatigue_days_before_deload: 3,
} as const

/**
 * Available equipment options for student profiles.
 * Used in the UI picker and to filter exercise library.
 */
export const EQUIPMENT_OPTIONS = [
    'academia_completa',
    'home_gym_basico',
    'home_gym_completo',
    'ao_ar_livre',
    'apenas_peso_corporal',
] as const

export type EquipmentOption = typeof EQUIPMENT_OPTIONS[number]

// ============================================================================
// AGENT PRESCRITOR TYPES (multi-turn Claude agent)
// ============================================================================

/** A question the agent asks the trainer before generating */
export interface PrescriptionAgentQuestion {
    /** e.g. 'q1', 'q2', 'equipment' */
    id: string
    /** The question text (in Portuguese, contextualized with student name) */
    question: string
    /** Brief explanation of why the agent is asking this */
    context: string
    /** Response format: single_choice (radio), multi_choice (checkbox), text (textarea) */
    type: 'single_choice' | 'multi_choice' | 'text'
    /** Available options for single_choice and multi_choice */
    options?: string[]
    /** Whether to show an additional free-text field below the options */
    allows_text?: boolean
    /** Placeholder for the free-text field */
    placeholder?: string
}

/** The trainer's answer to an agent question */
export interface PrescriptionAgentAnswer {
    question_id: string
    answer: string
}

/** Context analysis summary produced by the agent's first turn */
export interface PrescriptionContextAnalysis {
    /** Brief summary of student status and training history */
    student_summary: string
    /** Critical gaps identified that need clarification */
    identified_gaps: string[]
    /** Key insights from web search (if used during analysis) */
    web_search_insights: string[]
    /** Search queries the agent used */
    web_search_queries: string[]
}

/** Extended reasoning with web search evidence and Q&A trail */
export interface PrescriptionReasoningExtended extends PrescriptionReasoning {
    /** Context analysis produced during the analysis phase */
    context_analysis?: PrescriptionContextAnalysis
    /** URLs and references from web search */
    evidence_references?: string[]
    /** Questions asked and trainer's answers */
    trainer_answers?: PrescriptionAgentAnswer[]
}

/** Agent conversation state passed between server actions */
export interface PrescriptionAgentState {
    /** Full conversation history with Claude */
    conversation_messages: Array<{
        role: 'user' | 'assistant'
        content: string
    }>
    /** Analysis produced in Phase 1 */
    context_analysis: PrescriptionContextAnalysis | null
    /** Questions generated by the agent (0-3) */
    questions: PrescriptionAgentQuestion[]
    /** Trainer's answers to the questions */
    answers: PrescriptionAgentAnswer[]
    /** Current phase of the agent */
    phase: 'analyzing' | 'questions' | 'generating' | 'complete'
}

/** Max serialized size for agent state (50KB) */
export const MAX_AGENT_STATE_BYTES = 50_000

// ============================================================================
// TRAINER FEEDBACK LOOP TYPES
// ============================================================================

/** Snapshot of a single exercise item for diff comparison */
export interface TrainerEditItemSnapshot {
    exercise_id: string
    exercise_name: string
    exercise_muscle_group: string
    sets: number
    reps: string
    rest_seconds: number
}

/** A single edit detected between original AI output and trainer-approved version */
export interface TrainerEditItem {
    workout_order_index: number
    workout_name: string
    item_order_index: number
    edit_type: 'replaced' | 'added' | 'removed' | 'sets_changed' | 'reps_changed' | 'rest_changed'
    original?: TrainerEditItemSnapshot
    final?: TrainerEditItemSnapshot
}

/** Volume change per muscle group between original and final */
export interface VolumeChange {
    muscle_group: string
    original_sets: number
    final_sets: number
    /** Positive = trainer increased volume */
    delta: number
}

/** Full diff stored in prescription_generations.trainer_edits_diff (JSONB) */
export interface TrainerEditsDiff {
    total_edits: number
    item_edits: TrainerEditItem[]
    volume_changes: VolumeChange[]
    computed_at: string
}

/** A pattern detected by analyzing multiple trainer diffs */
export interface TrainerPattern {
    pattern_type: 'volume_adjustment' | 'exercise_preference' | 'exercise_removal' | 'group_deprioritized'
    occurrences: number
    total_prescriptions: number
    frequency: number
    /** Human-readable description for prompt injection */
    description: string
    context: {
        muscle_group?: string
        from_exercise_id?: string
        from_exercise_name?: string
        to_exercise_id?: string
        to_exercise_name?: string
        avg_volume_delta?: number
    }
}

/** Cached pattern analysis stored in trainers.prescription_patterns (JSONB) */
export interface TrainerPatterns {
    patterns: TrainerPattern[]
    analyzed_prescriptions: number
    last_analyzed_at: string
}
