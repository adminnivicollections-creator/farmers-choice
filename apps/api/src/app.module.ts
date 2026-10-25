import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LocationsModule } from './modules/locations/locations.module';
import { QrModule } from './modules/qr/qr.module';
import { FertilizerModule } from './modules/fertilizer/fertilizer.module';
import { WeatherModule } from './modules/weather/weather.module';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { HealthController } from './modules/health/health.controller';
import { PrismaModule } from './prisma.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    // Per client IP. Sensitive routes tighten this with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule,
    UsersModule,
    LocationsModule,
    QrModule,
    FertilizerModule,
    WeatherModule,
  ],
  // Deny by default: every route needs a token unless it says @Public().
  controllers: [HealthController],
  // Throttle first, so a flood is turned away before any token check or query.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
