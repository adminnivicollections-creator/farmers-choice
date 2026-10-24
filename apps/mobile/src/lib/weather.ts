/**
 * Current conditions from Open-Meteo. Free, no API key, no account.
 * Real data -- the home screen must not show an invented temperature.
 */
export type Day = { date: string; code: number; icon: string; rainMm: number; rainChance: number | null };
export type Weather = {
  tempC: number; labelKey: string; icon: string; code: number; isDay: boolean;
  /** Today and the next 6 days. */
  days: Day[];
};

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
    // Two decimals is about 1 km: the same weather, without handing a third
    // party the farmer's exact spot.
    const lat = latitude.toFixed(2), lon = longitude.toFixed(2);
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,is_day` +
      `&daily=weather_code,precipitation_sum,precipitation_probability_max&forecast_days=7&timezone=auto`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const j = await res.json();
    const t = j?.current?.temperature_2m;
    const code = j?.current?.weather_code;
    if (typeof t !== 'number' || typeof code !== 'number') return null;
    const isDay = j?.current?.is_day !== 0;
    return { tempC: Math.round(t), code, isDay, ...describe(code, isDay), days: daysFrom(j?.daily) };
  } catch {
    return null; // offline is normal here; the card shows a dash
  } finally {
    clearTimeout(timer);
  }
}

/** Open-Meteo's parallel daily arrays -> one row per day. Missing data is dropped, not guessed. */
export function daysFrom(d: any): Day[] {
  const dates: string[] = Array.isArray(d?.time) ? d.time : [];
  return dates.flatMap((date, i) => {
    const code = d.weather_code?.[i];
    const rain = d.precipitation_sum?.[i];
    if (typeof code !== 'number' || typeof rain !== 'number') return [];
    const chance = d.precipitation_probability_max?.[i];
    return [{ date, code, icon: describe(code, true).icon, rainMm: rain, rainChance: typeof chance === 'number' ? chance : null }];
  });
}

/** At least this much rain, or this likely, is worth warning about. */
const RAIN_MM = 5;
const RAIN_CHANCE = 60;

/** The first rainy day in the next three, if any: the window that matters for spraying and urea. */
export function rainAlert(days: Day[]): Day | null {
  return days.slice(0, 3).find((d) => d.rainMm >= RAIN_MM || (d.rainChance ?? 0) >= RAIN_CHANCE) ?? null;
}
