import { UsersService } from './users.service';

describe('UsersService.updateProfile', () => {
  it('requires the current password when phone or telegram changes', async () => {
    const selectFromUsersWhere = jest
      .fn()
      .mockResolvedValue([
        {
          email: 'user@example.com',
          id: 'user-1',
          phone: '0901234567',
          telegram: '@wallet',
          twoFactorEnabled: true,
        },
      ]);
    const selectFromUserRolesWhere = jest.fn().mockResolvedValue([]);
    const updateSet = jest.fn().mockResolvedValue(undefined);
    const databaseService = {
      db: {
        select: jest
          .fn()
          .mockReturnValueOnce({
            from: jest.fn().mockReturnValue({
              where: selectFromUsersWhere,
            }),
          })
          .mockReturnValueOnce({
            from: jest.fn().mockReturnValue({
              where: selectFromUsersWhere,
            }),
          })
          .mockReturnValueOnce({
            from: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                where: selectFromUserRolesWhere,
              }),
            }),
          }),
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: updateSet,
          }),
        }),
      },
    };

    const passwordConfirmationService = {
      assertValidCurrentPassword: jest.fn().mockResolvedValue(undefined),
    };

    const service = new UsersService(
      {} as never,
      {} as never,
      databaseService as never,
      {} as never,
      passwordConfirmationService as never,
      {} as never,
    );

    await service.updateProfile('user-1', {
      currentPassword: 'Secret123!',
      phone: '0908888888',
      telegram: '@wallet',
    });

    expect(passwordConfirmationService.assertValidCurrentPassword).toHaveBeenCalledWith(
      'user-1',
      'Secret123!',
    );
    expect(updateSet).toHaveBeenCalled();
  });

  it('does not require password confirmation when the submitted values do not change', async () => {
    const selectFromUsersWhere = jest
      .fn()
      .mockResolvedValue([
        {
          email: 'user@example.com',
          id: 'user-1',
          phone: '0901234567',
          telegram: '@wallet',
          twoFactorEnabled: true,
        },
      ]);
    const selectFromUserRolesWhere = jest.fn().mockResolvedValue([]);
    const databaseService = {
      db: {
        select: jest
          .fn()
          .mockReturnValueOnce({
            from: jest.fn().mockReturnValue({
              where: selectFromUsersWhere,
            }),
          })
          .mockReturnValueOnce({
            from: jest.fn().mockReturnValue({
              where: selectFromUsersWhere,
            }),
          })
          .mockReturnValueOnce({
            from: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                where: selectFromUserRolesWhere,
              }),
            }),
          }),
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
          }),
        }),
      },
    };

    const passwordConfirmationService = {
      assertValidCurrentPassword: jest.fn().mockResolvedValue(undefined),
    };

    const service = new UsersService(
      {} as never,
      {} as never,
      databaseService as never,
      {} as never,
      passwordConfirmationService as never,
      {} as never,
    );

    await service.updateProfile('user-1', {
      phone: '0901234567',
      telegram: 'https://t.me/wallet',
    });

    expect(passwordConfirmationService.assertValidCurrentPassword).not.toHaveBeenCalled();
  });

  it('normalizes telegram usernames before comparing and storing them', async () => {
    const selectFromUsersWhere = jest
      .fn()
      .mockResolvedValue([
        {
          email: 'user@example.com',
          id: 'user-1',
          phone: '0901234567',
          telegram: '@wallet',
          twoFactorEnabled: true,
        },
      ]);
    const selectFromUserRolesWhere = jest.fn().mockResolvedValue([]);
    const updateWhere = jest.fn().mockResolvedValue(undefined);
    const updateSet = jest.fn().mockReturnValue({
      where: updateWhere,
    });
    const databaseService = {
      db: {
        select: jest
          .fn()
          .mockReturnValueOnce({
            from: jest.fn().mockReturnValue({
              where: selectFromUsersWhere,
            }),
          })
          .mockReturnValueOnce({
            from: jest.fn().mockReturnValue({
              where: selectFromUsersWhere,
            }),
          })
          .mockReturnValueOnce({
            from: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                where: selectFromUserRolesWhere,
              }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          set: updateSet,
        }),
      },
    };

    const passwordConfirmationService = {
      assertValidCurrentPassword: jest.fn().mockResolvedValue(undefined),
    };

    const service = new UsersService(
      {} as never,
      {} as never,
      databaseService as never,
      {} as never,
      passwordConfirmationService as never,
      {} as never,
    );

    await service.updateProfile('user-1', {
      currentPassword: 'Secret123!',
      phone: '0901234567',
      telegram: 'https://t.me/new_wallet',
    });

    expect(updateSet).toHaveBeenCalledWith({
      phone: '0901234567',
      telegram: 'new_wallet',
    });
    expect(updateWhere).toHaveBeenCalled();
  });

  it('rejects malformed telegram links', async () => {
    const databaseService = {
      db: {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              {
                email: 'user@example.com',
                id: 'user-1',
                phone: '0901234567',
                telegram: '@wallet',
                twoFactorEnabled: true,
              },
            ]),
          }),
        }),
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
          }),
        }),
      },
    };

    const service = new UsersService(
      {} as never,
      {} as never,
      databaseService as never,
      {} as never,
      { assertValidCurrentPassword: jest.fn() } as never,
      {} as never,
    );

    await expect(
      service.updateProfile('user-1', {
        telegram: 'https://t.me/wallet/extra',
        currentPassword: 'Secret123!',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'telegram_username_invalid',
      },
    });
  });
});

