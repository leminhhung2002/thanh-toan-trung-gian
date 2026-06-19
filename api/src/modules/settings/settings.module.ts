import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import {
  AdminSettingsController,
  HomepageBannersController,
  SettingsController,
} from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuditModule],
  controllers: [
    AdminSettingsController,
    HomepageBannersController,
    SettingsController,
  ],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
