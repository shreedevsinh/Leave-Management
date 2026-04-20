import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DynamoModule } from 'src/dynamo/dynamo.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DynamoModule, AuthModule], // ✅ Import modules
  controllers: [UsersController],
  providers: [UsersService], // ✅ Only your own service
  exports: [UsersService], // ✅ Export if needed elsewhere
})
export class UsersModule {}
