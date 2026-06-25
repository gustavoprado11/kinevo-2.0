const { withMainActivity } = require("@expo/config-plugins");

/**
 * with-health-connect-permission-delegate
 *
 * `react-native-health-connect` exige que o app registre o
 * `ActivityResultLauncher` do fluxo de permissões chamando
 * `HealthConnectPermissionDelegate.setPermissionDelegate(this)` dentro do
 * `MainActivity.onCreate`. O README da lib documenta esse passo APENAS para o
 * template React Native CLI — o config plugin oficial (`app.plugin.js`) só
 * mexe no AndroidManifest e NÃO injeta essa chamada.
 *
 * Sem o registro, `requestPermission` continua um `lateinit` não inicializado e
 * o app crasha no primeiro pedido de permissão:
 *
 *   kotlin.UninitializedPropertyAccessException: lateinit property
 *   requestPermission has not been initialized
 *     at dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate
 *        .launchPermissionsDialog (HealthConnectPermissionDelegate.kt:45)
 *
 * Como `/android` é gitignored (regenerado pelo `expo prebuild` a cada build
 * EAS), editar o MainActivity.kt na mão não persiste. Este plugin reinjeta o
 * import + a chamada toda vez que o nativo é gerado.
 *
 * O `registerForActivityResult` precisa rodar ANTES de o activity chegar a
 * RESUMED, por isso a chamada vai logo após `super.onCreate(...)`.
 */
const IMPORT =
  "import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate";
const MARKER = "kinevo-health-connect-permission-delegate";

function injectPermissionDelegate(contents) {
  if (contents.includes(MARKER)) {
    return contents; // já aplicado — idempotente
  }

  // 1) import logo após a linha `package ...`
  if (!contents.includes(IMPORT)) {
    contents = contents.replace(/^(package .+)$/m, `$1\n${IMPORT}`);
  }

  // 2) registra o launcher logo após `super.onCreate(...)` dentro do onCreate
  const superOnCreate = /^([ \t]*)super\.onCreate\([^)]*\)[ \t]*$/m;
  if (!superOnCreate.test(contents)) {
    throw new Error(
      "with-health-connect-permission-delegate: não encontrei `super.onCreate(...)` em MainActivity.kt; ajustar o plugin."
    );
  }
  contents = contents.replace(
    superOnCreate,
    (line, indent) =>
      `${line}\n` +
      `${indent}// ${MARKER}: ver mobile/plugins/with-health-connect-permission-delegate.js\n` +
      `${indent}HealthConnectPermissionDelegate.setPermissionDelegate(this)`
  );

  return contents;
}

module.exports = function withHealthConnectPermissionDelegate(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== "kt") {
      throw new Error(
        "with-health-connect-permission-delegate: MainActivity não é Kotlin; ajustar o plugin."
      );
    }
    cfg.modResults.contents = injectPermissionDelegate(cfg.modResults.contents);
    return cfg;
  });
};

// Exportado para teste do transform puro (sem rodar prebuild inteiro).
module.exports.injectPermissionDelegate = injectPermissionDelegate;
