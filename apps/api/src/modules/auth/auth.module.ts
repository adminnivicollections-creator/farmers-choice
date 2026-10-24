import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpSender, otpSenderFor } from './otp-sender';

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
    {
      provide: OtpSender,
      inject: [ConfigService],
      useFactory: otpSenderFor,
    },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
