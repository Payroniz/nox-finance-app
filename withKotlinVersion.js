const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withKotlinVersion(config, targetVersion = '1.9.25') {
  return withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    config.modResults.contents = contents.replace(
      /kotlinVersion\s*=\s*["']1\.9\.\d+["']/,
      `kotlinVersion = "${targetVersion}"`
    );
    return config;
  });
};
