import { Body, Controller, Post, Get, Delete, Param, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) { }

  @Post()
  async createUser(@Body() body: CreateUserDto) {
    return this.usersService.createUser(body);
  }

  @Put('/:id')
  async updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.usersService.updateUser(Number(id), body);
  }

  @Get('/employees/')
  async getEmployees() {
    return this.usersService.getEmployees();
  }

  @Delete('/:id')
  async deleteEmployee(@Param('id') id: string) {
    return this.usersService.deleteEmployee(id);
  }
}