describe('UsersService.getProfile', () => {
  it('returns normalized telegram usernames for legacy stored links', async () => {
    const databaseService = {
      db: {
        select: jest
          .fn()
          .mockReturnValueOnce({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([
                {
                  email: 'user@example.com',
                  id: 'user-1',
                  phone: '0901234567',
                  telegram: 'https://t.me/walletuser',
                  twoFactorEnabled: true,
                },
              ]),
            }),
          })
          .mockReturnValueOnce({
            from: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
      },
    };

    const service = new UsersService(
      {} as never,
      {} as never,
      databaseService as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getProfile('user-1')).resolves.toMatchObject({
      telegram: 'walletuser',
    });
  });
});

describe('UsersService.listForAdmin', () => {
  function createListForAdminService() {
    const userRows = [
      {
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
        email: 'alice@example.com',
        id: 'user-alice',
        isActive: true,
        passwordHash: 'hash',
        phone: '0901234567',
        telegram: null,
        twoFactorEnabled: false,
      },
      {
        createdAt: new Date('2026-04-11T00:00:00.000Z'),
        email: 'bob@example.com',
        id: 'user-bob',
        isActive: true,
        passwordHash: 'hash',
        phone: '0987654321',
        telegram: null,
        twoFactorEnabled: false,
      },
    ];

    const databaseService = {
      db: {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(userRows),
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue(userRows),
            }),
          }),
        }),
      },
    };

    const service = new UsersService(
      {} as never,
      {} as never,
      databaseService as never,
      {} as never,
      {} as never,
      {} as never,
    );

    jest
      .spyOn(service as never, 'getRoleRows')
      .mockResolvedValue([] as never);
    jest
      .spyOn(service as never, 'getWalletRows')
      .mockResolvedValue([] as never);
    jest
      .spyOn(service as never, 'getApprovedDepositTotals')
      .mockResolvedValue(new Map() as never);
    jest
      .spyOn(service as never, 'getApprovedWithdrawalTotals')
      .mockResolvedValue(new Map() as never);
    jest
      .spyOn(service as never, 'toAdminUserSummary')
      .mockImplementation((user) => ({
        balances: {
          usdt: { available: '0.000000', pending: '0.000000' },
          vnd: { available: '0', pending: '0' },
        },
        createdAt: user.createdAt.toISOString(),
        email: user.email,
        id: user.id,
        phone: user.phone,
        roles: [],
        telegram: null,
        totals: {
          totalDepositUsdt: '0.000000',
          totalDepositVnd: '0',
          totalWithdrawUsdt: '0.000000',
          totalWithdrawVnd: '0',
        },
        twoFactorEnabled: false,
      }))

    return service;
  }

  it.each([
    ['email', 'alice', 'alice@example.com'],
    ['phone', '3456', 'alice@example.com'],
    ['user id', 'user-bob', 'bob@example.com'],
  ])('filters admin users by partial %s', async (_label, search, expectedEmail) => {
    const service = createListForAdminService();

    const result = await service.listForAdmin({ search });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        email: expectedEmail,
      }),
    );
  });

  it('keeps existing behavior when search is blank', async () => {
    const service = createListForAdminService();

    const result = await service.listForAdmin({ search: '   ' });

    expect(result).toHaveLength(2);
  });
});
