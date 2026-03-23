import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DynamoModule } from 'src/dynamo/dynamo.module';

@Module({
  imports: [PrismaModule, DynamoModule], // ✅ Import modules
  controllers: [UsersController],
  providers: [UsersService], // ✅ Only your own service
  exports: [UsersService], // ✅ Export if needed elsewhere
})
export class UsersModule {}
