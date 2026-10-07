import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Geodesic } from 'geographiclib-geodesic';
import {
  EMPTY_MEASUREMENT, LatLng, distanceMetres, isSelfIntersecting, isValidLatLng, measurePolygon,
} from './area';
import {
  SQFT_PER_ACRE, SQFT_PER_CENT, SQM_PER_HECTARE, formatArea, fromSqm, toSqm,
} from './units';

const geod = Geodesic.WGS84!;
/** Walk `metres` from a point on bearing `deg` — gives exact test geometry. */
const move = (p: LatLng, deg: number, metres: number): LatLng => {
  const r = geod.Direct(p.latitude, p.longitude, deg, metres);
  return { latitude: r.lat2!, longitude: r.lon2! };
};

const ORIGIN: LatLng = { latitude: 17.4516, longitude: 78.6862 }; // Ghatkesar

/** A square of exactly `side` metres, built by walking the four sides. */
function square(side: number, origin = ORIGIN): LatLng[] {
  const a = origin;
  const b = move(a, 90, side);   // east
  const c = move(b, 0, side);    // north
  const d = move(a, 0, side);
  return [a, b, c, d];
}

const near = (actual: number, expected: number, tol: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `${what}: expected ~${expected}, got ${actual} (tolerance ${tol})`);

test('100 m x 100 m square is 10,000 sq.m', () => {
  const m = measurePolygon(square(100));
  near(m.areaSquareMeters, 10_000, 1, 'area');
  near(m.perimeterMeters, 400, 0.5, 'perimeter');
  assert.equal(m.pointCount, 4);
});

test('a 1-acre plot reports 1.000 acres, 100 cents and 40 guntas', () => {
  // 1 acre = 4046.856 sq.m -> side 63.6146 m
  const side = Math.sqrt(SQFT_PER_ACRE / (3.280839895013123 ** 2));
  const m = measurePolygon(square(side));
  near(m.acres, 1, 0.001, 'acres');
  near(m.cents, 100, 0.1, 'cents');
  near(m.guntas, 40, 0.05, 'guntas');
  near(m.areaSquareFeet, SQFT_PER_ACRE, 20, 'sq ft');
});

test('right triangle with 100 m legs is 5,000 sq.m', () => {
  const a = ORIGIN;
  const b = move(a, 90, 100);
  const c = move(a, 0, 100);
  const m = measurePolygon([a, b, c]);
  near(m.areaSquareMeters, 5_000, 1, 'triangle area');
  assert.equal(m.pointCount, 3);
});

test('winding order does not change the area', () => {
  const s = square(100);
  near(measurePolygon(s).areaSquareMeters, measurePolygon([...s].reverse()).areaSquareMeters, 0.01, 'cw vs ccw');
});

test('irregular 6-point polygon is positive and plausible', () => {
  const a = ORIGIN;
  const pts = [a, move(a, 90, 80), move(a, 70, 140), move(a, 30, 160), move(a, 0, 120), move(a, 330, 60)];
  const m = measurePolygon(pts);
  assert.ok(m.areaSquareMeters > 0, 'area should be positive');
  assert.ok(m.areaSquareMeters < 160 * 160, 'area cannot exceed its bounding square');
  assert.equal(m.pointCount, 6);
});

test('fewer than 3 points has no area but still reports path length', () => {
  assert.deepEqual(measurePolygon([]), { ...EMPTY_MEASUREMENT, pointCount: 0 });
  const two = [ORIGIN, move(ORIGIN, 90, 50)];
  const m = measurePolygon(two);
  assert.equal(m.areaSquareMeters, 0);
  near(m.perimeterMeters, 50, 0.1, 'open path length');
});

test('deleting a point recalculates: half a square is half the area', () => {
  const s = square(100);
  const full = measurePolygon(s);
  const tri = measurePolygon(s.filter((_, i) => i !== 3)); // drop one corner
  near(tri.areaSquareMeters, full.areaSquareMeters / 2, 1, 'triangle is half the square');
});

test('moving a point recalculates', () => {
  const s = square(100);
  const before = measurePolygon(s).areaSquareMeters;
  const moved = [...s];
  moved[2] = move(moved[2], 0, 50); // push one corner 50 m north
  assert.ok(measurePolygon(moved).areaSquareMeters > before, 'area should grow');
});

test('invalid points are rejected, including Null Island', () => {
  assert.equal(isValidLatLng({ latitude: 0, longitude: 0 }), false);
  assert.equal(isValidLatLng({ latitude: 91, longitude: 10 }), false);
  assert.equal(isValidLatLng({ latitude: 10, longitude: 181 }), false);
  assert.equal(isValidLatLng({ latitude: NaN, longitude: 10 }), false);
  assert.equal(isValidLatLng(null), false);
  assert.equal(isValidLatLng(ORIGIN), true);
});

test('invalid points are dropped before measuring', () => {
  const s = square(100);
  const withJunk = [s[0], { latitude: 0, longitude: 0 }, s[1], s[2], s[3]];
  near(measurePolygon(withJunk).areaSquareMeters, 10_000, 1, 'junk ignored');
  assert.equal(measurePolygon(withJunk).pointCount, 4);
});

test('a bow-tie boundary is detected as self-intersecting', () => {
  const a = ORIGIN, b = move(a, 90, 100), c = move(a, 0, 100), d = move(b, 0, 100);
  assert.equal(isSelfIntersecting([a, b, c, d]), true);  // crossed order
  assert.equal(isSelfIntersecting([a, b, d, c]), false); // proper ring
  assert.equal(isSelfIntersecting(square(100)), false);
});

test('unit conversions match the legal definitions', () => {
  near(fromSqm(toSqm(SQFT_PER_ACRE, 'sqft'), 'acre'), 1, 1e-9, '43,560 sq.ft = 1 acre');
  near(fromSqm(toSqm(SQFT_PER_CENT, 'sqft'), 'cent'), 1, 1e-9, '435.6 sq.ft = 1 cent');
  near(fromSqm(SQM_PER_HECTARE, 'hectare'), 1, 1e-12, '10,000 sq.m = 1 hectare');
  near(fromSqm(toSqm(1, 'acre'), 'gunta'), 40, 1e-9, '1 acre = 40 guntas');
  near(fromSqm(toSqm(1, 'acre'), 'cent'), 100, 1e-9, '1 acre = 100 cents');
});

test('round-trips through every unit', () => {
  for (const u of ['sqft', 'sqm', 'acre', 'cent', 'hectare', 'gunta'] as const) {
    near(toSqm(fromSqm(1234.5, u), u), 1234.5, 1e-6, `round-trip ${u}`);
  }
});

test('formatArea never throws and shows useful precision', () => {
  assert.match(formatArea(1165, 'sqft'), /sq\.ft$/);
  assert.match(formatArea(toSqm(0.288, 'acre'), 'acre'), /^0\.288 acres$/);
  assert.match(formatArea(0, 'cent'), /^0\.0 cents$/);
});

test('geodesic distance is right for a known 100 m leg', () => {
  near(distanceMetres(ORIGIN, move(ORIGIN, 90, 100)), 100, 0.01, 'distance');
});
