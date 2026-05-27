import { ActionSheetIOS, Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";

export type ExerciseActionChoice =
    | "quick_edit"
    | "swap_exercise"
    | "edit_sets"
    | "duplicate"
    | "delete"
    | "cancel";

export interface OpenExerciseActionsMenuOptions {
    exerciseName: string;
    onChoose: (choice: ExerciseActionChoice) => void;
}

/**
 * Imperative API (hook-less): opens the native action sheet (iOS) or
 * Alert (Android) with the 3 actions disponíveis pro card de exercício
 * (Editar séries / Duplicar / Excluir).
 *
 * Pattern coerente com `openAIPrescriptionMenu` e `VideoUploadField`,
 * que já usam `ActionSheetIOS` nativo. Substitui o `ExerciseActionsSheet`
 * Modal custom que tinha bug de render das labels.
 *
 * Usage:
 *   openExerciseActionsMenu({ exerciseName, onChoose: (c) => { ... } });
 *
 * Excluir é marcado como destructive (vermelho no iOS).
 */
export function openExerciseActionsMenu({
    exerciseName,
    onChoose,
}: OpenExerciseActionsMenuOptions): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    const QUICK = "Editar (séries, reps, descanso)";
    const SWAP = "Trocar exercício";
    const ADVANCED = "Edição avançada";
    const DUPLICATE = "Duplicar exercício";
    const DELETE = "Excluir exercício";
    const CANCEL = "Cancelar";

    if (Platform.OS === "ios") {
        const options = [CANCEL, QUICK, SWAP, ADVANCED, DUPLICATE, DELETE];
        ActionSheetIOS.showActionSheetWithOptions(
            {
                options,
                cancelButtonIndex: 0,
                destructiveButtonIndex: 5,
                title: exerciseName,
            },
            (buttonIndex) => {
                if (buttonIndex === 0) {
                    onChoose("cancel");
                    return;
                }
                const label = options[buttonIndex];
                if (label === QUICK) onChoose("quick_edit");
                else if (label === SWAP) onChoose("swap_exercise");
                else if (label === ADVANCED) onChoose("edit_sets");
                else if (label === DUPLICATE) onChoose("duplicate");
                else if (label === DELETE) onChoose("delete");
                else onChoose("cancel");
            },
        );
        return;
    }

    // Android: Alert with 6 buttons. Style destructive funciona.
    const buttons: Array<{
        text: string;
        style?: "cancel" | "destructive" | "default";
        onPress?: () => void;
    }> = [
            { text: CANCEL, style: "cancel", onPress: () => onChoose("cancel") },
            { text: QUICK, onPress: () => onChoose("quick_edit") },
            { text: SWAP, onPress: () => onChoose("swap_exercise") },
            { text: ADVANCED, onPress: () => onChoose("edit_sets") },
            { text: DUPLICATE, onPress: () => onChoose("duplicate") },
            { text: DELETE, style: "destructive", onPress: () => onChoose("delete") },
        ];

    Alert.alert(exerciseName, undefined, buttons, { cancelable: true });
}
