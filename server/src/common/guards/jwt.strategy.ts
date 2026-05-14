import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getSecret } from '../utils/secrets';
import { ConfigService } from '@nestjs/config'; 

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      secretOrKeyProvider: async (
        request,
        rawJwtToken,
        done,
      ) => {
        try {
          let jwtSecret: string | undefined;

          try {
            const secretJson = await getSecret(
              'leave-management/production-new',
            );

            jwtSecret = JSON.parse(secretJson).JWT_SECRET;
          } catch {
            jwtSecret =
              this.config.get<string>('JWT_SECRET');
          }

          if (!jwtSecret) {
            return done(
              new Error('JWT_SECRET is missing'),
              null,
            );
          }

          done(null, jwtSecret);
        } catch (error) {
          done(error, null);
        }
      },
    });
  }

  async validate(payload: any) {
    return payload;
  }
}
