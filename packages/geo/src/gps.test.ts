import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Geodesic } from 'geographiclib-geodesic';
import { LatLng, measurePolygon } from './area';
import { DEFAULT_GPS_FILTER, WalkRecorder, accuracyBand, considerFix, smoothPath } from './gps';

const geod = Geodesic.WGS84!;
const move = (p: LatLng, deg: number, m: number): LatLng => {
  const r = geod.Direct(p.latitude, p.longitude, deg, m);
  return { latitude: r.lat2!, longitude: r.lon2! };
};
const ORIGIN: LatLng = { latitude: 17.4516, longitude: 78.6862 };

test('a clean fix is accepted', () => {
  const r = considerFix({ ...ORIGIN, accuracy: 4 }, []);
  assert.equal(r.accepted, true);
});

test('fixes worse than the accuracy threshold are dropped', () => {
  const r = considerFix({ ...ORIGIN, accuracy: 45 }, []);
  assert.deepEqual(r, { accepted: false, reason: 'inaccurate' });
});

test('Null Island and out-of-range coordinates are dropped', () => {
  assert.deepEqual(considerFix({ latitude: 0, longitude: 0, accuracy: 3 }, []),
    { accepted: false, reason: 'invalid' });
  assert.deepEqual(considerFix({ latitude: 99, longitude: 10, accuracy: 3 }, []),
    { accepted: false, reason: 'invalid' });
});

test('standing still does not add points', () => {
  const accepted = [ORIGIN];
  const barelyMoved = move(ORIGIN, 90, 0.8); // under minDistanceMetres
  assert.deepEqual(considerFix({ ...barelyMoved, accuracy: 3 }, accepted),
    { accepted: false, reason: 'too_close' });
});

test('a teleport is rejected as an implausible jump', () => {
  const t0 = 1_000_000;
  const far = move(ORIGIN, 90, 500); // 500 m in 2 s
  const r = considerFix({ ...far, accuracy: 3, timestamp: t0 + 2000 }, [ORIGIN], DEFAULT_GPS_FILTER, t0);
  assert.deepEqual(r, { accepted: false, reason: 'implausible_jump' });
});

test('a normal walking step at the same interval is kept', () => {
  const t0 = 1_000_000;
  const step = move(ORIGIN, 90, 4); // 4 m in 2 s = 2 m/s
  const r = considerFix({ ...step, accuracy: 3, timestamp: t0 + 2000 }, [ORIGIN], DEFAULT_GPS_FILTER, t0);
  assert.equal(r.accepted, true);
});

test('WalkRecorder keeps corners and counts what it threw away', () => {
  const rec = new WalkRecorder();
  const a = ORIGIN, b = move(a, 90, 100), c = move(b, 0, 100), d = move(a, 0, 100);
  let t = 0;
  for (const p of [a, b, c, d]) { t += 60_000; rec.add({ ...p, accuracy: 4, timestamp: t }); }

  // noise that must not get in
  rec.add({ ...move(d, 90, 0.3), accuracy: 4, timestamp: t + 1000 });  // too close
  rec.add({ ...move(d, 90, 10), accuracy: 60, timestamp: t + 2000 });  // inaccurate
  rec.add({ latitude: 0, longitude: 0, accuracy: 3, timestamp: t + 3000 }); // invalid

  assert.equal(rec.points.length, 4);
  assert.equal(rec.rejected.too_close, 1);
  assert.equal(rec.rejected.inaccurate, 1);
  assert.equal(rec.rejected.invalid, 1);

  const m = measurePolygon(rec.points);
  assert.ok(Math.abs(m.areaSquareMeters - 10_000) < 2, `walked square area was ${m.areaSquareMeters}`);
  assert.ok(Math.abs(rec.distanceWalkedMetres - 300) < 1, 'open path is 3 sides');
});

test('reset clears points and counters', () => {
  const rec = new WalkRecorder();
  rec.add({ ...ORIGIN, accuracy: 3 });
  rec.reset();
  assert.equal(rec.points.length, 0);
  assert.equal(rec.rejected.too_close, 0);
});

test('smoothing pulls in jitter but leaves the endpoints alone', () => {
  const a = ORIGIN;
  const straight = [0, 1, 2, 3, 4].map((i) => move(a, 90, i * 10));
  const noisy = straight.map((p, i) => (i === 2 ? move(p, 0, 6) : p)); // one 6 m spike
  const out = smoothPath(noisy, 3);
  assert.deepEqual(out[0], noisy[0], 'first point untouched');
  assert.deepEqual(out[4], noisy[4], 'last point untouched');
  const spikeBefore = Math.abs(noisy[2].latitude - straight[2].latitude);
  const spikeAfter = Math.abs(out[2].latitude - straight[2].latitude);
  assert.ok(spikeAfter < spikeBefore, 'spike should shrink');
});

test('smoothing is a no-op for short paths or window 1', () => {
  const two = [ORIGIN, move(ORIGIN, 90, 10)];
  assert.deepEqual(smoothPath(two, 3), two);
  assert.deepEqual(smoothPath(two, 1), two);
});

test('accuracy bands drive the warning text', () => {
  assert.equal(accuracyBand(3), 'good');
  assert.equal(accuracyBand(8), 'fair');
  assert.equal(accuracyBand(25), 'poor');
  assert.equal(accuracyBand(null), 'unknown');
  assert.equal(accuracyBand(undefined), 'unknown');
});
