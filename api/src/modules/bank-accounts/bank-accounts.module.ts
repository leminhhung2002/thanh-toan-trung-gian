import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminBankAccountsController } from './bank-accounts.controller';
import { BankAccountHousekeepingService } from './bank-account-housekeeping.service';
import { BankAccountsService } from './bank-accounts.service';

@Module({
  imports: [AuditModule],
  controllers: [AdminBankAccountsController],
  providers: [BankAccountHousekeepingService, BankAccountsService],
  exports: [BankAccountsService],
})
export class BankAccountsModule {}
