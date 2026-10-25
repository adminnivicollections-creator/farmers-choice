/**
 * Current conditions and forecast. OpenWeather when a key is configured
 * (Open-Meteo's free tier is non-commercial only, and this app shows ads);
 * Open-Meteo otherwise, and as the fallback when OpenWeather fails, so the
 * card never goes blank because of a key or quota problem.
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

const OWM_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_KEY;

export async function fetchWeather(latitude: number, longitude: number): Promise<Weather | null> {
  return (OWM_KEY ? await fetchOpenWeather(latitude, longitude, OWM_KEY) : null)
    ?? fetchOpenMeteo(latitude, longitude);
}

async function getJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOpenWeather(latitude: number, longitude: number, key: string): Promise<Weather | null> {
  const q = `lat=${latitude.toFixed(2)}&lon=${longitude.toFixed(2)}&units=metric&appid=${key}`;
  const [now, fc] = await Promise.all([
    getJson(`https://api.openweathermap.org/data/2.5/weather?${q}`),
    getJson(`https://api.openweathermap.org/data/2.5/forecast?${q}`),
  ]);
  const t = now?.main?.temp;
  const id = now?.weather?.[0]?.id;
  if (typeof t !== 'number' || typeof id !== 'number') return null;
  const code = owmToWmo(id);
  const isDay = !String(now.weather[0].icon ?? '').endsWith('n');
  return { tempC: Math.round(t), code, isDay, ...describe(code, isDay), days: daysFromOwm(fc) };
}

/** OpenWeather condition id -> the WMO code the rest of the app speaks. */
export function owmToWmo(id: number): number {
  if (id >= 200 && id < 300) return 95;          // thunderstorm
  if (id >= 300 && id < 400) return 53;          // drizzle
  if (id === 500) return 61;                     // light rain
  if (id === 501) return 63;                     // moderate rain
  if (id >= 502 && id <= 511) return 65;         // heavy rain
  if (id >= 520 && id < 600) return 81;          // showers
  if (id >= 600 && id < 700) return 71;          // snow / sleet
  if (id >= 700 && id < 800) return 45;          // mist, haze, fog, dust
  if (id === 800) return 0;
  if (id === 801) return 1;
  if (id === 802) return 2;
  return 3;                                      // 803/804: cloudy
}

/** 3-hourly forecast -> one row per local day: rain summed, chance and severity maxed. */
export function daysFromOwm(fc: any): Day[] {
  const list: any[] = Array.isArray(fc?.list) ? fc.list : [];
  const tz = Number(fc?.city?.timezone ?? 0);
  const byDate = new Map<string, { code: number; rain: number; pop: number }>();
  for (const e of list) {
    const id = e?.weather?.[0]?.id;
    if (typeof e?.dt !== 'number' || typeof id !== 'number') continue;
    const date = new Date((e.dt + tz) * 1000).toISOString().slice(0, 10);
    const d = byDate.get(date) ?? { code: 0, rain: 0, pop: 0 };
    d.code = Math.max(d.code, owmToWmo(id));
    d.rain += Number(e.rain?.['3h'] ?? 0);
    d.pop = Math.max(d.pop, Number(e.pop ?? 0));
    byDate.set(date, d);
  }
  return [...byDate].map(([date, d]) => ({
    date, code: d.code, icon: describe(d.code, true).icon,
    rainMm: Math.round(d.rain * 10) / 10, rainChance: Math.round(d.pop * 100),
  }));
}

async function fetchOpenMeteo(latitude: number, longitude: number): Promise<Weather | null> {
  // Two decimals is about 1 km: the same weather, without handing a third
  // party the farmer's exact spot.
  const j = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(2)}&longitude=${longitude.toFixed(2)}` +
    `&current=temperature_2m,weather_code,is_day` +
    `&daily=weather_code,precipitation_sum,precipitation_probability_max&forecast_days=7&timezone=auto`,
  );
  const t = j?.current?.temperature_2m;
  const code = j?.current?.weather_code;
  if (typeof t !== 'number' || typeof code !== 'number') return null;
  const isDay = j?.current?.is_day !== 0;
  return { tempC: Math.round(t), code, isDay, ...describe(code, isDay), days: daysFrom(j?.daily) };
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
/** Heavy rain is worth knowing about all week: harvest, drainage, sowing. */
const HEAVY_MM = 50;

/**
 * The day to warn about, if any: heavy rain anywhere in the week comes first
 * (a 72 mm Thursday matters more than a likely 2 mm Tuesday), else the first
 * rainy day in the next three -- the window that matters for spraying and urea.
 */
export function rainAlert(days: Day[]): Day | null {
  return days.find((d) => d.rainMm >= HEAVY_MM)
    ?? days.slice(0, 3).find((d) => d.rainMm >= RAIN_MM || (d.rainChance ?? 0) >= RAIN_CHANCE)
    ?? null;
}
