// Fase 14a — Plugin Expo pra react-native-health.
// Adiciona as duas usage descriptions de HealthKit no Info.plist.
// O entitlement "com.apple.developer.healthkit" já está em app.json (ios.entitlements).
const { withInfoPlist } = require('@expo/config-plugins');

module.exports = function withHealthKit(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.NSHealthShareUsageDescription =
      'O Kinevo le seus dados de saude (sono, passos, frequencia cardiaca, HRV) ' +
      'pra mostrar suas tendencias de saude e personalizar seu coaching. ' +
      'Voce controla quais categorias compartilhar nos Ajustes do Kinevo.';

    config.modResults.NSHealthUpdateUsageDescription =
      'O Kinevo salva seus treinos no Apple Saude como exercicio de forca.';

    return config;
  });
};
