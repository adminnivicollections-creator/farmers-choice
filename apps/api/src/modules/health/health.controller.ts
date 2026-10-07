import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Public } from '../../common/public.decorator';

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  /** Checks the database too -- an API that cannot query is not healthy. */
  @Public() @Get('healthz')
  async health() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: 'up', ms: Date.now() - started };
    } catch {
      return { ok: false, db: 'down', ms: Date.now() - started };
    }
  }
}
