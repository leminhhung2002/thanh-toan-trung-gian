import { BankAccountHousekeepingService } from './bank-account-housekeeping.service';

describe('BankAccountHousekeepingService', () => {
  it('runs reservation expiry housekeeping', async () => {
    const bankAccountsService = {
      expireStaleReservations: jest.fn().mockResolvedValue(undefined),
      ensureUsageDateCurrent: jest.fn().mockResolvedValue(undefined),
    };

    const service = new BankAccountHousekeepingService(
      bankAccountsService as never,
    );

    await service.expireStaleReservations();

    expect(bankAccountsService.expireStaleReservations).toHaveBeenCalledTimes(
      1,
    );
    expect(bankAccountsService.ensureUsageDateCurrent).not.toHaveBeenCalled();
  });

  it('runs daily usage-date housekeeping', async () => {
    const bankAccountsService = {
      expireStaleReservations: jest.fn().mockResolvedValue(undefined),
      ensureUsageDateCurrent: jest.fn().mockResolvedValue(undefined),
    };

    const service = new BankAccountHousekeepingService(
      bankAccountsService as never,
    );

    await service.resetDailyUsageDate();

    expect(bankAccountsService.ensureUsageDateCurrent).toHaveBeenCalledTimes(1);
    expect(bankAccountsService.expireStaleReservations).not.toHaveBeenCalled();
  });
});
