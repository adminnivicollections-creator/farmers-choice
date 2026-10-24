import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** One PrismaClient -- one connection pool -- for the whole app. Listing
 *  PrismaService in each module's providers made a client (and pool) each. */
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
