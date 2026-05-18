import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { DynamoModule } from '../../dynamo/dynamo.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../../common/guards/jwt.strategy';
import { getSecret } from '../../common/utils/secrets';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    DynamoModule,

    JwtModule.registerAsync({
      inject: [ConfigService],

      useFactory: async (
        config: ConfigService,
      ) => {
        let jwtSecret: string | undefined;
        let jwtExpiresIn: string | undefined;

        try {
          const secretJson = await getSecret(
            'leave-management/production-new',
          );

          const secret = JSON.parse(secretJson);

          jwtSecret = secret.JWT_SECRET;
          jwtExpiresIn =
            secret.JWT_EXPIRES_IN;
        } catch {
          jwtSecret =
            config.get<string>('JWT_SECRET');

          jwtExpiresIn =
            config.get<string>(
              'JWT_EXPIRES_IN',
            ) || '7d';
        }

        if (!jwtSecret) {
          throw new Error(
            'JWT_SECRET is missing',
          );
        }

        return {
          secret: jwtSecret,

          signOptions: {
            expiresIn: (jwtExpiresIn || '7d') as any,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersService,
    JwtStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
