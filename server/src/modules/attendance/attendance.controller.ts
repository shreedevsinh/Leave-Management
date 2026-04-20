import { Controller, Get, Post, Put, Body, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('attendance')
@UseGuards(AuthGuard('jwt'))
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  checkIn(@Body() body: { userId: string; checkInTime: Date }) {
    return this.attendanceService.checkIn(body);
  }

  @Put('check-out')
  checkOut(@Body() body: { userId: string; checkOutTime: Date }) {
    return this.attendanceService.checkOut(body);
  }

  @Get('todays-attendance')
  getTodaysAttendance(@Query('userId') userId: string) {
    return this.attendanceService.getTodaysAttendance(userId);
  }
}
