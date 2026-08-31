import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type StrategyOptionsWithoutRequest } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser, JwtPayload } from '../common/types/auth-user';

/**
 * Accepts BOTH `Authorization: Token <jwt>` (the RealWorld convention the Angular
 * interceptor sends) and `Authorization: Bearer <jwt>` (what Swagger UI and most
 * HTTP clients send). Supporting one only would silently 401 half the callers.
 */
export function extractJwt(request: Request): string | null {
  const header = request?.headers?.authorization;
  if (typeof header !== 'string') {
    return null;
  }
  const match = /^(Token|Bearer)\s+(.+)$/i.exec(header.trim());
  return match ? match[2].trim() : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors<Request>([extractJwt]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change-me-in-production',
    } satisfies StrategyOptionsWithoutRequest);
  }

  /**
   * Re-reads the user on every request so a deleted or renamed account cannot keep
   * acting on a still-valid token, and so `role` is never stale relative to the DB.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload?.sub ?? '' },
      select: { id: true, username: true, email: true, bio: true, image: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
