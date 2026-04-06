import { Module } from '@nestjs/common';
import { OfficetimeController } from './officetime.controller';
import { OfficetimeService } from './officetime.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DynamoModule } from 'src/dynamo/dynamo.module';

@Module({
  imports: [PrismaModule, DynamoModule],
  controllers: [OfficetimeController],
  providers: [OfficetimeService],
})
export class OfficetimeModule {}
