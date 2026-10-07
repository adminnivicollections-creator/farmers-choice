import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma.service';
import {
  OTP_MAX_PER_WINDOW,
  OTP_TTL_MS,
  OTP_WINDOW_MS,
  checkOtp,
  generateCode,
  hashCode,
  newSalt,
  normalisePhone,
} from './otp';
import { OtpSender } from './otp-sender';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private sender: OtpSender,
  ) {}

  async requestOtp(rawPhone: string, ip?: string) {
    const phone = normalisePhone(rawPhone);
    if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');

    // Rate limit per phone. Cheap to count; there is no Redis yet and at this
    // volume Postgres is faster than the network call to one.
    const since = new Date(Date.now() - OTP_WINDOW_MS);
    const recent = await this.prisma.otpRequest.count({ where: { phone, createdAt: { gte: since } } });
    if (recent >= OTP_MAX_PER_WINDOW) {
      throw new BadRequestException('Too many codes requested. Try again in 15 minutes.');
    }

    const code = generateCode();
    const salt = newSalt();
    await this.prisma.otpRequest.create({
      data: {
        phone,
        salt,
        codeHash: hashCode(code, salt),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        requestIp: ip,
      },
    });

    await this.sender.send(phone, code);
    return { phone, expiresInSeconds: OTP_TTL_MS / 1000 };
  }

  async verifyOtp(rawPhone: string, code: string) {
    const phone = normalisePhone(rawPhone);
    if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');

    const row = await this.prisma.otpRequest.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const result = checkOtp(row, code);
    if (!result.ok) {
      if (row) {
        await this.prisma.otpRequest.update({
          where: { id: row.id },
          data: { attempts: { increment: 1 } },
        });
      }
      // One message for every failure: distinguishing "wrong code" from
      // "no such request" tells an attacker which numbers are registered.
      throw new UnauthorizedException('That code is not valid. Request a new one.');
    }

    await this.prisma.otpRequest.update({ where: { id: row!.id }, data: { consumedAt: new Date() } });

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: { lastSeenAt: new Date() },
      create: { phone, roles: { create: { role: 'FARMER' } } },
      include: { roles: true },
    });
    if (user.blockedAt) throw new UnauthorizedException('This account has been suspended.');

    const isNew = !user.name || !user.villageId;
    return { ...(await this.issueTokens(user.id, user.roles.map((r) => r.role))), profileComplete: !isNew };
  }

  async refresh(refreshToken: string) {
    const tokenHash = sha256(refreshToken);
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { roles: true } } },
    });
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Sign in again.');
    }
    // Rotate: the presented token dies as the new one is minted, so a stolen
    // refresh token is usable at most once.
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(row.userId, row.user.roles.map((r) => r.role));
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private async issueTokens(userId: string, roles: string[]) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, roles, typ: 'access' },
      { expiresIn: this.config.get('JWT_ACCESS_TTL', '15m') },
    );

    const refreshToken = randomBytes(32).toString('hex');
    const days = 30;
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + days * 864e5),
      },
    });

    return { accessToken, refreshToken, roles };
  }
}
