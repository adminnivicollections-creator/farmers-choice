const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * react-native-google-mobile-ads sets its compileSdk through the third-party
 * `io.invertase.gradle.build` 1.5 plugin, which no longer applies under
 * Gradle 9 / AGP 8.13. The library module then has no compileSdk and the build
 * fails at configuration time.
 *
 * This fills it in for any subproject that is missing one, rather than pinning
 * the whole app to an older toolchain. Remove once the library ships a fix.
 */
const SNIPPET = `
// injected by plugins/withAndroidCompileSdkFix.js
// The same stale invertase plugin also fails to define this. The library reads
// it unguarded, so give it an explicit null -- that selects the "classic" SDK
// path, which is what we want. The AdMob app id reaches the manifest through
// the library's own Expo plugin, not through here.
if (!rootProject.ext.has("googleMobileAdsJson")) {
    rootProject.ext.googleMobileAdsJson = null
}
subprojects { subproject ->
    afterEvaluate {
        if (subproject.plugins.hasPlugin("com.android.library")) {
            def ext = subproject.extensions.findByName("android")
            if (ext != null && ext.compileSdkVersion == null) {
                ext.compileSdkVersion rootProject.ext.compileSdkVersion
                if (ext.buildToolsVersion == null) {
                    ext.buildToolsVersion rootProject.ext.buildToolsVersion
                }
            }
        }
    }
}
`;

module.exports = function withAndroidCompileSdkFix(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    if (cfg.modResults.contents.includes('withAndroidCompileSdkFix')) return cfg;

    // Must run BEFORE the subprojects are evaluated. Appending to the end of
    // the file is too late -- Gradle has already evaluated some of them.
    const anchor = 'apply plugin: "com.facebook.react.rootproject"';
    cfg.modResults.contents = cfg.modResults.contents.includes(anchor)
      ? cfg.modResults.contents.replace(anchor, SNIPPET + '\n' + anchor)
      : SNIPPET + '\n' + cfg.modResults.contents;
    return cfg;
  });
};
