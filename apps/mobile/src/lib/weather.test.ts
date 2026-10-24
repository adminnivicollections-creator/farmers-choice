import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe } from './weather';

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
