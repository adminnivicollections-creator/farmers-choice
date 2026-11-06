const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * expo-location ships a background location service (LocationTaskService,
 * foregroundServiceType="location"). The app only reads location while it is
 * open, so the service is removed: otherwise Play Console asks for a
 * foreground-service declaration and a background-location justification.
 * Remove this plugin if background tracking is ever added.
 */
const SERVICE = 'expo.modules.location.services.LocationTaskService';

module.exports = function withoutBackgroundLocation(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] ?? 'http://schemas.android.com/tools';
    const app = manifest.application[0];
    app.service = (app.service ?? []).filter((s) => s.$['android:name'] !== SERVICE);
    app.service.push({ $: { 'android:name': SERVICE, 'tools:node': 'remove' } });
    return cfg;
  });
};
