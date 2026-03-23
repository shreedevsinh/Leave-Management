import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DynamoModule } from 'src/dynamo/dynamo.module';

@Module({
  imports: [
    PrismaModule,
    DynamoModule, // ✅ THIS IS THE FIX
  ],
  controllers: [LeavesController],
  providers: [LeavesService],
})
export class LeavesModule {}
