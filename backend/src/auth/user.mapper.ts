import type { User, UserRole } from '@prisma/client';

/** The `{ user: ... }` envelope body. `passwordHash` is structurally unreachable here. */
export interface UserDto {
  id: string;
  email: string;
  token: string;
  username: string;
  bio: string;
  image: string;
  role: UserRole;
}

export type UserLike = Pick<User, 'id' | 'email' | 'username' | 'bio' | 'image' | 'role'>;

/**
 * `bio` / `image` are nullable in Postgres but the Angular models declare them as
 * plain strings; coalescing here keeps the client free of null checks.
 */
export function toUserDto(user: UserLike, token: string): UserDto {
  return {
    id: user.id,
    email: user.email,
    token,
    username: user.username,
    bio: user.bio ?? '',
    image: user.image ?? '',
    role: user.role,
  };
}
