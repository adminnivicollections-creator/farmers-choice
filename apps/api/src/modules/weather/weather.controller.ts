import { BadRequestException, Controller, Get, ParseFloatPipe, Query } from '@nestjs/common';
import { Public } from '../../common/public.decorator';
import { WeatherService } from './weather.service';

@Controller('v1/weather')
export class WeatherController {
  constructor(private weather: WeatherService) {}

  /** Public: the home screen shows weather with no sign-in. */
  @Public() @Get()
  get(@Query('lat', ParseFloatPipe) lat: number, @Query('lon', ParseFloatPipe) lon: number) {
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new BadRequestException('Invalid coordinates');
    return this.weather.forecast(lat, lon);
  }
}
