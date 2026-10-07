import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HECTARES_PER, rankBlends, requirementFor, solveWith, splitBySchedule, supplies, toHectares,
} from './engine';
import { validateRecommendation, isPublishable } from './validate';
import { FertilizerProduct, NutrientRecommendation } from './types';

// Product analyses are specifications printed on the bag, not recommendations.
const UREA: FertilizerProduct = { id: 'urea', name: 'Urea', n: 46, p2o5: 0, k2o: 0 };
const DAP: FertilizerProduct  = { id: 'dap',  name: 'DAP',  n: 18, p2o5: 46, k2o: 0 };
const MOP: FertilizerProduct  = { id: 'mop',  name: 'MOP',  n: 0,  p2o5: 0,  k2o: 60 };
const SSP: FertilizerProduct  = { id: 'ssp',  name: 'SSP',  n: 0,  p2o5: 16, k2o: 0, s: 11 };
const NPK: FertilizerProduct  = { id: 'npk',  name: '10-26-26', n: 10, p2o5: 26, k2o: 26 };

const near = (a: number, b: number, tol: number, what: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: expected ~${b}, got ${a}`);

// ---------------------------------------------------------------- units

test('area converts to hectares exactly', () => {
  near(toHectares(1, 'acre'), 0.40468564224, 1e-12, 'acre');
  near(toHectares(40, 'gunta'), 0.40468564224, 1e-12, '40 guntas = 1 acre');
  near(toHectares(100, 'cent'), 0.40468564224, 1e-12, '100 cents = 1 acre');
  near(toHectares(2.5, 'hectare'), 2.5, 1e-12, 'hectare');
  near(toHectares(10_000, 'sqm'), 1, 1e-12, '10,000 sq.m = 1 ha');
});

test('bigha is refused without a verified regional factor', () => {
  // @ts-expect-error -- 'bigha' is deliberately not an AreaUnit
  assert.equal(HECTARES_PER.bigha, undefined);
  assert.throws(() => toHectares(1, 'custom', 0), /verified hectares-per-unit/);
  near(toHectares(1, 'custom', 0.1618), 0.1618, 1e-12, 'custom factor is used as given');
});

// ---------------------------------------------------------------- products

test('a product supplies exactly its stated analysis', () => {
  const s = supplies(DAP, 100);
  near(s.n, 18, 1e-9, 'N from 100 kg DAP');
  near(s.p2o5, 46, 1e-9, 'P2O5 from 100 kg DAP');
  near(s.k2o, 0, 1e-9, 'K2O from 100 kg DAP');
});

test('the worked example from the brief: 46 kg P2O5 from a 46% product is 100 kg', () => {
  const b = solveWith({ n: 0, p2o5: 46, k2o: 0 }, { p: DAP });
  near(b.doses[0].kg, 100, 1e-9, 'DAP quantity');
});

// ---------------------------------------------------------------- no double counting

test('nitrogen already supplied by DAP is subtracted from the urea dose', () => {
  // Need 100 N, 46 P2O5, 0 K2O.
  const b = solveWith({ n: 100, p2o5: 46, k2o: 0 }, { p: DAP, n: UREA });
  const dap = b.doses.find((d) => d.product.id === 'dap')!;
  const urea = b.doses.find((d) => d.product.id === 'urea')!;

  near(dap.kg, 100, 1e-6, 'DAP');
  // 100 kg DAP already gives 18 kg N, so urea covers 82, not 100.
  near(urea.kg, 82 / 0.46, 1e-6, 'urea covers only the shortfall');
  near(b.supplied.n, 100, 1e-6, 'total N lands on target, not above');
  near(b.excess.n, 0, 1e-6, 'no nitrogen excess');
});

test('a naive solve would over-apply — guard against the regression', () => {
  const b = solveWith({ n: 100, p2o5: 46, k2o: 0 }, { p: DAP, n: UREA });
  const naiveUrea = 100 / 0.46; // what you get if you ignore DAP's nitrogen
  const actualUrea = b.doses.find((d) => d.product.id === 'urea')!.kg;
  assert.ok(actualUrea < naiveUrea - 30, 'urea must be well below the naive figure');
});

test('potassium already supplied by a complex is subtracted too', () => {
  const b = solveWith({ n: 60, p2o5: 26, k2o: 40 }, { p: NPK, k: MOP, n: UREA });
  near(b.supplied.p2o5, 26, 1e-6, 'P2O5 on target');
  near(b.supplied.k2o, 40, 1e-6, 'K2O on target');
  near(b.supplied.n, 60, 1e-6, 'N on target');
  near(b.excess.k2o, 0, 1e-6, 'no potassium excess');
});

// ---------------------------------------------------------------- scaling

test('a per-hectare recommendation scales to the field', () => {
  const rec = recWith({ n: 120, p2o5: 60, k2o: 40 });
  const req = requirementFor(rec, toHectares(2.5, 'acre'));
  near(req.n, 120 * 1.0117141056, 1e-6, 'N for 2.5 acres');
  near(req.p2o5, 60 * 1.0117141056, 1e-6, 'P2O5 for 2.5 acres');
});

test('zero or negative area is refused', () => {
  assert.throws(() => requirementFor(recWith({ n: 1, p2o5: 1, k2o: 1 }), 0), /greater than zero/);
});

// ---------------------------------------------------------------- ranking

test('ranking never returns a blend that under-supplies when one fits', () => {
  const required = { n: 100, p2o5: 50, k2o: 50 };
  const best = rankBlends(required, [UREA, DAP, MOP, SSP, NPK])[0];
  near(best.shortfall.n + best.shortfall.p2o5 + best.shortfall.k2o, 0, 1e-6, 'no shortfall');
});

test('ranking prefers the blend with least excess, not a fixed trio', () => {
  // Heavy P and K, light N: a 10-26-26 complex fits better than DAP + MOP + urea.
  const required = { n: 20, p2o5: 52, k2o: 52 };
  const ranked = rankBlends(required, [UREA, DAP, MOP, NPK]);
  const winner = ranked[0];
  assert.ok(
    winner.doses.some((d) => d.product.id === 'npk'),
    `expected the complex to win, got ${winner.doses.map((d) => d.product.name).join(' + ')}`,
  );
  const dapBlend = ranked.find((b) => b.doses.some((d) => d.product.id === 'dap'))!;
  const tot = (x: any) => x.n + x.p2o5 + x.k2o;
  assert.ok(tot(winner.excess) <= tot(dapBlend.excess), 'winner must not have more excess');
});

test('cost breaks a tie only when every product in the blend is priced', () => {
  const cheap = { ...SSP, id: 'ssp-cheap', name: 'SSP cheap', pricePerKg: 8 };
  const dear  = { ...SSP, id: 'ssp-dear',  name: 'SSP dear',  pricePerKg: 20 };
  const ranked = rankBlends({ n: 0, p2o5: 16, k2o: 0 }, [cheap, dear]);
  assert.equal(ranked[0].doses[0].product.id, 'ssp-cheap');
  assert.equal(ranked[0].totalCost, 100 * 8);
});

test('totalCost is null when any product has no known price', () => {
  const b = solveWith({ n: 0, p2o5: 46, k2o: 0 }, { p: DAP });
  assert.equal(b.totalCost, null);
});

test('a nutrient that is not required produces no product', () => {
  const b = solveWith({ n: 50, p2o5: 0, k2o: 0 }, { p: DAP, k: MOP, n: UREA });
  assert.equal(b.doses.length, 1);
  assert.equal(b.doses[0].product.id, 'urea');
});

// ---------------------------------------------------------------- workings

test('the workings explain every dose', () => {
  const b = solveWith({ n: 100, p2o5: 46, k2o: 60 }, { p: DAP, k: MOP, n: UREA });
  assert.equal(b.workings.length, b.doses.length);
  assert.ok(b.workings.some((w) => w.includes('also supplies')), 'must disclose by-product nutrients');
});

// ---------------------------------------------------------------- schedule

function recWith(perHectare: any, schedule?: any): NutrientRecommendation {
  return {
    id: 'r1',
    perHectare,
    type: 'GENERAL',
    schedule,
    source: {
      organisation: 'Example Agricultural University',
      document: 'Package of Practices',
      region: 'Example State',
      verifiedOn: '2026-01-15',
      version: '1.0',
    },
  };
}

test('no published schedule means no invented timing', () => {
  assert.equal(splitBySchedule(solveWith({ n: 50, p2o5: 0, k2o: 0 }, { n: UREA }), recWith({ n: 50, p2o5: 0, k2o: 0 })), null);
});

test('a published schedule splits the doses', () => {
  const rec = recWith({ n: 100, p2o5: 50, k2o: 0 }, [
    { stage: 'Basal', share: { n: 0.5, p2o5: 1 } },
    { stage: 'First top dressing', daysAfterSowing: 30, share: { n: 0.5 } },
  ]);
  const blend = solveWith({ n: 100, p2o5: 50, k2o: 0 }, { p: DAP, n: UREA });
  const split = splitBySchedule(blend, rec)!;
  assert.equal(split.length, 2);
  assert.equal(split[0].stage, 'Basal');
  assert.equal(split[1].daysAfterSowing, 30);

  const ureaTotal = blend.doses.find((d) => d.product.id === 'urea')!.kg;
  const ureaSplit = split.flatMap((st) => st.doses).filter((d) => d.product === 'Urea')
    .reduce((t, d) => t + d.kg, 0);
  near(ureaSplit, ureaTotal, 1e-6, 'splitting must not lose or create fertilizer');
});

// ---------------------------------------------------------------- validation

test('a recommendation without a source is not publishable', () => {
  const issues = validateRecommendation({
    crop: 'Cotton', state: 'Gujarat', season: 'Kharif',
    perHectare: { n: 120, p2o5: 60, k2o: 40 }, type: 'GENERAL',
  });
  assert.ok(issues.some((i) => i.field === 'source'), 'must demand a source');
});

test('a fully sourced recommendation is publishable', () => {
  assert.equal(isPublishable({
    crop: 'Cotton', state: 'Gujarat', season: 'Kharif',
    perHectare: { n: 120, p2o5: 60, k2o: 40 }, type: 'GENERAL',
    source: {
      organisation: 'Anand Agricultural University', document: 'POP 2024',
      region: 'Gujarat', verifiedOn: '2026-02-01', version: '2024.1',
    },
  }), true);
});

test('missing source fields are each reported', () => {
  const issues = validateRecommendation({
    crop: 'Rice', state: 'Telangana', season: 'Kharif',
    perHectare: { n: 100, p2o5: 50, k2o: 40 }, type: 'GENERAL',
    source: { organisation: '', document: '', region: '', verifiedOn: '', version: '' } as any,
  });
  for (const f of ['organisation', 'document', 'region', 'verifiedOn', 'version']) {
    assert.ok(issues.some((i) => i.field === `source.${f}`), `must flag ${f}`);
  }
});

test('negative and implausible nutrient values are rejected', () => {
  const neg = validateRecommendation({ crop: 'X', state: 'Y', season: 'Kharif', type: 'GENERAL',
    perHectare: { n: -1, p2o5: 10, k2o: 10 } });
  assert.ok(neg.some((i) => i.field === 'perHectare.n'));

  const huge = validateRecommendation({ crop: 'X', state: 'Y', season: 'Kharif', type: 'GENERAL',
    perHectare: { n: 5000, p2o5: 10, k2o: 10 } });
  assert.ok(huge.some((i) => i.problem.includes('Implausibly large')));
});

test('stage shares that do not add to 1 are rejected', () => {
  const issues = validateRecommendation({
    crop: 'X', state: 'Y', season: 'Kharif', type: 'GENERAL',
    perHectare: { n: 100, p2o5: 0, k2o: 0 },
    source: { organisation: 'O', document: 'D', region: 'R', verifiedOn: '2026-01-01', version: '1' },
    schedule: [{ stage: 'Basal', share: { n: 0.5 } }, { stage: 'Top', share: { n: 0.2 } }],
  });
  assert.ok(issues.some((i) => i.problem.includes('not 1')), 'must catch a lost 30%');
});
