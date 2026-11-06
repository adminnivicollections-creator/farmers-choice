/**
 * About 1 km (two decimals). Everything that leaves the phone -- weather,
 * place names -- uses this, so only an approximate location is ever shared.
 * Land measurement keeps full GPS precision, on the phone only.
 */
export const coarse = (p: { latitude: number; longitude: number }) => ({
  latitude: Math.round(p.latitude * 100) / 100,
  longitude: Math.round(p.longitude * 100) / 100,
});
