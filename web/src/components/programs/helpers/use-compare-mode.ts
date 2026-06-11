'use client'

// Modo "comparar com programa anterior" — estado e handlers idênticos nos
// dois builders, extraídos pra cá. A lista só carrega quando há um aluno em
// contexto (no builder de template puro não existe histórico pra comparar).

import { useCallback, useMemo, useState } from 'react'
import type { Exercise } from '@/types/exercise'
import {
    getPastProgramsForStudent,
    getFullProgramForCompare,
    type CompareProgramSummary,
    type CompareProgramData,
} from '@/actions/programs/get-program-for-compare'
import { compareWorkoutToWorkout } from '@/lib/workouts/transformPastWorkout'
import type { Workout } from '../builder-model'

export interface UseCompareModeOptions {
    /** Aluno cujo histórico alimenta a lista. null = não carrega (builder sem contexto). */
    studentId: string | null
    /** Biblioteca local pra anexar `exercise` aos itens convertidos. */
    exercises: Exercise[]
    /** Transição de view mode fica a cargo do client (enter→'compare', exit→'normal'). */
    onEnter: () => void
    onExit: () => void
}

export function useCompareMode({ studentId, exercises, onEnter, onExit }: UseCompareModeOptions) {
    const [compareProgramsList, setCompareProgramsList] = useState<CompareProgramSummary[]>([])
    const [compareProgramsLoading, setCompareProgramsLoading] = useState(false)
    const [compareProgramsLoaded, setCompareProgramsLoaded] = useState(false)
    const [compareSelectedProgramId, setCompareSelectedProgramId] = useState<string | null>(null)
    const [compareProgramData, setCompareProgramData] = useState<CompareProgramData | null>(null)
    const [compareProgramLoading, setCompareProgramLoading] = useState(false)
    const [compareWorkouts, setCompareWorkouts] = useState<Workout[]>([])
    const [compareActiveWorkoutId, setCompareActiveWorkoutId] = useState<string | null>(null)

    const compareActiveWorkout = useMemo(
        () => compareWorkouts.find(w => w.id === compareActiveWorkoutId) || null,
        [compareWorkouts, compareActiveWorkoutId],
    )

    const handleEnterCompare = useCallback(() => {
        onEnter()
        if (studentId && !compareProgramsLoaded) {
            setCompareProgramsLoading(true)
            getPastProgramsForStudent(studentId)
                .then((result) => {
                    setCompareProgramsList(result.data || [])
                    setCompareProgramsLoaded(true)
                })
                .catch(() => {
                    setCompareProgramsList([])
                    setCompareProgramsLoaded(true)
                })
                .finally(() => setCompareProgramsLoading(false))
        }
    }, [studentId, compareProgramsLoaded, onEnter])

    const handleSelectCompareProgram = useCallback((programId: string) => {
        setCompareSelectedProgramId(programId)
        setCompareProgramLoading(true)
        getFullProgramForCompare(programId)
            .then((result) => {
                const data = result.data || null
                setCompareProgramData(data)
                if (data && data.workouts.length > 0) {
                    const converted = data.workouts.map(cw => compareWorkoutToWorkout(cw, exercises))
                    setCompareWorkouts(converted)
                    setCompareActiveWorkoutId(converted[0].id)
                } else {
                    setCompareWorkouts([])
                    setCompareActiveWorkoutId(null)
                }
            })
            .catch(() => {
                setCompareProgramData(null)
                setCompareWorkouts([])
                setCompareActiveWorkoutId(null)
            })
            .finally(() => setCompareProgramLoading(false))
    }, [exercises])

    const handleExitCompare = useCallback(() => {
        onExit()
    }, [onExit])

    return {
        compareProgramsList,
        compareProgramsLoading,
        compareSelectedProgramId,
        compareProgramData,
        compareProgramLoading,
        compareWorkouts,
        compareActiveWorkoutId,
        setCompareActiveWorkoutId,
        compareActiveWorkout,
        handleEnterCompare,
        handleSelectCompareProgram,
        handleExitCompare,
    }
}
