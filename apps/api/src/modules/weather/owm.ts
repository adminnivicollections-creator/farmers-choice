/**
 * Pure OpenWeather -> app shape. No Nest, no network: testable on its own.
 * The app speaks WMO weather codes (it shares them with its Open-Meteo
 * fallback), so OpenWeather's condition ids are mapped onto them here.
 */

export type Day = { date: string; code: number; rainMm: number; rainChance: number | null };
export type Weather = { tempC: number; code: number; isDay: boolean; days: Day[] };

/** OpenWeather condition id -> WMO weather code. */
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
    date, code: d.code, rainMm: Math.round(d.rain * 10) / 10, rainChance: Math.round(d.pop * 100),
  }));
}

/** Current + forecast responses -> the app's Weather, or null if current is unusable. */
export function toWeather(now: any, fc: any): Weather | null {
  const t = now?.main?.temp;
  const id = now?.weather?.[0]?.id;
  if (typeof t !== 'number' || typeof id !== 'number') return null;
  return {
    tempC: Math.round(t),
    code: owmToWmo(id),
    isDay: !String(now.weather[0].icon ?? '').endsWith('n'),
    days: daysFromOwm(fc),
  };
}
