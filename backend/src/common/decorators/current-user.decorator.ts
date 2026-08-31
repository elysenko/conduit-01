import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth-user';

/**
 * Resolves the authenticated principal placed on the request by JwtStrategy.
 *
 * Returns `null` (never throws) when the route is protected by
 * OptionalJwtAuthGuard and the caller is anonymous, so read endpoints can
 * compute viewer-relative flags (`favorited`, `following`) uniformly.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | null => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    return request.user ?? null;
  },
);
