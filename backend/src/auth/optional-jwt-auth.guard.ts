import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '../common/types/auth-user';

/**
 * Soft gate for public reads. A missing or invalid token yields `request.user = null`
 * instead of a 401, so anonymous visitors get the page while authenticated visitors
 * get viewer-relative `favorited` / `following` flags on the same handler.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthUser | null>(
    _err: unknown,
    user: unknown,
    _info: unknown,
    _context: ExecutionContext,
  ): TUser {
    return (user ?? null) as TUser;
  }
}
