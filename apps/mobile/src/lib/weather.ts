/**
 * Current conditions from Open-Meteo. Free, no API key, no account.
 * Real data -- the home screen must not show an invented temperature.
 */
export type Weather = { tempC: number; labelKey: string; code: number };

/** i18n key, resolved by the caller, so the label follows the app language. */
const LABEL = (code: number): string => {
  if (code === 0) return 'weather.clear';
  if (code <= 2) return 'weather.sunny';
  if (code === 3) return 'weather.cloudy';
  if (code <= 48) return 'weather.fog';
  if (code <= 57) return 'weather.drizzle';
  if (code <= 67) return 'weather.rain';
  if (code <= 77) return 'weather.snow';
  if (code <= 82) return 'weather.showers';
  if (code <= 86) return 'weather.snowShowers';
  return 'weather.thunderstorm';
};

export async function fetchWeather(latitude: number, longitude: number): Promise<Weather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,weather_code&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    const t = j?.current?.temperature_2m;
    const code = j?.current?.weather_code;
    if (typeof t !== 'number' || typeof code !== 'number') return null;
    return { tempC: Math.round(t), labelKey: LABEL(code), code };
  } catch {
    return null; // offline is normal here; the card shows a dash
  }
}
