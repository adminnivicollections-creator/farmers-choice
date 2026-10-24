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

export type ScanHistory = {
  districtCount: number;
  scanCount: number;
  /** Distinct phones. One farmer re-scanning a bag is not a copied label. */
  deviceCount: number;
  firstScanAt: Date | null;
};

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
  if (h.deviceCount >= SUSPICION.scans) {
    return { suspicious: true, reason: 'scanned_unusually_often' };
  }
  return { suspicious: false };
}

/* ------------------------------------------------------------------ foreign
 * A QR that isn't ours still deserves an answer. We describe what it holds so
 * the farmer can decide, and never act on it ourselves.
 */

export type ForeignKind = 'url' | 'upi' | 'phone' | 'email' | 'wifi' | 'geo' | 'text';

export type ForeignDescription = {
  kind: ForeignKind;
  /** Safe to render. Control characters stripped, length-capped. */
  display: string;
  /** Only ever true for http/https. The UI shows an open button solely for these. */
  openable: boolean;
  /** Host as the browser would resolve it, so a lookalike domain is visible. */
  host?: string;
  /** Host contains non-ASCII or punycode: a classic impersonation trick. */
  suspiciousHost?: boolean;
  /** UPI only. Shown so a farmer sees who is being paid before deciding. */
  payee?: string;
  payeeName?: string;
  amount?: string;
};

const DISPLAY_LIMIT = 200;

/** Strip control characters and bidi overrides, which can disguise text. */
function sanitise(s: string): string {
  return s.replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩]/g, '').slice(0, DISPLAY_LIMIT);
}

function paramsOf(s: string): URLSearchParams {
  const q = s.indexOf('?');
  return new URLSearchParams(q === -1 ? '' : s.slice(q + 1));
}

export function describeForeign(raw: string): ForeignDescription {
  const s = sanitise(raw.trim());
  const lower = s.toLowerCase();

  if (lower.startsWith('upi://')) {
    const p = paramsOf(s);
    return {
      kind: 'upi',
      display: s,
      openable: false,
      payee: p.get('pa') ? sanitise(p.get('pa')!) : undefined,
      payeeName: p.get('pn') ? sanitise(p.get('pn')!) : undefined,
      amount: p.get('am') ? sanitise(p.get('am')!) : undefined,
    };
  }

  if (lower.startsWith('tel:')) return { kind: 'phone', display: sanitise(s.slice(4)), openable: false };
  if (lower.startsWith('mailto:')) return { kind: 'email', display: sanitise(s.slice(7)), openable: false };
  if (lower.startsWith('wifi:')) return { kind: 'wifi', display: s, openable: false };
  if (lower.startsWith('geo:')) return { kind: 'geo', display: s, openable: false };

  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      // url.hostname gives the punycode form, which is what actually resolves.
      // Showing it is the point: "xn--pypal-4ve.com" reads as an impostor,
      // while the unicode spelling does not.
      const host = u.hostname;
      return {
        kind: 'url',
        display: s,
        openable: u.protocol === 'http:' || u.protocol === 'https:',
        host,
        suspiciousHost: host.includes('xn--') || /[^\x00-\x7F]/.test(host),
      };
    } catch {
      return { kind: 'text', display: s, openable: false };
    }
  }

  return { kind: 'text', display: s, openable: false };
}
