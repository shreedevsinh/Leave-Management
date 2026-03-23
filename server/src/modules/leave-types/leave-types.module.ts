import { Module } from '@nestjs/common';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveTypesService } from './leave-types.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DynamoModule } from 'src/dynamo/dynamo.module';

@Module({
  imports: [
    PrismaModule,
    DynamoModule, // ✅ THIS IS THE FIX
  ],
  controllers: [LeaveTypesController],
  providers: [LeaveTypesService],
})
export class LeaveTypesModule {}
