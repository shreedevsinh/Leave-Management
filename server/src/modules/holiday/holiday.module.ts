import { Module } from '@nestjs/common';
import { HolidayService } from './holiday.service';
import { HolidayController } from './holiday.controller';
import { DynamoModule } from '../../dynamo/dynamo.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
      DynamoModule, // ✅ THIS IS THE FIX
      AuthModule,
    ],
  controllers: [HolidayController],
  providers: [HolidayService],
})
export class HolidayModule {}
