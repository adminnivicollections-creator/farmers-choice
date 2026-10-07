import { Controller, Get, Param, ParseFloatPipe, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { Public } from '../../common/public.decorator';

@Controller('v1/locations')
export class LocationsController {
  constructor(private locations: LocationsService) {}

  // Public: the village picker runs during onboarding, before there is a token.
  @Public() @Get('search')
  search(@Query('q') q: string, @Query('lang') lang: any) {
    return this.locations.search(q, lang);
  }

  @Public() @Get('resolve')
  resolve(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('lang') lang: any,
  ) {
    return this.locations.resolve(lat, lng, lang);
  }

  @Public() @Get(':id/children')
  children(@Param('id') id: string, @Query('lang') lang: any) {
    return this.locations.children(id, lang);
  }
}
