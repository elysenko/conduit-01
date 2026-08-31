import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminSettingsService, type ServiceSettingView } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/settings')
// Guard order matters: JwtAuthGuard establishes the principal (401 when absent),
// RolesGuard then checks the role (403 when present but not ADMIN).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Service credentials with masked values and configured status' })
  list(): Promise<ServiceSettingView[]> {
    return this.settings.list();
  }

  @Patch()
  @ApiOperation({ summary: 'Upsert settings from a flat key/value map' })
  update(@Body() body: Record<string, unknown>): Promise<ServiceSettingView[]> {
    return this.settings.update(body);
  }
}
