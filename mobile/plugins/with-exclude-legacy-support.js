const { withProjectBuildGradle } = require("@expo/config-plugins");

/**
 * with-exclude-legacy-support
 *
 * `@react-native-voice/voice@3.2.4` declara, no seu android/build.gradle,
 * `implementation "com.android.support:appcompat-v7:..."` — a Support Library
 * LEGADA (pré-AndroidX). No Expo 54 / AGP 8 isso arrasta
 * com.android.support:{animated-vector-drawable,support-vector-drawable,
 * versionedparcelable}:28.0.0, que colidem de namespace com o AndroidX e
 * quebram o merge de manifesto (`:app:processReleaseMainManifest FAILED:
 * "Namespace 'android.support.graphics.drawable' is used in multiple modules"`).
 *
 * O código da lib NÃO referencia nenhuma classe android.support.* (usa
 * android.speech.SpeechRecognizer, do framework), então remover o grupo legado
 * é seguro: o build passa e a voz continua funcionando.
 *
 * Aplicado em allprojects para cobrir tanto :app quanto o módulo da lib.
 */
const MARKER = "kinevo-exclude-legacy-support";

const BLOCK = `
// ${MARKER}: ver mobile/plugins/with-exclude-legacy-support.js
allprojects {
    configurations.all {
        exclude group: 'com.android.support'
    }
}
`;

module.exports = function withExcludeLegacySupport(config) {
    return withProjectBuildGradle(config, (cfg) => {
        if (cfg.modResults.language !== "groovy") {
            throw new Error(
                "with-exclude-legacy-support: android/build.gradle não é groovy; ajustar o plugin."
            );
        }
        if (!cfg.modResults.contents.includes(MARKER)) {
            cfg.modResults.contents += BLOCK;
        }
        return cfg;
    });
};
