import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { UsersService } from './users.service';
import { CurrentUser, AuthUser } from '../../common/current-user.decorator';
import { Public } from '../../common/public.decorator';

class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsIn(['te', 'hi', 'en']) preferredLang?: 'te' | 'hi' | 'en';
  @IsOptional() @IsUUID() villageId?: string;
}

@Controller('v1')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me') me(@CurrentUser() u: AuthUser) { return this.users.me(u.id); }

  @Patch('me') update(@CurrentUser() u: AuthUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(u.id, dto);
  }

  @Public() @Get('users/:id') profile(@Param('id') id: string) {
    return this.users.publicProfile(id);
  }
}
