import { Module } from '@nestjs/common';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveTypesService } from './leave-types.service';
import { DynamoModule } from 'src/dynamo/dynamo.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    DynamoModule, // ✅ THIS IS THE FIX
    AuthModule,
  ],
  controllers: [LeaveTypesController],
  providers: [LeaveTypesService],
})
export class LeaveTypesModule {}
