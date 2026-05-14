import { Body, Get, Controller, Param, Put, Post, Req, UseGuards } from '@nestjs/common';
import { OfficetimeService } from './officetime.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('officetime')
@UseGuards(AuthGuard('jwt'))
export class OfficetimeController {
  constructor(private readonly officetimeService: OfficetimeService) {}

  // ✅ Create new office timing
  @Post()
  createOfficeTime(
    @Body()
    body: {
      startTime: string;
      endTime: string;
      workingHours: number;
      graceMinutes: number;
    },
  ) {
    return this.officetimeService.create(body);
  }

  @Get()
  getAllOfficeTimings(@Req() req) {
    return this.officetimeService.getAllOfficeTimings();
  }

  @Get('active')
  getActiveOfficeTiming(@Req() req) {
    return this.officetimeService.getActiveOfficeTiming();
  }

  // ✅ Set active office timing
  @Put('/active/:id')
  activateOfficeTime(@Param('id') id: string) {
    return this.officetimeService.setActive(id);
  }
}
