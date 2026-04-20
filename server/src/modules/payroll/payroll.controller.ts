import { Controller, Get, Query } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { GetPayrollDto } from './dto/get-payroll.dto';
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
  generateMonthlyPayroll(@Query() query: GetPayrollDto) {
    return this.payrollService.generateMonthlyPayroll(query.month, query.year);
  }
}
