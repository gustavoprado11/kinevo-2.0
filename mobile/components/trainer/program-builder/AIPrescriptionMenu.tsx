import { ActionSheetIOS, Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";

export type AIPrescriptionMenuChoice =
    | "ai_full"
    | "text_paste"
    | "select_existing"
    | "cancel";

export interface OpenAIPrescriptionMenuOptions {
    /** When false, the "Gerar programa completo" entry is hidden from the menu. */
    aiEnabled: boolean;
    onChoose: (choice: AIPrescriptionMenuChoice) => void;
}

/**
 * Imperative API (hook-less): opens the native action sheet (iOS) or Alert
 * (Android) with the three IA entry points the program-builder header uses.
 *
 * Usage:
 *   openAIPrescriptionMenu({ aiEnabled, onChoose: (c) => { ... } })
 *
 * The function fires a Haptic.Medium when invoked. The caller does NOT need
 * to render anything — the menu is platform-native.
 */
export function openAIPrescriptionMenu({ aiEnabled, onChoose }: OpenAIPrescriptionMenuOptions): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const TEXT_PASTE = "Colar texto de treino";
    const SELECT_EXISTING = "Selecionar programa existente";
    const AI_FULL = "Gerar programa completo";
    const CANCEL = "Cancelar";

    if (Platform.OS === "ios") {
        const options = aiEnabled
            ? [CANCEL, AI_FULL, TEXT_PASTE, SELECT_EXISTING]
            : [CANCEL, TEXT_PASTE, SELECT_EXISTING];
        ActionSheetIOS.showActionSheetWithOptions(
            {
                options,
                cancelButtonIndex: 0,
                title: "Como deseja prescrever?",
            },
            (buttonIndex) => {
                if (buttonIndex === 0) {
                    onChoose("cancel");
                    return;
                }
                const label = options[buttonIndex];
                if (label === AI_FULL) onChoose("ai_full");
                else if (label === TEXT_PASTE) onChoose("text_paste");
                else if (label === SELECT_EXISTING) onChoose("select_existing");
                else onChoose("cancel");
            },
        );
        return;
    }

    // Android: Alert with up to 4 buttons.
    const buttons: Array<{ text: string; style?: "cancel" | "default"; onPress?: () => void }> = [
        { text: CANCEL, style: "cancel", onPress: () => onChoose("cancel") },
    ];
    if (aiEnabled) {
        buttons.push({ text: AI_FULL, onPress: () => onChoose("ai_full") });
    }
    buttons.push({ text: TEXT_PASTE, onPress: () => onChoose("text_paste") });
    buttons.push({ text: SELECT_EXISTING, onPress: () => onChoose("select_existing") });

    Alert.alert("Como deseja prescrever?", undefined, buttons, { cancelable: true });
}
