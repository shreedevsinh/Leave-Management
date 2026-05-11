import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { DynamoModule } from '../../dynamo/dynamo.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DynamoModule, AuthModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
