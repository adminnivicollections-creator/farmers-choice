import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doseFor, parseNum } from './dose';

test('dose x land, split into bags', () => {
  // The example on the screen: 50 kg/acre of urea on 2.5 acres, 45 kg bags.
  assert.deepEqual(doseFor(50, 2.5, 'acre', 45), { totalKg: 125, bags: 2, looseKg: 35 });
  assert.deepEqual(doseFor(50, 2, 'acre', 50), { totalKg: 100, bags: 2, looseKg: 0 });
});

test('other land units convert to acres', () => {
  assert.equal(doseFor(40, 40, 'gunta', 50)!.totalKg, 40);   // 40 guntas = 1 acre
  assert.equal(doseFor(40, 100, 'cent', 50)!.totalKg, 40);   // 100 cents = 1 acre
  assert.equal(doseFor(40, 1, 'hectare', 50)!.totalKg, 98.8); // 1 ha = 2.471 acres
});

test('empty or nonsense input gives no answer instead of a wrong one', () => {
  assert.equal(doseFor(0, 2, 'acre', 45), null);
  assert.equal(doseFor(50, NaN, 'acre', 45), null);
  assert.equal(doseFor(50, -1, 'acre', 45), null);
  assert.equal(parseNum('2,5'), 2.5);
});
