/**
 * Current conditions from Open-Meteo. Free, no API key, no account.
 * Real data -- the home screen must not show an invented temperature.
 */
export type Weather = { tempC: number; labelKey: string; icon: string; code: number; isDay: boolean };

/**
 * WMO weather code -> i18n key and MaterialCommunityIcons name. The label is
 * resolved by the caller so it follows the app language. Night matters: a sun
 * on a clear 9 PM sky is a wrong reading of real data.
 */
export function describe(code: number, isDay: boolean): { labelKey: string; icon: string } {
  if (code <= 2) {
    if (!isDay) return { labelKey: 'weather.clear', icon: code === 0 ? 'weather-night' : 'weather-night-partly-cloudy' };
    return code === 0
      ? { labelKey: 'weather.clear', icon: 'weather-sunny' }
      : { labelKey: 'weather.sunny', icon: 'weather-partly-cloudy' };
  }
  if (code === 3) return { labelKey: 'weather.cloudy', icon: 'weather-cloudy' };
  if (code <= 48) return { labelKey: 'weather.fog', icon: 'weather-fog' };
  if (code <= 57) return { labelKey: 'weather.drizzle', icon: 'weather-rainy' };
  if (code <= 67) return { labelKey: 'weather.rain', icon: 'weather-rainy' };
  if (code <= 77) return { labelKey: 'weather.snow', icon: 'weather-snowy' };
  if (code <= 82) return { labelKey: 'weather.showers', icon: 'weather-pouring' };
  if (code <= 86) return { labelKey: 'weather.snowShowers', icon: 'weather-snowy-heavy' };
  return { labelKey: 'weather.thunderstorm', icon: 'weather-lightning-rainy' };
}

/** A hung request must not leave the card on a spinner forever. */
const TIMEOUT_MS = 10_000;

export async function fetchWeather(latitude: number, longitude: number): Promise<Weather | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const j = await res.json();
    const t = j?.current?.temperature_2m;
    const code = j?.current?.weather_code;
    if (typeof t !== 'number' || typeof code !== 'number') return null;
    const isDay = j?.current?.is_day !== 0;
    return { tempC: Math.round(t), code, isDay, ...describe(code, isDay) };
  } catch {
    return null; // offline is normal here; the card shows a dash
  } finally {
    clearTimeout(timer);
  }
}
