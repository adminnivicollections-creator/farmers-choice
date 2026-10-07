import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConsoleOtpSender, Msg91OtpSender, OtpSender } from './otp-sender';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({ secret: c.getOrThrow<string>('JWT_SECRET') }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    {
      provide: OtpSender,
      inject: [ConfigService],
      useFactory: (c: ConfigService) =>
        c.get('OTP_PROVIDER') === 'msg91' ? new Msg91OtpSender(c) : new ConsoleOtpSender(),
    },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
