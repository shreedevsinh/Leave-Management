import { Body, Controller, Post, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { LeaveTypesService } from './leave-types.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('leave-types')
@UseGuards(AuthGuard('jwt'))
export class LeaveTypesController {
  constructor(private readonly LeaveTypesService: LeaveTypesService) {}

  @Get()
  async getAllLeaveTypes() {
    return this.LeaveTypesService.getAllLeaveTypes();
  }

  @Post()
  async createLeaveType(@Body() data: CreateLeaveTypeDto) {
    return this.LeaveTypesService.createLeaveType(data);
  }

  @Delete('/:id')
  async deleteLeaveType(@Param('id') id: string) {
    return this.LeaveTypesService.deleteLeaveType(id);
  }
}
