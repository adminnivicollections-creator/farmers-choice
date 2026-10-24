import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysFrom, daysFromOwm, describe, owmToWmo, rainAlert } from './weather';

test('the icon follows the real weather, not a fixed sun', () => {
  assert.equal(describe(0, true).icon, 'weather-sunny');
  assert.equal(describe(3, true).icon, 'weather-cloudy');
  assert.equal(describe(63, true).icon, 'weather-rainy');
  assert.equal(describe(81, true).icon, 'weather-pouring');
  assert.equal(describe(95, true).icon, 'weather-lightning-rainy');
});

test('a clear night shows a moon and is not called sunny', () => {
  assert.deepEqual(describe(0, false), { labelKey: 'weather.clear', icon: 'weather-night' });
  assert.equal(describe(1, false).labelKey, 'weather.clear');
  assert.equal(describe(1, false).icon, 'weather-night-partly-cloudy');
});

const daily = {
  time: ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'],
  weather_code: [0, 3, 63, 61],
  precipitation_sum: [0, 1.2, 18.4, 30],
  precipitation_probability_max: [5, 40, 85, 90],
};

test('daily arrays become one row per day', () => {
  const days = daysFrom(daily);
  assert.equal(days.length, 4);
  assert.deepEqual(days[2], { date: '2026-10-26', code: 63, icon: 'weather-rainy', rainMm: 18.4, rainChance: 85 });
});

test('rain alert picks the first rainy day within three days', () => {
  assert.equal(rainAlert(daysFrom(daily))!.date, '2026-10-26');
  // Rain only on day 4 is outside the window.
  assert.equal(rainAlert(daysFrom({ ...daily, precipitation_sum: [0, 0, 0, 30], precipitation_probability_max: [0, 0, 0, 90] })), null);
});

test('missing data is dropped, not guessed', () => {
  assert.deepEqual(daysFrom(undefined), []);
  assert.equal(daysFrom({ time: ['2026-10-24'], weather_code: [null], precipitation_sum: [3] }).length, 0);
});

test('heavy rain later in the week is still flagged', () => {
  const week = { time: ['d0','d1','d2','d3','d4'], weather_code: [51, 51, 3, 81, 95],
    precipitation_sum: [0.9, 0.1, 0, 6.9, 153], precipitation_probability_max: [38, 29, 4, 51, 71] };
  assert.equal(rainAlert(daysFrom(week))!.date, 'd4');
});

test('OpenWeather condition ids map onto the same labels and icons', () => {
  assert.equal(describe(owmToWmo(800), true).icon, 'weather-sunny');
  assert.equal(describe(owmToWmo(804), true).labelKey, 'weather.cloudy');
  assert.equal(describe(owmToWmo(501), true).labelKey, 'weather.rain');
  assert.equal(describe(owmToWmo(211), true).labelKey, 'weather.thunderstorm');
  assert.equal(describe(owmToWmo(721), true).labelKey, 'weather.fog');   // haze
});

test('3-hourly OpenWeather slots become local days with summed rain', () => {
  const ist = 19800; // +05:30
  const at = (iso: string) => Date.parse(iso) / 1000 - ist;  // local time -> UTC epoch
  const fc = { city: { timezone: ist }, list: [
    { dt: at('2026-10-28T02:00:00Z'), weather: [{ id: 500 }], rain: { '3h': 2.5 }, pop: 0.4 },
    { dt: at('2026-10-28T23:00:00Z'), weather: [{ id: 211 }], rain: { '3h': 40 }, pop: 0.9 },
    { dt: at('2026-10-29T01:00:00Z'), weather: [{ id: 800 }], pop: 0 },
  ] };
  const days = daysFromOwm(fc);
  assert.deepEqual(days.map((d) => d.date), ['2026-10-28', '2026-10-29']);
  assert.equal(days[0].rainMm, 42.5);
  assert.equal(days[0].rainChance, 90);
  assert.equal(days[0].icon, 'weather-lightning-rainy');   // worst of the day wins
  assert.equal(days[1].rainMm, 0);
});

test('missing or broken forecast gives no days, not invented ones', () => {
  assert.deepEqual(daysFromOwm(null), []);
  assert.deepEqual(daysFromOwm({ list: [{ dt: 'x' }] }), []);
});
