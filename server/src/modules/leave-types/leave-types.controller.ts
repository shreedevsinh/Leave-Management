import { Body, Controller, Post, Get, Delete, Param } from '@nestjs/common';
import { LeaveTypesService } from './leave-types.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';

@Controller('leave-types')
export class LeaveTypesController {
  constructor(private readonly LeaveTypesService: LeaveTypesService) {}

  @Get()
  async getAllLeaveTypes() {
    return this.LeaveTypesService.getAllLeaveTypes();
  }

  @Post()
  async createLeaveType(@Body() dto: CreateLeaveTypeDto) {
    return this.LeaveTypesService.createLeaveType(dto);
  }

  @Delete('/:id')
  async deleteLeaveType(@Param('id') id: string) {
    return this.LeaveTypesService.deleteLeaveType(id);
  }
}
