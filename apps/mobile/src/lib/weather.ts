/**
 * Current conditions from Open-Meteo. Free, no API key, no account.
 * Real data -- the home screen must not show an invented temperature.
 */
export type Weather = { tempC: number; label: string; code: number };

const LABEL = (code: number): string => {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Sunny';
  if (code === 3) return 'Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
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
    return { tempC: Math.round(t), label: LABEL(code), code };
  } catch {
    return null; // offline is normal here; the card shows a dash
  }
}
