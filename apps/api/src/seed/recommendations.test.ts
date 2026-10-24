import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, RecSeed, SourceSeed, SOURCES, RECOMMENDATIONS } from './recommendations';

const reviewed: SourceSeed = {
  key: 'src-1', organisation: 'ANGRAU', document: 'Package of Practices',
  version: '2026', region: 'Andhra Pradesh', verifiedBy: 'A. Reviewer', verifiedOn: '2026-10-12',
};
const unreviewed: SourceSeed = { ...reviewed, key: 'src-2', verifiedBy: undefined, verifiedOn: undefined };

const row = (over: Partial<RecSeed> = {}): RecSeed => ({
  sourceKey: 'src-1', cropSlug: 'paddy', state: 'Andhra Pradesh', district: 'Guntur',
  season: 'KHARIF', irrigation: 'IRRIGATED', nPerHa: 120, p2o5PerHa: 60, k2oPerHa: 40,
  type: 'GENERAL', status: 'PUBLISHED', page: 'Table 3.2, p.41', ...over,
});

const problems = (r: RecSeed, s: SourceSeed[] = [reviewed]) => validate(s, [r]).map((p) => p.problem);

test('the shipped file is valid', () => {
  assert.deepEqual(validate(SOURCES, RECOMMENDATIONS), []);
});

test('a complete reviewed row passes', () => {
  assert.deepEqual(problems(row()), []);
});

test('refuses to publish without a named reviewer', () => {
  const found = problems(row({ sourceKey: 'src-2' }), [reviewed, unreviewed]);
  assert.ok(found.some((p) => p.includes('verifiedBy')), found.join('; '));
});

test('refuses to publish without a page reference', () => {
  assert.ok(problems(row({ page: undefined })).some((p) => p.includes('page')));
});

test('refuses all-zero published nutrients', () => {
  const found = problems(row({ nPerHa: 0, p2o5PerHa: 0, k2oPerHa: 0 }));
  assert.ok(found.some((p) => p.includes('placeholder')), found.join('; '));
});

test('allows an unreviewed row to exist as DRAFT', () => {
  assert.deepEqual(problems(row({ sourceKey: 'src-2', status: 'DRAFT', page: undefined }), [reviewed, unreviewed]), []);
});

test('rejects negative and implausible nutrient amounts', () => {
  assert.ok(problems(row({ nPerHa: -1 })).some((p) => p.includes('>= 0')));
  assert.ok(problems(row({ nPerHa: 900 })).some((p) => p.includes('implausible')));
});

test('rejects an unknown sourceKey', () => {
  assert.ok(problems(row({ sourceKey: 'nope' })).some((p) => p.includes('unknown sourceKey')));
});

test('rejects a split schedule that does not sum to 1', () => {
  const found = problems(row({ stages: [{ stage: 'basal', nShare: 0.5 }, { stage: 'top', nShare: 0.2 }] }));
  assert.ok(found.some((p) => p.includes('sum to 0.700')), found.join('; '));
});

test('accepts a schedule that sums to 1 per nutrient', () => {
  assert.deepEqual(problems(row({
    stages: [
      { stage: 'basal', nShare: 0.5, p2o5Share: 1, k2oShare: 0.5 },
      { stage: 'panicle', daysAfterSowing: 50, nShare: 0.5, k2oShare: 0.5 },
    ],
  })), []);
});

test('rejects a share outside 0-1', () => {
  assert.ok(problems(row({ stages: [{ stage: 'basal', nShare: 1.4 }] })).some((p) => p.includes('each be 0-1')));
});

test('refuses a schedule that never applies a required nutrient', () => {
  // P is required (60 kg/ha) but no stage gives it a share: DAP would vanish
  // from the timing table.
  const found = problems(row({ stages: [{ stage: 'basal', nShare: 0.5, k2oShare: 1 }, { stage: 'top', nShare: 0.5 }] }));
  assert.ok(found.some((p) => p.includes('p2o5Share is required')), found.join('; '));
});
