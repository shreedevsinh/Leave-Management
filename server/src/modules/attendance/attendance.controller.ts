import { Controller, Get, Post, Put } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) { }
  //   @Get()
  //   getMonthlyAttendance() {
  //     return this.attendanceService.getMonthlyAttendance(query.month, query.year);
  //   }
  @Post('check-in')
  checkIn() {
    return this.attendanceService.checkIn();
  }
  @Put('check-out')
  checkOut() {
    return this.attendanceService.checkOut();
  }
}
