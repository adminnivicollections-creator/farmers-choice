import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

function requireProdSecrets() {
  if (process.env.NODE_ENV !== 'production') return;
  // Fail at boot, loudly, rather than serving traffic signed with a dev secret.
  const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing required env: ${missing.join(', ')}`);
  if ((process.env.JWT_SECRET ?? '').includes('dev-only')) {
    throw new Error('JWT_SECRET is still the development placeholder');
  }
}

async function bootstrap() {
  requireProdSecrets();
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // The mobile app is not a browser origin, so CORS only matters for the
  // future admin console. Lock it to an allowlist in production.
  const origins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins?.length ? origins : true });

  const port = Number(process.env.PORT ?? 3000);
  // 0.0.0.0, not localhost: a container that binds the loopback is unreachable.
  await app.listen(port, '0.0.0.0');
  new Logger('bootstrap').log(`API listening on http://localhost:${port}`);
}
bootstrap();
