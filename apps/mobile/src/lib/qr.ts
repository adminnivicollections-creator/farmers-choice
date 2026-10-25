/**
 * What a scanned QR code holds, worked out on the phone: instant, and it works
 * when our server is asleep. Pure -- no React Native -- so it is testable.
 */
export type ScanKind = 'url' | 'upi' | 'phone' | 'email' | 'wifi' | 'geo' | 'text';

export type Scan = {
  kind: ScanKind;
  /** Safe to render: control and bidi characters stripped, length-capped. */
  display: string;
  /** What to open, exactly as encoded (never the trimmed display text). */
  href?: string;
  /** Opened without asking: an ordinary http(s) site only. */
  autoOpen: boolean;
  host?: string;
  /** Punycode or non-ASCII host: a classic impersonation trick. */
  suspiciousHost?: boolean;
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

export function describeScan(raw: string): Scan {
  const s = (raw ?? '').trim();
  const display = sanitise(s);
  const lower = s.toLowerCase();

  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      // hostname is the punycode form, which is what actually resolves.
      const host = u.hostname;
      const suspiciousHost = host.includes('xn--') || /[^\x00-\x7F]/.test(host);
      return { kind: 'url', display, href: u.href, host, suspiciousHost, autoOpen: !suspiciousHost };
    } catch {
      return { kind: 'text', display, autoOpen: false };
    }
  }
  if (lower.startsWith('upi://')) {
    // Shown with the payee, opened only on a tap: a payment never starts by itself.
    const p = paramsOf(s);
    const get = (k: string) => (p.get(k) ? sanitise(p.get(k)!) : undefined);
    return { kind: 'upi', display, href: s, autoOpen: false, payee: get('pa'), payeeName: get('pn'), amount: get('am') };
  }
  if (lower.startsWith('tel:')) return { kind: 'phone', display: sanitise(s.slice(4)), href: s, autoOpen: false };
  if (lower.startsWith('mailto:')) return { kind: 'email', display: sanitise(s.slice(7)), href: s, autoOpen: false };
  if (lower.startsWith('geo:')) return { kind: 'geo', display, href: s, autoOpen: false };
  if (lower.startsWith('wifi:')) return { kind: 'wifi', display, autoOpen: false };
  return { kind: 'text', display, autoOpen: false };
}
