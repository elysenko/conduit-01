import type { User } from '@prisma/client';

export interface ProfileDto {
  username: string;
  bio: string;
  image: string;
  following: boolean;
}

export type ProfileSource = Pick<User, 'username' | 'bio' | 'image'>;

export function toProfileDto(user: ProfileSource, following: boolean): ProfileDto {
  return {
    username: user.username,
    bio: user.bio ?? '',
    image: user.image ?? '',
    following,
  };
}
