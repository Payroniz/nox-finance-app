module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 delegates its Babel transform to Worklets. Keeping the
    // plugin path explicit also works when Dependabot updates Worklets.
    plugins: ['react-native-worklets/plugin'],
  };
};
