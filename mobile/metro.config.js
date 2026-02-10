const { getDefaultConfig } = require("expo/metro-config");

const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Ignorar arquivos de resource fork do macOS
config.resolver.blockList = [
    /.*\/\._.*/,
    /.*\/\.__.*/,
];

const path = require("path");

// Encotra o diretório raiz do workspace (onde está o node_modules compartilhado)
const workspaceRoot = path.resolve(__dirname, "../");
const projectRoot = __dirname;

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: "./global.css" });
