import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

/**
 * `expiresIn` is typed as the `ms` literal-union `StringValue`, which no
 * runtime-sourced string can satisfy, hence the cast:
 * numeric strings are converted to seconds; anything else is passed through as a
 * span like "7d".
 */
const JWT_EXPIRES_IN: JwtSignOptions['expiresIn'] = (() => {
  const raw = process.env.JWT_EXPIRES_IN ?? process.env.JWT_EXPIRATION ?? process.env.JWT_EXP ?? '7d';
  return (/^\d+$/.test(raw) ? Number(raw) : raw) as JwtSignOptions['expiresIn'];
})();

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: JWT_EXPIRES_IN },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // JwtStrategy is exported so every other feature module's guards resolve the
  // 'jwt' passport strategy without each re-registering it.
  exports: [AuthService, JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}
