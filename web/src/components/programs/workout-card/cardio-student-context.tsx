'use client'

import { createContext, useContext } from 'react'

/**
 * FCmáx do aluno em foco no builder (students.max_heart_rate_bpm), para o
 * CardioItemCard resolver "Zona N" em bpm. Null = sem aluno em contexto
 * (builder de template) ou FCmáx não cadastrada → exibição em %FCmáx.
 * Contexto (e não prop) para não atravessar o registry de cards.
 */
export const CardioStudentHrContext = createContext<number | null>(null)

export function useCardioStudentMaxHr(): number | null {
    return useContext(CardioStudentHrContext)
}

/**
 * Duração do programa em semanas (duration_weeks) no builder — dimensiona a
 * régua da progressão semanal do bloco aeróbio. Null = sem duração definida.
 * Mesmo racional de contexto do FCmáx (não atravessa o registry de cards).
 */
export const CardioProgramWeeksContext = createContext<number | null>(null)

export function useCardioProgramWeeks(): number | null {
    return useContext(CardioProgramWeeksContext)
}
