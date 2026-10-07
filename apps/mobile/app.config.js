// Reads app.json and injects secrets from the environment at build time so no
// key is ever committed. `npx expo run:android` picks this up automatically.
const base = require('./app.json').expo;

module.exports = () => ({
  ...base,
  android: {
    ...base.android,
    config: {
      googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY },
    },
  },
});
