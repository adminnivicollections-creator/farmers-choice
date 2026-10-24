import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysFrom, describe, rainAlert } from './weather';

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
