import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toProfileDto, type ProfileDto } from './profile.mapper';
import type { AuthUser } from '../common/types/auth-user';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private async findUserOr404(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, bio: true, image: true },
    });
    if (!user) {
      throw new NotFoundException(`Profile "${username}" not found`);
    }
    return user;
  }

  private async isFollowing(viewerId: string | undefined, followedId: string): Promise<boolean> {
    if (!viewerId) {
      return false;
    }
    const row = await this.prisma.follow.findUnique({
      where: { followerId_followedId: { followerId: viewerId, followedId } },
      select: { followerId: true },
    });
    return row !== null;
  }

  async get(username: string, viewer: AuthUser | null): Promise<ProfileDto> {
    const user = await this.findUserOr404(username);
    return toProfileDto(user, await this.isFollowing(viewer?.id, user.id));
  }

  async follow(username: string, viewer: AuthUser): Promise<ProfileDto> {
    const target = await this.findUserOr404(username);

    if (target.id === viewer.id) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // upsert, not create: following twice is a no-op that still returns 200 rather
    // than surfacing a P2002 as a 500.
    await this.prisma.follow.upsert({
      where: { followerId_followedId: { followerId: viewer.id, followedId: target.id } },
      update: {},
      create: { followerId: viewer.id, followedId: target.id },
    });

    return toProfileDto(target, true);
  }

  async unfollow(username: string, viewer: AuthUser): Promise<ProfileDto> {
    const target = await this.findUserOr404(username);

    // deleteMany tolerates "was not following" without throwing P2025.
    await this.prisma.follow.deleteMany({
      where: { followerId: viewer.id, followedId: target.id },
    });

    return toProfileDto(target, false);
  }
}
