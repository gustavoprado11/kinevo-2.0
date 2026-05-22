// Compat shim — o WorkoutCelebration foi refatorado para celebration/ (3 variações
// com rotação diária). Re-exporta pra não quebrar imports existentes
// (app/workout/[id].tsx). Após estabilizar, migrar o import e remover este arquivo.
export { WorkoutCelebration, type CelebrationData } from './celebration/WorkoutCelebration';
