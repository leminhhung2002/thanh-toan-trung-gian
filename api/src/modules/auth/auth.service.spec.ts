import { roles, userRoles, users } from '../../platform/database/schema';
import { AuthService } from './auth.service';

describe('AuthService.register', () => {
  it('normalizes telegram usernames before storing a newly registered user', async () => {
    const insertUsersValues = jest.fn().mockResolvedValue(undefined);
    const insertUserRolesValues = jest.fn().mockResolvedValue(undefined);
    const tx = {
      insert: jest.fn((table) => {
        if (table === users) {
          return {
            values: insertUsersValues,
          };
        }

        if (table === userRoles) {
          return {
            values: insertUserRolesValues,
          };
        }

        throw new Error('Unexpected table insert');
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 'role-user-id', code: 'user' }]),
        }),
      }),
    };

    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      }),
      transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
    };

    const service = new AuthService(
      {
        listActiveAssets: jest.fn().mockResolvedValue([]),
      } as never,
      {} as never,
      { db } as never,
      {} as never,
      {} as never,
      {
        ensureWalletsForUser: jest.fn().mockResolvedValue(undefined),
        listWalletsForUser: jest.fn().mockResolvedValue([]),
      } as never,
    );

    jest
      .spyOn(service as never, 'createAuthResult' as never)
      .mockResolvedValue({ accessToken: 'a', refreshToken: 'b', user: { email: 'user@example.com', id: 'user-1', roles: ['user'] }, wallets: [] } as never);

    await service.register(
      {
        email: 'user@example.com',
        password: 'Secret123!',
        phone: '0901234567',
        telegram: 'https://t.me/walletuser',
      },
      {} as never,
    );

    expect(insertUsersValues).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        phone: '0901234567',
        telegram: 'walletuser',
      }),
    );
  });
});
