import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { AuditModule } from '../audit/audit.module';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { DepositReservationsController } from './deposit-reservations.controller';
import { DepositReservationsService } from './deposit-reservations.service';

@Module({
  imports: [
    AssetsModule,
    AuditModule,
    BankAccountsModule,
    NotificationsModule,
    SettingsModule,
  ],
  controllers: [DepositReservationsController],
  providers: [DepositReservationsService],
  exports: [DepositReservationsService],
})
export class DepositReservationsModule {}
