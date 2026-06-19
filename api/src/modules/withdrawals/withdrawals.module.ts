import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { AuditModule } from '../audit/audit.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { WalletsModule } from '../wallets/wallets.module';
import {
  AdminWithdrawalsController,
  WithdrawalsController,
} from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  imports: [
    AssetsModule,
    AuditModule,
    IdempotencyModule,
    LedgerModule,
    NotificationsModule,
    ExchangeModule,
    SettingsModule,
    UsersModule,
    UserNotificationsModule,
    WalletsModule,
  ],
  controllers: [WithdrawalsController, AdminWithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
