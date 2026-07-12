'use client'

// ============================================================================
// T3: motor de persistência incremental da Sala de Treino.
// ============================================================================
// Observa o store (zustand subscribe) e espelha no servidor, série a série, o
// progresso das sessões em andamento — o padrão que o app do aluno já usa.
// Antes, tudo vivia só no localStorage até o "Concluir": crash/aba fechada/
// troca de máquina perdia o treino inteiro do treinador.
//
// Semântica:
//   • sessão vira in_progress → ensureTrainingRoomSession (find-or-create no
//     servidor; devolve set_logs existentes = RECUPERAÇÃO pós-crash, aplicados
//     sem sobrescrever progresso local).
//   • série marcada / peso-reps editados numa série concluída → upsert
//     debounced (600ms por série).
//   • série desmarcada → delete.
//   • Best-effort de verdade: falha de rede aqui não trava a Sala — o
//     "Concluir" (RPC transacional da migração 245) reata a MESMA sessão e faz
//     o catch-up idempotente de todas as séries. O cron da migração 243
//     abandona sessões órfãs de sala fechada.
// ============================================================================

import { useEffect } from 'react'
import { useTrainingRoomStore, type ActiveSession } from '@/stores/training-room-store'
import {
    ensureTrainingRoomSession,
    upsertTrainingRoomSetLog,
    deleteTrainingRoomSetLog,
} from '@/actions/training-room/persist-session'

const DEBOUNCE_MS = 600

type PendingOp = { kind: 'upsert' | 'delete'; timer: ReturnType<typeof setTimeout> }

export function useTrainingRoomPersistence() {
    useEffect(() => {
        const pending = new Map<string, PendingOp>()
        const ensuring = new Set<string>()
        let disposed = false

        const schedule = (key: string, kind: 'upsert' | 'delete', run: () => void) => {
            const existing = pending.get(key)
            if (existing) clearTimeout(existing.timer)
            const timer = setTimeout(() => {
                pending.delete(key)
                if (!disposed) run()
            }, DEBOUNCE_MS)
            pending.set(key, { kind, timer })
        }

        const ensureSession = (session: ActiveSession) => {
            if (session.serverSessionId || ensuring.has(session.studentId)) return
            ensuring.add(session.studentId)
            ensureTrainingRoomSession({
                studentId: session.studentId,
                assignedWorkoutId: session.assignedWorkoutId,
                assignedProgramId: session.assignedProgramId || null,
            })
                .then((result) => {
                    if (disposed || !result.sessionId) return
                    const store = useTrainingRoomStore.getState()
                    store.setServerSessionId(session.studentId, result.sessionId)
                    if (result.existingSetLogs.length > 0) {
                        store.applyServerSetLogs(session.studentId, result.existingSetLogs)
                    }
                })
                .catch(() => { /* best-effort; finish faz catch-up */ })
                .finally(() => { ensuring.delete(session.studentId) })
        }

        const syncSetChange = (session: ActiveSession, exerciseId: string, setIdx: number) => {
            const sessionId = session.serverSessionId
            if (!sessionId) return // ensure em voo; o finish cobre de qualquer forma
            const exercise = session.exercises.find((ex) => ex.id === exerciseId)
            if (!exercise || exercise.item_type === 'warmup') return
            const set = exercise.setsData[setIdx]
            const key = `${session.studentId}:${exerciseId}:${setIdx}`

            if (set?.completed) {
                schedule(key, 'upsert', () => {
                    void upsertTrainingRoomSetLog({
                        sessionId,
                        studentId: session.studentId,
                        setLog: {
                            assigned_workout_item_id: exercise.id,
                            planned_exercise_id: exercise.planned_exercise_id || exercise.exercise_id,
                            executed_exercise_id: exercise.exercise_id,
                            swap_source: exercise.swap_source || 'none',
                            exercise_id: exercise.exercise_id,
                            set_number: setIdx + 1,
                            weight: parseFloat(set.weight) || 0,
                            reps_completed: parseInt(set.reps) || 0,
                        },
                    })
                })
            } else {
                schedule(key, 'delete', () => {
                    void deleteTrainingRoomSetLog({
                        sessionId,
                        studentId: session.studentId,
                        assignedWorkoutItemId: exercise.id,
                        setNumber: setIdx + 1,
                    })
                })
            }
        }

        const unsubscribe = useTrainingRoomStore.subscribe((state, prevState) => {
            for (const [studentId, session] of Object.entries(state.sessions)) {
                if (session.status !== 'in_progress') continue

                const prev = prevState.sessions[studentId]

                // Sessão acabou de começar (ou chegou hidratada do localStorage
                // sem vínculo) → garante a sessão do servidor + recuperação.
                if (!session.serverSessionId) ensureSession(session)

                if (!prev || prev.exercises === session.exercises) continue

                // Diff por série: completed flip ou peso/reps de série concluída.
                const prevById = new Map(prev.exercises.map((ex) => [ex.id, ex]))
                for (const ex of session.exercises) {
                    const prevEx = prevById.get(ex.id)
                    if (!prevEx || prevEx.setsData === ex.setsData) continue
                    const len = Math.max(ex.setsData.length, prevEx.setsData.length)
                    for (let i = 0; i < len; i++) {
                        const cur = ex.setsData[i]
                        const old = prevEx.setsData[i]
                        if (!cur) continue
                        const flipped = (old?.completed ?? false) !== cur.completed
                        const editedWhileDone = cur.completed && old?.completed &&
                            (old.weight !== cur.weight || old.reps !== cur.reps)
                        if (flipped || editedWhileDone) syncSetChange(session, ex.id, i)
                    }
                }
            }
        })

        // Sessões já em andamento no mount (volta à Sala com localStorage vivo):
        // religa o vínculo/recuperação imediatamente.
        for (const session of Object.values(useTrainingRoomStore.getState().sessions)) {
            if (session.status === 'in_progress') ensureSession(session)
        }

        return () => {
            disposed = true
            unsubscribe()
            for (const op of pending.values()) clearTimeout(op.timer)
        }
    }, [])
}
