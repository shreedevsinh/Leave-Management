import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Put,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  async createUser(@Body() body: CreateUserDto) {
    console.log("body");  
    return this.usersService.createUser(body);
  }

  @Put('/:id')
  async updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.usersService.updateUser(String(id), body);
  }

  @Put('user/:id')
  async updateUserNameEmail(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.usersService.updateUserNameEmail(String(id), body);
  }

  @Put('/:id/salary-type')
  async updateUserSalaryType(
    @Param('id') id: string,
    @Body() body: { isHourly: boolean },
  ) {
    return this.usersService.updateUserSalaryType(String(id), body.isHourly);
  }

  @Get('/employees/')
  async getEmployees() {
    return this.usersService.getEmployees();
  }

  @Get('/employee/:id')
  async getEmployee(@Param('id') id: string) {
    return this.usersService.getEmployee(id);
  }

  @Post('/:id/salary')
  async updateSalary(
    @Param('id') id: string,
    @Body() body: { newSalary: number },
  ) {
    return this.usersService.updateSalary(id, body.newSalary);
  }

  @Delete('/:id')
  async deleteEmployee(@Param('id') id: string) {
    return this.usersService.deleteEmployee(id);
  }
}
