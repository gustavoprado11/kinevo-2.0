import { ActionSheetIOS, Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";

export type ProgramTemplateActionChoice =
    | "edit"
    | "assign"
    | "duplicate"
    | "delete"
    | "cancel";

export interface OpenProgramTemplateActionsMenuOptions {
    templateName: string;
    onChoose: (choice: ProgramTemplateActionChoice) => void;
}

/**
 * Imperative API (hook-less): opens the native action sheet (iOS) or Alert
 * (Android) with the actions available for a template library card
 * (Editar / Atribuir a aluno / Duplicar / Excluir). Mirrors
 * `openExerciseActionsMenu`.
 */
export function openProgramTemplateActionsMenu({
    templateName,
    onChoose,
}: OpenProgramTemplateActionsMenuOptions): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    const EDIT = "Editar modelo";
    const ASSIGN = "Atribuir a aluno";
    const DUPLICATE = "Duplicar modelo";
    const DELETE = "Excluir modelo";
    const CANCEL = "Cancelar";

    if (Platform.OS === "ios") {
        const options = [CANCEL, EDIT, ASSIGN, DUPLICATE, DELETE];
        ActionSheetIOS.showActionSheetWithOptions(
            {
                options,
                cancelButtonIndex: 0,
                destructiveButtonIndex: 4,
                title: templateName,
            },
            (buttonIndex) => {
                if (buttonIndex === 0) {
                    onChoose("cancel");
                    return;
                }
                const label = options[buttonIndex];
                if (label === EDIT) onChoose("edit");
                else if (label === ASSIGN) onChoose("assign");
                else if (label === DUPLICATE) onChoose("duplicate");
                else if (label === DELETE) onChoose("delete");
                else onChoose("cancel");
            },
        );
        return;
    }

    const buttons: Array<{
        text: string;
        style?: "cancel" | "destructive" | "default";
        onPress?: () => void;
    }> = [
            { text: CANCEL, style: "cancel", onPress: () => onChoose("cancel") },
            { text: EDIT, onPress: () => onChoose("edit") },
            { text: ASSIGN, onPress: () => onChoose("assign") },
            { text: DUPLICATE, onPress: () => onChoose("duplicate") },
            { text: DELETE, style: "destructive", onPress: () => onChoose("delete") },
        ];

    Alert.alert(templateName, undefined, buttons, { cancelable: true });
}
