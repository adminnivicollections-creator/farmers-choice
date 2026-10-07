import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LocationsModule } from './modules/locations/locations.module';
import { QrModule } from './modules/qr/qr.module';
import { FertilizerModule } from './modules/fertilizer/fertilizer.module';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { HealthController } from './modules/health/health.controller';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    AuthModule,
    UsersModule,
    LocationsModule,
    QrModule,
    FertilizerModule,
  ],
  // Deny by default: every route needs a token unless it says @Public().
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }, PrismaService],
})
export class AppModule {}
