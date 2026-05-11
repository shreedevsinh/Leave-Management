import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { DynamoModule } from '../../dynamo/dynamo.module';
import { PayrollModule } from '../payroll/payroll.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ DynamoModule, PayrollModule, AuthModule ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
