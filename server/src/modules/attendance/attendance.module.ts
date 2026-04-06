import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DynamoModule } from 'src/dynamo/dynamo.module';

@Module({
  imports: [PrismaModule, DynamoModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
