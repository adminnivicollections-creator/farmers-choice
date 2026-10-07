import { Body, Controller, Post } from '@nestjs/common';
import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';
import { QrService } from './qr.service';
import { Public } from '../../common/public.decorator';
import { MAX_RAW_LENGTH } from './qr-code';

class ResolveDto {
  @IsString() @MaxLength(MAX_RAW_LENGTH) raw: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  /// Anonymous, app-generated id. Not a login -- it only lets the counterfeit
  /// heuristic tell "one person scanning twice" from "two people in two places".
  @IsOptional() @IsString() @MaxLength(64) deviceId?: string;
}

@Controller('v1/qr')
export class QrController {
  constructor(private qr: QrService) {}

  /** Opaque code in, typed meaning out. No login: anyone can check a seed packet. */
  @Public()
  @Post('resolve')
  resolve(@Body() dto: ResolveDto) {
    return this.qr.resolve(dto);
  }
}
