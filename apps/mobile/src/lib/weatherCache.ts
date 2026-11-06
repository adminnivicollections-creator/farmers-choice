import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Weather } from './weather';

/**
 * The last good weather, kept on the phone so a farmer out of signal sees it
 * (marked with when it was fetched) instead of "couldn't load".
 */
const KEY = 'fc.weather.v1';
/** Older than this is no longer worth showing as "the weather". */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type CachedWeather = { weather: Weather; village: string | null; at: number };

export async function saveWeather(weather: Weather, village: string | null) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify({ weather, village, at: Date.now() })); } catch { /* a nicety */ }
}

export async function loadWeather(now = Date.now()): Promise<CachedWeather | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const c: CachedWeather = JSON.parse(raw);
    if (!(now - c.at < MAX_AGE_MS)) return null;
    // Days that have already passed are no longer a forecast.
    const today = new Date(now).toISOString().slice(0, 10);
    return { ...c, weather: { ...c.weather, days: c.weather.days.filter((d) => d.date >= today) } };
  } catch {
    return null;
  }
}
