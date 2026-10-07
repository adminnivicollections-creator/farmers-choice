import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsArray } from 'class-validator';
import { FertilizerService, CalcInput } from './fertilizer.service';
import { Public } from '../../common/public.decorator';

class CalcDto implements CalcInput {
  @IsString() state: string;
  @IsOptional() @IsString() district?: string;
  @IsString() cropSlug: string;
  @IsIn(['KHARIF', 'RABI', 'SUMMER', 'PERENNIAL']) season: any;
  @IsIn(['IRRIGATED', 'RAINFED']) irrigation: any;
  @IsNumber() @IsPositive() areaValue: number;
  @IsIn(['hectare', 'acre', 'gunta', 'cent', 'sqm']) areaUnit: any;
  @IsOptional() @IsArray() @IsString({ each: true }) productKeys?: string[];
}

@Controller('v1/fertilizer')
export class FertilizerController {
  constructor(private fert: FertilizerService) {}

  @Public() @Get('crops')
  crops() { return this.fert.crops(); }

  @Public() @Get('products')
  products() { return this.fert.products(); }

  @Public() @Post('calculate')
  calculate(@Body() dto: CalcDto) { return this.fert.calculate(dto); }
}
