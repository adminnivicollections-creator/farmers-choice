import { Module } from '@nestjs/common';
import { FertilizerController } from './fertilizer.controller';
import { FertilizerService } from './fertilizer.service';
import { PrismaService } from '../../prisma.service';

@Module({ controllers: [FertilizerController], providers: [FertilizerService, PrismaService] })
export class FertilizerModule {}
