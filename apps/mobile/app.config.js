// Reads app.json and injects secrets from the environment at build time so no
// key is ever committed. `npx expo run:android` picks this up automatically.
const base = require('./app.json').expo;

const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;

// Without the key, prebuild silently leaves it out of AndroidManifest.xml and
// the app crashes ("API key not found") the moment Land measurement opens.
// Only commands that generate the native project bake the key in, so Metro
// (`expo start`) keeps working without one.
const generatesNative =
  !!process.env.EAS_BUILD || process.argv.some((a) => ['prebuild', 'run:android', 'run:ios'].includes(a));

if (!mapsKey && generatesNative) {
  throw new Error(
    'EXPO_PUBLIC_GOOGLE_MAPS_KEY is not set. Put it in apps/mobile/.env (see .env.example) ' +
      'before building -- without it the app crashes when Land measurement opens.',
  );
}

module.exports = () => ({
  ...base,
  android: {
    ...base.android,
    config: {
      googleMaps: { apiKey: mapsKey },
    },
  },
});
