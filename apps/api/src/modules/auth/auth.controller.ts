import { Body, Controller, Ip, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '../../common/public.decorator';
import { CurrentUser, AuthUser } from '../../common/current-user.decorator';

class RequestOtpDto { @IsString() phone: string; }
class VerifyOtpDto { @IsString() phone: string; @IsString() @MinLength(4) code: string; }
class RefreshDto { @IsString() refreshToken: string; }

@Controller('v1/auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public() @Post('otp/request')
  request(@Body() dto: RequestOtpDto, @Ip() ip: string) {
    return this.auth.requestOtp(dto.phone, ip);
  }

  @Public() @Post('otp/verify')
  verify(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  @Public() @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user.id);
  }
}
