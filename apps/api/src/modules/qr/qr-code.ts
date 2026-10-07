/**
 * Pure QR code rules. No Nest, no Prisma — the trust boundary lives here and
 * is testable on its own.
 *
 * The governing rule: a QR code is an OPAQUE IDENTIFIER. Whatever is printed on
 * a label is attacker-controlled — a printer and five minutes is the whole
 * attack. So we never read meaning out of the code itself; we look it up.
 */

/** Codes we issue look like `FC1:<22+ url-safe chars>`. */
const FC_PREFIX = 'FC1:';
const BODY = /^[A-Za-z0-9_-]{16,64}$/;

export type ParsedCode =
  | { kind: 'fc'; code: string }
  | { kind: 'foreign'; raw: string }
  | { kind: 'rejected'; reason: 'empty' | 'too_long' | 'malformed' };

/** Anything a camera can hand us, including hostile input. */
export const MAX_RAW_LENGTH = 512;

export function parseScanned(raw: string | null | undefined): ParsedCode {
  const s = (raw ?? '').trim();
  if (!s) return { kind: 'rejected', reason: 'empty' };
  if (s.length > MAX_RAW_LENGTH) return { kind: 'rejected', reason: 'too_long' };

  if (s.startsWith(FC_PREFIX)) {
    const body = s.slice(FC_PREFIX.length);
    return BODY.test(body)
      ? { kind: 'fc', code: body }
      : { kind: 'rejected', reason: 'malformed' };
  }

  // Someone else's QR — a UPI string, a URL, a random product code. We log it
  // and tell the farmer we don't recognise it. We never follow it.
  return { kind: 'foreign', raw: s };
}

export type TagRow = {
  type: 'PRODUCT_BATCH' | 'EQUIPMENT';
  payload: unknown;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

export type Outcome = 'genuine' | 'unknown' | 'revoked' | 'expired';

export function outcomeFor(tag: TagRow | null, now = new Date()): Outcome {
  if (!tag) return 'unknown';
  if (tag.revokedAt) return 'revoked';
  if (tag.expiresAt && tag.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'genuine';
}

export type ScanHistory = { districtCount: number; scanCount: number; firstScanAt: Date | null };

/**
 * Counterfeit heuristic. A genuine bag of seed is scanned a handful of times,
 * in one place. The same batch code appearing across districts means the label
 * was photocopied.
 *
 * ponytail: thresholds are a first guess, deliberately conservative — this
 * only ever warns, it never blocks a sale. Tune once there is real scan data.
 */
export const SUSPICION = { districts: 3, scans: 25 };

export function suspicion(h: ScanHistory): { suspicious: boolean; reason?: string } {
  if (h.districtCount >= SUSPICION.districts) {
    return { suspicious: true, reason: 'scanned_in_many_districts' };
  }
  if (h.scanCount >= SUSPICION.scans) {
    return { suspicious: true, reason: 'scanned_unusually_often' };
  }
  return { suspicious: false };
}
