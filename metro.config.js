const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite web worker'ının WASM ikilisini asset olarak paketle.
config.resolver.assetExts.push('wasm');

module.exports = config;
