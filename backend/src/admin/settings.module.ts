import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminSettingsController } from './settings.controller';
import { AdminSettingsService } from './settings.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminSettingsController],
  providers: [AdminSettingsService],
  exports: [AdminSettingsService],
})
export class AdminSettingsModule {}
