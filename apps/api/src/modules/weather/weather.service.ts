import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Weather, toWeather } from './owm';

const TTL_MS = 10 * 60 * 1000;
/**
 * ponytail: in-memory cache, per process. Fine for one Render instance; move
 * to Redis if the API ever runs on several instances.
 */
const MAX_ENTRIES = 5000;

/**
 * OpenWeather, behind our server so the key never ships in the APK. Cached
 * per ~1 km cell for 10 minutes: a village full of farmers opening the app is
 * one upstream call, which keeps us far inside the free quota.
 */
@Injectable()
export class WeatherService {
  private cache = new Map<string, { at: number; data: Weather }>();

  constructor(private config: ConfigService) {}

  async forecast(lat: number, lon: number): Promise<Weather> {
    const key = this.config.get<string>('OPENWEATHER_KEY');
    if (!key) throw new ServiceUnavailableException('Weather is not configured');

    // Two decimals is about 1 km: the same weather, and the cache key.
    const cell = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const hit = this.cache.get(cell);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

    const q = `lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&units=metric&appid=${key}`;
    const [now, fc] = await Promise.all([
      this.getJson(`https://api.openweathermap.org/data/2.5/weather?${q}`),
      this.getJson(`https://api.openweathermap.org/data/2.5/forecast?${q}`),
    ]);
    const data = toWeather(now, fc);
    // The app falls back to another source on 503; never cache a failure.
    if (!data) throw new ServiceUnavailableException('Weather is not available right now');

    if (this.cache.size >= MAX_ENTRIES) this.cache.clear();
    this.cache.set(cell, { at: Date.now(), data });
    return data;
  }

  private async getJson(url: string): Promise<any | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }
}
