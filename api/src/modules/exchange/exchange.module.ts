import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { AuditModule } from '../audit/audit.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { LedgerModule } from '../ledger/ledger.module';
import { SettingsModule } from '../settings/settings.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { WalletsModule } from '../wallets/wallets.module';
import {
  AdminExchangeController,
  ExchangeController,
} from './exchange.controller';
import { ExchangePricingService } from './exchange-pricing.service';
import { ExchangeService } from './exchange.service';

@Module({
  imports: [
    AssetsModule,
    AuditModule,
    IdempotencyModule,
    LedgerModule,
    SettingsModule,
    UserNotificationsModule,
    WalletsModule,
  ],
  controllers: [ExchangeController, AdminExchangeController],
  providers: [ExchangePricingService, ExchangeService],
  exports: [ExchangePricingService, ExchangeService],
})
export class ExchangeModule {}
