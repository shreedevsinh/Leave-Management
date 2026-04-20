import { Module } from '@nestjs/common';
import { OfficetimeController } from './officetime.controller';
import { OfficetimeService } from './officetime.service';
import { DynamoModule } from 'src/dynamo/dynamo.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DynamoModule, AuthModule],
  controllers: [OfficetimeController],
  providers: [OfficetimeService],
})
export class OfficetimeModule {}
