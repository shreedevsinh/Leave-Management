import { Body, Get, Controller, Param, Put, Post } from '@nestjs/common';
import { OfficetimeService } from './officetime.service';

@Controller('officetime')
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
  getAllOfficeTimings() {
    return this.officetimeService.getAllOfficeTimings();
  }

  // ✅ Set active office timing
  @Put('/active/:id')
  activateOfficeTime(@Param('id') id: string) {
    return this.officetimeService.setActive(id);
  }
}
