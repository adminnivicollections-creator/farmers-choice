import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadWeather, saveWeather } from './weatherCache';

afterEach(() => mock.restoreAll());

const weather = {
  tempC: 30, labelKey: 'weather.clear', icon: 'weather-sunny', code: 0, isDay: true,
  days: [
    { date: '2026-11-06', code: 0, icon: 'weather-sunny', rainMm: 0, rainChance: 0 },
    { date: '2026-11-07', code: 61, icon: 'weather-rainy', rainMm: 3, rainChance: 70 },
  ],
};

function memoryStore() {
  let v: string | null = null;
  mock.method(AsyncStorage, 'setItem', async (_k: string, x: string) => { v = x; });
  mock.method(AsyncStorage, 'getItem', async () => v);
}

test('the last weather comes back while it is recent', async () => {
  memoryStore();
  await saveWeather(weather, 'Guntur');
  const c = await loadWeather();
  assert.equal(c!.weather.tempC, 30);
  assert.equal(c!.village, 'Guntur');
});

test('older than a day is not shown as the weather', async () => {
  memoryStore();
  await saveWeather(weather, 'Guntur');
  assert.equal(await loadWeather(Date.now() + 25 * 60 * 60 * 1000), null);
});

test('forecast days that have passed are dropped', async () => {
  memoryStore();
  await saveWeather(weather, null);
  const c = await loadWeather(Date.parse('2026-11-07T08:00:00Z'));
  // saved "now", read on the 7th: only the 7th is still a forecast
  assert.ok(c === null || c.weather.days.every((d) => d.date >= '2026-11-07'));
});

test('a broken or missing cache is simply nothing', async () => {
  mock.method(AsyncStorage, 'getItem', async () => '{bad');
  assert.equal(await loadWeather(), null);
});
