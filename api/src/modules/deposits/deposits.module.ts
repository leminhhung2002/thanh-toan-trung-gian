import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { AuditModule } from '../audit/audit.module';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { WalletsModule } from '../wallets/wallets.module';
import {
  AdminDepositsController,
  DepositsController,
} from './deposits.controller';
import { DepositsService } from './deposits.service';

@Module({
  imports: [
    AssetsModule,
    AuditModule,
    BankAccountsModule,
    IdempotencyModule,
    LedgerModule,
    NotificationsModule,
    UserNotificationsModule,
    WalletsModule,
  ],
  controllers: [DepositsController, AdminDepositsController],
  providers: [DepositsService],
  exports: [DepositsService],
})
export class DepositsModule {}
