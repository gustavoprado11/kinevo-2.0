import { ActionSheetIOS, Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";

export type ExerciseActionChoice =
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

    const EDIT = "Editar séries";
    const DUPLICATE = "Duplicar exercício";
    const DELETE = "Excluir exercício";
    const CANCEL = "Cancelar";

    if (Platform.OS === "ios") {
        const options = [CANCEL, EDIT, DUPLICATE, DELETE];
        ActionSheetIOS.showActionSheetWithOptions(
            {
                options,
                cancelButtonIndex: 0,
                destructiveButtonIndex: 3,
                title: exerciseName,
            },
            (buttonIndex) => {
                if (buttonIndex === 0) {
                    onChoose("cancel");
                    return;
                }
                const label = options[buttonIndex];
                if (label === EDIT) onChoose("edit_sets");
                else if (label === DUPLICATE) onChoose("duplicate");
                else if (label === DELETE) onChoose("delete");
                else onChoose("cancel");
            },
        );
        return;
    }

    // Android: Alert with 4 buttons. Style destructive funciona.
    const buttons: Array<{
        text: string;
        style?: "cancel" | "destructive" | "default";
        onPress?: () => void;
    }> = [
            { text: CANCEL, style: "cancel", onPress: () => onChoose("cancel") },
            { text: EDIT, onPress: () => onChoose("edit_sets") },
            { text: DUPLICATE, onPress: () => onChoose("duplicate") },
            { text: DELETE, style: "destructive", onPress: () => onChoose("delete") },
        ];

    Alert.alert(exerciseName, undefined, buttons, { cancelable: true });
}
