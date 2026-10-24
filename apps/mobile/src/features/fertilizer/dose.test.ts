import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bagsFor, parseNum, toAcres } from './dose';
import { RECS, productsPerAcre } from './recommendations';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.5, `${a} vs ${b}`);
const rec = (crop: string, variant?: string) => RECS.find((r) => r.crop === crop && r.variant === variant)!;

test('paddy, Krishna zone: per-ha figures become per-acre bags', () => {
  // 80-90 N : 60 P2O5 : 40-60 K2O kg/ha = 32.4-36.4 : 24.3 : 16.2-24.3 kg/acre.
  const p = productsPerAcre(rec('paddy', 'krishna'));
  near(p.dap[0], 52.8);            // 24.3 / 46%
  near(p.urea[0], 49.7);           // (32.4 - 52.8 x 18%) / 46%
  near(p.urea[1], 58.5);           // (36.4 - 52.8 x 18%) / 46%
  near(p.mop[0], 27.0); near(p.mop[1], 40.5);
});

test('per-acre sources are not converted twice', () => {
  const p = productsPerAcre(rec('sugarcane'));
  near(p.dap[0], 87.0);            // 40 / 46%
  near(p.urea[0], 111.6);          // (67 - 87 x 18%) / 46%
  near(p.mop[0], 80);              // 48 / 60%
});

test('no potash recommended means no MOP', () => {
  assert.deepEqual(productsPerAcre(rec('redgram')).mop, [0, 0]);
});

test('every row is sourced and still awaits an agronomist', () => {
  for (const r of RECS) {
    assert.ok(r.source.length > 20, `${r.crop} needs a source`);
    assert.equal(r.verified, false);
  }
});

test('units and bags', () => {
  assert.equal(toAcres(40, 'gunta'), 1);
  assert.equal(toAcres(100, 'cent'), 1);
  near(toAcres(1, 'hectare'), 2.47);
  assert.equal(bagsFor(90, 45), 2);
  assert.equal(bagsFor(91, 45), 3);
  assert.equal(parseNum('2,5'), 2.5);
});
