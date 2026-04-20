import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DynamoModule } from './dynamo/dynamo.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { LeaveTypesModule } from './modules/leave-types/leave-types.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { OfficetimeModule } from './modules/officetime/officetime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DynamoModule,
    AuthModule,
    UsersModule,
    LeavesModule,
    LeaveTypesModule,
    PayrollModule,
    AttendanceModule,
    OfficetimeModule,
  ],
})
export class AppModule {}
