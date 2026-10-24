import { Module } from '@nestjs/common';
import { FertilizerController } from './fertilizer.controller';
import { FertilizerService } from './fertilizer.service';

@Module({ controllers: [FertilizerController], providers: [FertilizerService] })
export class FertilizerModule {}
