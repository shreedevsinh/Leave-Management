import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { DynamoModule } from '../../dynamo/dynamo.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../../common/guards/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      // ✅ IMPORTANT
      isGlobal: true,
    }),
    DynamoModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
