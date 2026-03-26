import { Body, Controller, Post, Get, Put, Param } from '@nestjs/common';
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

  // ✅ Get all leaves
  @Get()
  async getAllLeaves() {
    return this.leavesService.getAllLeaves();
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
