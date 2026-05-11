import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { GetPayrollDto } from './dto/get-payroll.dto';
import { GetPayrollDetailsDto } from './dto/get-payroll-details.dto';
import { PayrollDetailsResponseDto } from './dto/payroll-details.dto';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('payroll')
@UseGuards(AuthGuard('jwt'))
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  getMonthlyPayroll(@Query() query: GetPayrollDto) {
    return this.payrollService.getMonthlyPayroll(
      Number(query.month),
      Number(query.year), 
      Number(query.limit) || 10,
      query.cursor || null,
    );
  }

  @Get('generate')
  generateMonthlyPayroll(@Query() query: { month: number; year: number }) {
    return this.payrollService.generateMonthlyPayroll(query.month, query.year);
  }

  @Get('details')
  getEmployeeMonthlyDetails(
    @Query() query: GetPayrollDetailsDto,
  ): Promise<PayrollDetailsResponseDto> {
    return this.payrollService.getEmployeeMonthlyDetails(
      query.userId,
      Number(query.month),
      Number(query.year),
    );
  }

  @Post('mark-attendance')
  markAttendance(@Body() data: any) {
    return this.payrollService.markAttendance(data);
  }
}
