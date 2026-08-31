import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { toUserDto, type UserDto, type UserLike } from './user.mapper';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { AuthUser, JwtPayload } from '../common/types/auth-user';

const BCRYPT_ROUNDS = 10;

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  bio: true,
  image: true,
  role: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private sign(user: UserLike): string {
    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role };
    return this.jwt.sign(payload);
  }

  private present(user: UserLike): UserDto {
    return toUserDto(user, this.sign(user));
  }

  async register(dto: RegisterDto): Promise<UserDto> {
    const username = dto.username.trim();
    const email = dto.email.trim().toLowerCase();

    // Pre-check for a friendly 409; the catch below still covers the race where two
    // concurrent registrations both pass this check.
    const clash = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (clash) {
      throw new ConflictException(
        clash.email === email ? 'email has already been taken' : 'username has already been taken',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      // `role` is never taken from the payload — ValidationPipe strips it, and it is
      // not referenced here either, so registration can never self-escalate to ADMIN.
      const user = await this.prisma.user.create({
        data: { username, email, passwordHash },
        select: USER_SELECT,
      });
      return this.present(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('username or email has already been taken');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<UserDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...USER_SELECT, passwordHash: true },
    });

    // One message for both branches: never reveal whether the address exists.
    const invalid = new UnauthorizedException('email or password is invalid');
    if (!user) {
      // Compare against a dummy hash anyway so response time does not leak existence.
      await bcrypt.compare(dto.password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
      throw invalid;
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw invalid;
    }

    const { passwordHash: _discard, ...safe } = user;
    return this.present(safe);
  }

  async currentUser(principal: AuthUser): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: principal.id },
      select: USER_SELECT,
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return this.present(user);
  }

  async update(principal: AuthUser, dto: UpdateUserDto): Promise<UserDto> {
    const username = dto.username?.trim();
    const email = dto.email?.trim().toLowerCase();

    if (username || email) {
      const clash = await this.prisma.user.findFirst({
        where: {
          id: { not: principal.id },
          OR: [
            ...(email ? [{ email }] : []),
            ...(username ? [{ username }] : []),
          ],
        },
        select: { email: true },
      });
      if (clash) {
        throw new ConflictException('username or email has already been taken');
      }
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: principal.id },
        data: {
          ...(username ? { username } : {}),
          ...(email ? { email } : {}),
          // Only hash when a password was actually supplied — an omitted field must
          // leave the existing hash untouched rather than locking the account out.
          ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS) } : {}),
          ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
          ...(dto.image !== undefined ? { image: dto.image } : {}),
        },
        select: USER_SELECT,
      });
      return this.present(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('username or email has already been taken');
      }
      throw error;
    }
  }
}

/** Prisma P2002 = unique constraint failed. Mapped to 409 rather than leaking a 500. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
