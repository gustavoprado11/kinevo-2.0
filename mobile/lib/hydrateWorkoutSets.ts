// Movido para o shared (jun/2026) para a Sala de Treino web hidratar per-set
// com a MESMA lógica do aluno e do trainer mode mobile. Re-export mantém os
// importadores existentes do mobile intocados.
export { hydrateSetPrescriptions, type SetPrescription } from '@kinevo/shared/lib/hydrate-workout-sets';
