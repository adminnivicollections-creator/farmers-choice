import { LatLng, distanceMetres, isValidLatLng } from './area';

/**
 * Walk-and-measure filtering. A phone emits a fix every second or so, most of
 * which are noise: the farmer stands still at a corner and the chip wanders
 * several metres. Recording all of it produces a boundary with hundreds of
 * points and an area that is simply wrong.
 */

export type Fix = LatLng & {
  /** Reported horizontal accuracy in metres (the radius, not the error). */
  accuracy?: number | null;
  timestamp?: number;
};

export type GpsFilterConfig = {
  /** Drop fixes worse than this. Consumer phones sit at 3-10 m in the open. */
  maxAccuracyMetres: number;
  /** Below this, treat the fix as the same corner and ignore it. */
  minDistanceMetres: number;
  /** Implausible for someone walking a field; indicates a chip jump. */
  maxSpeedMetresPerSecond: number;
  /** Warn the user above this, but let them carry on if they choose. */
  warnAccuracyMetres: number;
  /** Rolling window for smoothing. 1 disables it. */
  smoothingWindow: number;
};

/** One place to tune. Nothing below hard-codes a threshold. */
export const DEFAULT_GPS_FILTER: GpsFilterConfig = {
  maxAccuracyMetres: 20,
  minDistanceMetres: 2,
  maxSpeedMetresPerSecond: 8, // a brisk run; a walking farmer is ~1.4
  warnAccuracyMetres: 10,
  smoothingWindow: 3,
};

export type RejectReason = 'invalid' | 'inaccurate' | 'too_close' | 'implausible_jump';
export type FilterResult =
  | { accepted: true; point: LatLng }
  | { accepted: false; reason: RejectReason };

/**
 * Decide on one incoming fix given what has already been accepted.
 * Pure, so the whole policy is testable without a device.
 */
export function considerFix(
  fix: Fix,
  accepted: LatLng[],
  cfg: GpsFilterConfig = DEFAULT_GPS_FILTER,
  lastTimestamp?: number,
): FilterResult {
  if (!isValidLatLng(fix)) return { accepted: false, reason: 'invalid' };

  if (fix.accuracy != null && fix.accuracy > cfg.maxAccuracyMetres) {
    return { accepted: false, reason: 'inaccurate' };
  }

  const last = accepted[accepted.length - 1];
  if (last) {
    const d = distanceMetres(last, fix);
    if (d < cfg.minDistanceMetres) return { accepted: false, reason: 'too_close' };

    if (lastTimestamp != null && fix.timestamp != null) {
      const dt = (fix.timestamp - lastTimestamp) / 1000;
      if (dt > 0 && d / dt > cfg.maxSpeedMetresPerSecond) {
        return { accepted: false, reason: 'implausible_jump' };
      }
    }
  }

  return { accepted: true, point: { latitude: fix.latitude, longitude: fix.longitude } };
}

/**
 * Moving average over a short window. Pulls the jitter out of a walked path
 * without rounding off real corners, as long as the window stays small.
 * Endpoints are left untouched -- they are the corners that matter most.
 */
export function smoothPath(points: LatLng[], window = DEFAULT_GPS_FILTER.smoothingWindow): LatLng[] {
  if (window <= 1 || points.length < 3) return points;
  const half = Math.floor(window / 2);
  return points.map((p, i) => {
    if (i < half || i >= points.length - half) return p;
    let lat = 0, lng = 0, n = 0;
    for (let k = i - half; k <= i + half; k++) { lat += points[k].latitude; lng += points[k].longitude; n++; }
    return { latitude: lat / n, longitude: lng / n };
  });
}

export type AccuracyBand = 'good' | 'fair' | 'poor' | 'unknown';

export function accuracyBand(
  accuracy: number | null | undefined,
  cfg: GpsFilterConfig = DEFAULT_GPS_FILTER,
): AccuracyBand {
  if (accuracy == null || !Number.isFinite(accuracy)) return 'unknown';
  if (accuracy <= cfg.warnAccuracyMetres / 2) return 'good';
  if (accuracy <= cfg.warnAccuracyMetres) return 'fair';
  return 'poor';
}

/** Running state for a walk, so the UI can show live totals. */
export class WalkRecorder {
  readonly points: LatLng[] = [];
  rejected: Record<RejectReason, number> = {
    invalid: 0, inaccurate: 0, too_close: 0, implausible_jump: 0,
  };
  private lastTimestamp?: number;

  constructor(private cfg: GpsFilterConfig = DEFAULT_GPS_FILTER) {}

  add(fix: Fix): FilterResult {
    const r = considerFix(fix, this.points, this.cfg, this.lastTimestamp);
    if (r.accepted) {
      this.points.push(r.point);
      this.lastTimestamp = fix.timestamp;
    } else {
      this.rejected[r.reason]++;
    }
    return r;
  }

  /** Distance actually walked so far (the open path, not the closed ring). */
  get distanceWalkedMetres(): number {
    let t = 0;
    for (let i = 1; i < this.points.length; i++) t += distanceMetres(this.points[i - 1], this.points[i]);
    return t;
  }

  reset() {
    this.points.length = 0;
    this.rejected = { invalid: 0, inaccurate: 0, too_close: 0, implausible_jump: 0 };
    this.lastTimestamp = undefined;
  }
}
