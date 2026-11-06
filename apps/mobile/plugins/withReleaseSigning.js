const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Release builds signed with the Play upload key instead of the debug key.
 *
 * The key and its passwords never enter the repo: they're read from Gradle
 * properties, normally ~/.gradle/gradle.properties on the build machine:
 *
 *   FC_UPLOAD_STORE_FILE=/Users/you/keys/farmers-choice-upload.jks
 *   FC_UPLOAD_STORE_PASSWORD=...
 *   FC_UPLOAD_KEY_ALIAS=upload
 *   FC_UPLOAD_KEY_PASSWORD=...
 *
 * Without them, release APKs still build with the debug key (for sideloading),
 * but a Play bundle (bundleRelease) refuses to build: Play rejects
 * debug-signed uploads, and catching it here beats catching it in the console.
 */
const MARK = '// withReleaseSigning';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (cfg.modResults.language !== 'groovy' || g.includes(MARK)) return cfg;

    g = g.replace(
      /signingConfigs \{\n(\s*)debug \{/,
      (m, indent) => `signingConfigs {
${indent}${MARK}
${indent}release {
${indent}    if (findProperty('FC_UPLOAD_STORE_FILE')) {
${indent}        storeFile file(findProperty('FC_UPLOAD_STORE_FILE'))
${indent}        storePassword findProperty('FC_UPLOAD_STORE_PASSWORD')
${indent}        keyAlias findProperty('FC_UPLOAD_KEY_ALIAS')
${indent}        keyPassword findProperty('FC_UPLOAD_KEY_PASSWORD')
${indent}    }
${indent}}
${indent}debug {`,
    );

    // The release build type is the second "signingConfig signingConfigs.debug".
    let seen = 0;
    g = g.replace(/signingConfig signingConfigs\.debug/g, (m) =>
      ++seen === 2
        ? "signingConfig findProperty('FC_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug"
        : m,
    );

    g += `
${MARK}: a Play bundle must never be signed with the debug key.
gradle.taskGraph.whenReady { graph ->
    if (!findProperty('FC_UPLOAD_STORE_FILE') && graph.allTasks.any { it.name == 'bundleRelease' }) {
        throw new GradleException('No upload key: set FC_UPLOAD_STORE_FILE and friends in ~/.gradle/gradle.properties (see plugins/withReleaseSigning.js)')
    }
}
`;
    cfg.modResults.contents = g;
    return cfg;
  });
};
