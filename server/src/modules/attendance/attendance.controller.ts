import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { validateOfficeLocation } from '../../common/utils/location-check';

@Controller('attendance')
@UseGuards(AuthGuard('jwt'))
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  async checkIn(
    @Body()
    body: {
      userId: string;
      lat: number;
      lng: number;
    },
  ) {
    await validateOfficeLocation(
      body.lat,
      body.lng,
    );

    return this.attendanceService.checkIn(body);
  }

  @Put('check-out')
  async checkOut(
    @Body() body: { userId: string; checkOutTime: Date; lat: number; lng: number },
  ) {
    await validateOfficeLocation(
      body.lat,
      body.lng,
    );

    return this.attendanceService.checkOut(body);
  }

  @Get('todays-attendance')
  getTodaysAttendance(@Query('userId') userId: string) {
    return this.attendanceService.getTodaysAttendance(userId);
  }
}
