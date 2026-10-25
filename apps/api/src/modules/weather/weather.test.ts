import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceUnavailableException } from '@nestjs/common';
import { daysFromOwm, owmToWmo, toWeather } from './owm';
import { WeatherService } from './weather.service';

afterEach(() => mock.restoreAll());

const now = { main: { temp: 25.19 }, weather: [{ id: 804, icon: '04d' }] };
const ist = 19800;
const at = (iso: string) => Date.parse(iso) / 1000 - ist;
const fc = { city: { timezone: ist }, list: [
  { dt: at('2026-10-28T02:00:00Z'), weather: [{ id: 500 }], rain: { '3h': 2.5 }, pop: 0.4 },
  { dt: at('2026-10-28T23:00:00Z'), weather: [{ id: 211 }], rain: { '3h': 40 }, pop: 0.9 },
  { dt: at('2026-10-29T01:00:00Z'), weather: [{ id: 800 }], pop: 0 },
] };

test('OpenWeather ids map to WMO codes', () => {
  assert.equal(owmToWmo(800), 0);
  assert.equal(owmToWmo(804), 3);
  assert.equal(owmToWmo(501), 63);
  assert.equal(owmToWmo(211), 95);
  assert.equal(owmToWmo(721), 45);
});

test('3-hourly slots become local days, rain summed, worst condition kept', () => {
  const days = daysFromOwm(fc);
  assert.deepEqual(days, [
    { date: '2026-10-28', code: 95, rainMm: 42.5, rainChance: 90 },
    { date: '2026-10-29', code: 0, rainMm: 0, rainChance: 0 },
  ]);
  assert.deepEqual(daysFromOwm(null), []);
});

test('current conditions: rounded temperature, day or night from the icon', () => {
  assert.deepEqual(toWeather(now, null), { tempC: 25, code: 3, isDay: true, days: [] });
  assert.equal(toWeather({ ...now, weather: [{ id: 800, icon: '01n' }] }, null)!.isDay, false);
  assert.equal(toWeather({ main: {} }, fc), null);
});

const service = (key: string | undefined) => new WeatherService({ get: () => key } as any);
const okFetch = () => mock.method(globalThis, 'fetch', async (url: string) =>
  new Response(JSON.stringify(url.includes('/forecast') ? fc : now), { status: 200 }));

test('one upstream call per ~1 km cell per 10 minutes', async () => {
  const f = okFetch();
  const w = service('k');
  await w.forecast(16.3099, 80.4399);
  await w.forecast(16.3101, 80.4401);   // same 0.01-degree cell
  assert.equal(f.mock.callCount(), 2);  // current + forecast, once
  await w.forecast(16.5, 80.6);         // another cell
  assert.equal(f.mock.callCount(), 4);
});

test('the key never reaches the client, and failures are not cached', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('{"cod":401}', { status: 401 }));
  const w = service('secret-key');
  await assert.rejects(w.forecast(16.31, 80.44), ServiceUnavailableException);

  mock.restoreAll();
  okFetch();
  const data = await w.forecast(16.31, 80.44);   // retried, not served from a cached failure
  assert.equal(data.tempC, 25);
  assert.ok(!JSON.stringify(data).includes('secret-key'));
});

test('no key configured is a clear 503, not a crash', async () => {
  await assert.rejects(service(undefined).forecast(16.31, 80.44), ServiceUnavailableException);
});
