import { Body, Controller, Post, Get, Put, Param, Query } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { CreateLeaveTypeDto } from '../leave-types/dto/create-leave-type.dto';

@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  // ✅ Create Leave
  @Post()
  async createLeave(@Body() dto: CreateLeaveDto) {
    return this.leavesService.createLeave(dto);
  }

  @Get()
  async getAllLeaves(
    @Query('limit') limit?: string,
    @Query('lastKey') lastKey?: any,
    @Query('employeeId') employeeId?: string, // ✅ FIXED
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    let parsedLastKey = null;
    if (lastKey) {
      try {
        parsedLastKey = JSON.parse(lastKey);
      } catch {
        console.warn('Invalid lastKey JSON');
      }
    }

    return this.leavesService.getAllLeaves(
      parsedLimit,
      parsedLastKey,
      employeeId, // ✅ FIXED
      startDate,
      endDate,
      status,
    );
  }

  // ✅ Get leaves by month and year
  @Get('/monthly/')
  async getLeavesByMonth(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    console.log('month', month, 'year', year);
    return this.leavesService.getLeavesByMonth(month, year);
  }

  // ✅ Get leave by ID
  @Get(':id')
  async getLeaveById(@Param('id') id: string) {
    return this.leavesService.getLeaveById(String(id));
  }

  @Put(':id')
  async updateLeaveStatus(@Param('id') id: string, @Body() body: any) {
    return this.leavesService.updateLeaveStatus(String(id), body);
  }
}
