import type { UserRole } from '@prisma/client';

/** The principal shape JwtStrategy.validate() puts on `request.user`. */
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  bio: string | null;
  image: string | null;
  role: UserRole;
}

/** Claims carried in the signed JWT. */
export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
}
