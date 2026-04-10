import Toast from "react-native-toast-message";
import * as Haptics from "expo-haptics";

export const toast = {
  success: (title: string, message?: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({
      type: "success",
      text1: title,
      text2: message,
      visibilityTime: 3000,
    });
  },

  error: (title: string, message?: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Toast.show({
      type: "error",
      text1: title,
      text2: message,
      visibilityTime: 4000,
    });
  },

  info: (title: string, message?: string) => {
    Toast.show({
      type: "info",
      text1: title,
      text2: message,
      visibilityTime: 3000,
    });
  },
};
