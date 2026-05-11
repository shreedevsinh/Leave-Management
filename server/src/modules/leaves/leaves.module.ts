import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { DynamoModule } from '../../dynamo/dynamo.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    DynamoModule, // ✅ THIS IS THE FIX
    AuthModule,
  ],
  controllers: [LeavesController],
  providers: [LeavesService],
})
export class LeavesModule {}
