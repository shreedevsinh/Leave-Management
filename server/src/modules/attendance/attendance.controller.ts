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
import type { Request } from 'express';

@Controller('attendance')
@UseGuards(AuthGuard('jwt'))
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  async checkIn(
    @Body() body: { userId: string; checkInTime?: Date },
    @Req() req: Request,
  ) {
    const clientIp = req.ip || (req.socket as any)?.remoteAddress;
    const OFFICE_IP = process.env.OFFICE_IP;
    // const SKIP_IP_CHECK = process.env.SKIP_IP_CHECK === 'true'; // Dev flag

    // if (!SKIP_IP_CHECK && clientIp !== OFFICE_IP) {
    if (clientIp !== OFFICE_IP) {
      throw new BadRequestException(
        `Check-in only allowed from office. Your IP: ${clientIp}`,
      );
    }

    return this.attendanceService.checkIn(body);
  }

  @Put('check-out')
  async checkOut(
    @Body() body: { userId: string; checkOutTime: Date },
    @Req() req: Request,
  ) {
    const clientIp = req.ip || (req.socket as any)?.remoteAddress;
    const OFFICE_IP = process.env.OFFICE_IP;
    // const SKIP_IP_CHECK = process.env.SKIP_IP_CHECK === 'true'; // Dev flag

    // if (!SKIP_IP_CHECK && clientIp !== OFFICE_IP) {
    if (clientIp !== OFFICE_IP) {
      throw new BadRequestException(
        `Check-out only allowed from office. Your IP: ${clientIp}`,
      );
    }
    return this.attendanceService.checkOut(body);
  }

  @Get('todays-attendance')
  getTodaysAttendance(@Query('userId') userId: string) {
    return this.attendanceService.getTodaysAttendance(userId);
  }
}
