import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma/prisma.module';
import { DynamoModule } from './dynamo/dynamo.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { LeaveTypesModule } from './modules/leave-types/leave-types.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    DynamoModule,
    AuthModule,
    UsersModule,
    LeavesModule,
    LeaveTypesModule,
  ],
})
export class AppModule {}
