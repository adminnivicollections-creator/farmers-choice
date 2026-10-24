/**
 * AuthService against a real Postgres. The defects these guard -- parallel
 * guesses, double consumption, double refresh -- are database races, so a fake
 * Prisma would prove nothing. Skipped when DATABASE_URL is not set; CI sets it.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './auth.service';
import { OtpSender, otpSenderFor } from './otp-sender';
import { OTP_MAX_ATTEMPTS } from './otp';

const db = process.env.DATABASE_URL ? new PrismaClient() : null;
const skip = !db && 'DATABASE_URL not set';
after(() => db?.$disconnect());

class CapturingSender extends OtpSender {
  last = '';
  async send(_phone: string, code: string) { this.last = code; }
}

function setup() {
  const sender = new CapturingSender();
  const config = { get: (_k: string, fallback?: unknown) => fallback } as any;
  const auth = new AuthService(db as any, new JwtService({ secret: 'test' }), config, sender);
  // A fresh number per test, so the per-phone rate limit never interferes.
  const phone = `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  return { auth, sender, phone, e164: `+91${phone}` };
}

const outcome = (p: Promise<unknown>) => p.then(() => 'ok', (e) => e);

test('production without msg91 refuses to send codes instead of logging them', async () => {
  const config = { get: (k: string) => ({ NODE_ENV: 'production', OTP_PROVIDER: 'console' } as any)[k] } as any;
  await assert.rejects(otpSenderFor(config).send('+919876543210', '123456'), ServiceUnavailableException);
});

test('parallel wrong guesses cannot exceed the attempt limit', { skip }, async () => {
  const { auth, sender, phone, e164 } = setup();
  await auth.requestOtp(phone);
  const wrong = sender.last === '000000' ? '111111' : '000000';

  const results = await Promise.all(Array.from({ length: 20 }, () => outcome(auth.verifyOtp(phone, wrong))));
  assert.ok(results.every((r) => r instanceof UnauthorizedException));

  const row = await db!.otpRequest.findFirst({ where: { phone: e164 }, orderBy: { createdAt: 'desc' } });
  assert.equal(row!.attempts, OTP_MAX_ATTEMPTS);
  // Exhausted: even the right code is refused now.
  assert.ok((await outcome(auth.verifyOtp(phone, sender.last))) instanceof UnauthorizedException);
});

test('a correct code can be used only once, even in parallel', { skip }, async () => {
  const { auth, sender, phone } = setup();
  await auth.requestOtp(phone);
  const results = await Promise.all([1, 2, 3].map(() => outcome(auth.verifyOtp(phone, sender.last))));
  assert.equal(results.filter((r) => r === 'ok').length, 1);
});

test('a refresh token mints exactly one session under concurrency', { skip }, async () => {
  const { auth, sender, phone } = setup();
  await auth.requestOtp(phone);
  const { refreshToken } = await auth.verifyOtp(phone, sender.last);

  const results = await Promise.all([1, 2, 3].map(() => outcome(auth.refresh(refreshToken))));
  assert.equal(results.filter((r) => r === 'ok').length, 1);
});

test('a suspended user cannot refresh, and loses every session', { skip }, async () => {
  const { auth, sender, phone, e164 } = setup();
  await auth.requestOtp(phone);
  const { refreshToken } = await auth.verifyOtp(phone, sender.last);

  const user = await db!.user.update({ where: { phone: e164 }, data: { blockedAt: new Date() } });
  await assert.rejects(auth.refresh(refreshToken), UnauthorizedException);
  assert.equal(await db!.refreshToken.count({ where: { userId: user.id, revokedAt: null } }), 0);
});
