/**
 * @deprecated Substituído por `openExerciseActionsMenu` em
 * `./ExerciseActionsMenu` (action sheet nativo iOS + Alert Android).
 *
 * O modal custom tinha bug visual onde as labels não renderizavam
 * (provavelmente nested Pressable + style array interferindo no flex).
 *
 * Pra deletar este arquivo definitivamente, Gustavo precisa rodar
 * `git rm mobile/components/trainer/program-builder/ExerciseActionsSheet.tsx`
 * no terminal local (bash do orchestrator não tem permissão de rm).
 */
export { openExerciseActionsMenu as ExerciseActionsSheet } from "./ExerciseActionsMenu";
