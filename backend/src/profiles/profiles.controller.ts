import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import type { ProfileDto } from './profile.mapper';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get(':username')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Public profile; `following` reflects the viewer when authenticated' })
  async get(
    @Param('username') username: string,
    @CurrentUser() viewer: AuthUser | null,
  ): Promise<{ profile: ProfileDto }> {
    return { profile: await this.profiles.get(username, viewer) };
  }

  @Post(':username/follow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async follow(
    @Param('username') username: string,
    @CurrentUser() viewer: AuthUser,
  ): Promise<{ profile: ProfileDto }> {
    return { profile: await this.profiles.follow(username, viewer) };
  }

  @Delete(':username/follow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async unfollow(
    @Param('username') username: string,
    @CurrentUser() viewer: AuthUser,
  ): Promise<{ profile: ProfileDto }> {
    return { profile: await this.profiles.unfollow(username, viewer) };
  }
}
