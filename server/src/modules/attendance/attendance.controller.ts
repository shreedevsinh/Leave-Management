import { Controller, Get, Post, Put, Body, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  checkIn(@Body() body: { userId: string; checkInTime: Date }) {
    console.log('📥 CheckIn request received:', body);
    return this.attendanceService.checkIn(body);
  }

  @Put('check-out')
  checkOut(@Body() body: { userId: string; checkOutTime: Date }) {
    console.log('📥 CheckOut request received:', body);
    return this.attendanceService.checkOut(body);
  }

  @Get('todays-attendance')
  getTodaysAttendance(@Query('userId') userId: string) {
    return this.attendanceService.getTodaysAttendance(userId);
  }
}
