/**
 * Pure OTP logic. No Nest, no Prisma — so it can be tested with `node --test`
 * and so the rules live in one readable place.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_WINDOW = 3;
export const OTP_WINDOW_MS = 15 * 60 * 1000;

/**
 * Normalise an Indian mobile number to E.164.
 * Accepts 9876543210, 09876543210, +91 98765 43210, 91-9876543210.
 * Returns null for anything that is not a valid Indian mobile — Indian mobile
 * numbers are 10 digits starting 6-9.
 */
export function normalisePhone(input: string): string | null {
  const digits = (input ?? '').replace(/\D/g, '');
  let local = digits;
  if (local.length === 12 && local.startsWith('91')) local = local.slice(2);
  else if (local.length === 11 && local.startsWith('0')) local = local.slice(1);
  if (local.length !== 10) return null;
  if (!/^[6-9]/.test(local)) return null;
  return `+91${local}`;
}

/** Cryptographically uniform 6-digit code. Math.random() is not acceptable here. */
export function generateCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

export function newSalt(): string {
  return randomBytes(16).toString('hex');
}

export function hashCode(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

/** Constant-time compare so a wrong code can't be probed by timing. */
export function codeMatches(code: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashCode(code, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export type OtpRow = {
  codeHash: string;
  salt: string;
  attempts: number;
  consumedAt: Date | null;
  expiresAt: Date;
};

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'consumed' | 'too_many_attempts' | 'wrong_code' };

/** Every rejection path for a submitted code, in one place. */
export function checkOtp(row: OtpRow | null, code: string, now = new Date()): CheckResult {
  if (!row) return { ok: false, reason: 'expired' };
  if (row.consumedAt) return { ok: false, reason: 'consumed' };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
  if (!codeMatches(code, row.salt, row.codeHash)) return { ok: false, reason: 'wrong_code' };
  return { ok: true };
}
