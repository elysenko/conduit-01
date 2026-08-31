import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterBodyDto } from './dto/register.dto';
import { LoginBodyDto } from './dto/login.dto';
import { UpdateUserBodyDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import type { UserDto } from './user.mapper';

@ApiTags('user')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('users')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() body: RegisterBodyDto): Promise<{ user: UserDto }> {
    return { user: await this.auth.register(body.user) };
  }

  @Post('users/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange email + password for a JWT' })
  async login(@Body() body: LoginBodyDto): Promise<{ user: UserDto }> {
    return { user: await this.auth.login(body.user) };
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user' })
  async me(@CurrentUser() principal: AuthUser): Promise<{ user: UserDto }> {
    return { user: await this.auth.currentUser(principal) };
  }

  @Put('user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the current user' })
  async update(
    @CurrentUser() principal: AuthUser,
    @Body() body: UpdateUserBodyDto,
  ): Promise<{ user: UserDto }> {
    return { user: await this.auth.update(principal, body.user) };
  }
}
