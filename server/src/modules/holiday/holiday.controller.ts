import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  UseInterceptors,
  UploadedFile,
  Delete,
  Param,
  UseGuards
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { HolidayService } from './holiday.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';

import { AuthGuard } from '@nestjs/passport';


@Controller('holidays')
@UseGuards(AuthGuard('jwt'))
export class HolidayController {
  constructor(private readonly holidayService: HolidayService) {}

  @Post()
  create(@Body() createHolidayDto: CreateHolidayDto) {
    return this.holidayService.create(createHolidayDto);
  }

  @Get('/monthly/')
  async getHolidaysByMonth(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.holidayService.getHolidaysByMonth(month, year);
  }

  @Post('/bulk/')
  @UseInterceptors(FileInterceptor('file'))
  uploadBulk(@UploadedFile() file: any) {
    return this.holidayService.bulkUpload(file);
  }

  @Delete(':id')
  deleteHoliday(@Param('id') id: string) {
    return this.holidayService.deleteHoliday(id);
  }
}