import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BankAccountsService } from './bank-accounts.service';

const BANK_ACCOUNT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

@Injectable()
export class BankAccountHousekeepingService {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleReservations() {
    await this.bankAccountsService.expireStaleReservations();
  }

  @Cron('0 0 * * *', {
    timeZone: BANK_ACCOUNT_TIME_ZONE,
  })
  async resetDailyUsageDate() {
    await this.bankAccountsService.ensureUsageDateCurrent();
  }
}
