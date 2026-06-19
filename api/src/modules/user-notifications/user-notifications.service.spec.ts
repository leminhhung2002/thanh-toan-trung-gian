import { UserNotificationsService } from './user-notifications.service';

describe('UserNotificationsService', () => {
  it('lists notifications newest-first and reports unread count relative to the last read cursor', async () => {
    const repository = {
      countUnreadForUser: jest.fn().mockResolvedValue(2),
      listForUser: jest.fn().mockResolvedValue([
        {
          createdAt: new Date('2026-04-12T10:05:00.000Z'),
          id: 'notification-2',
          primaryAmount: '250000',
          primaryAmountTone: 'plus',
          primaryAssetCode: 'VND',
          referenceId: 'deposit-2',
          referenceType: 'deposit_request',
          secondaryText: 'Đa cong vao vi VND',
          title: 'Nap tien',
          type: 'deposit.approved',
          userId: 'user-1',
        },
        {
          createdAt: new Date('2026-04-12T10:00:00.000Z'),
          id: 'notification-1',
          primaryAmount: '250000',
          primaryAmountTone: 'neutral',
          primaryAssetCode: 'VND',
          referenceId: 'deposit-1',
          referenceType: 'deposit_request',
          secondaryText: 'Yeu cau nap tien da bi tu choi',
          title: 'Nap tien',
          type: 'deposit.rejected',
          userId: 'user-1',
        },
      ]),
      markAllRead: jest.fn(),
      save: jest.fn(),
    };

    const service = new UserNotificationsService(repository as never);

    await expect(service.listForUser('user-1', 50)).resolves.toEqual({
      items: [
        {
          createdAt: '2026-04-12T10:05:00.000Z',
          id: 'notification-2',
          primaryAmount: '250000',
          primaryAmountTone: 'plus',
          primaryAssetCode: 'VND',
          referenceId: 'deposit-2',
          referenceType: 'deposit_request',
          secondaryText: 'Đa cong vao vi VND',
          title: 'Nap tien',
          type: 'deposit.approved',
        },
        {
          createdAt: '2026-04-12T10:00:00.000Z',
          id: 'notification-1',
          primaryAmount: '250000',
          primaryAmountTone: 'neutral',
          primaryAssetCode: 'VND',
          referenceId: 'deposit-1',
          referenceType: 'deposit_request',
          secondaryText: 'Yeu cau nap tien da bi tu choi',
          title: 'Nap tien',
          type: 'deposit.rejected',
        },
      ],
      unreadCount: 2,
    });
    expect(repository.listForUser).toHaveBeenCalledWith('user-1', 50);
    expect(repository.countUnreadForUser).toHaveBeenCalledWith('user-1');
  });

  it('marks all notifications as read at the latest notification timestamp and resets unread count', async () => {
    const latestCreatedAt = new Date('2026-04-12T10:05:00.000Z');
    const repository = {
      countUnreadForUser: jest.fn(),
      findLatestCreatedAtForUser: jest.fn().mockResolvedValue(latestCreatedAt),
      listForUser: jest.fn(),
      markAllRead: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(),
    };

    const service = new UserNotificationsService(repository as never);

    await expect(service.markAllRead('user-1')).resolves.toEqual({
      count: 0,
      readAt: '2026-04-12T10:05:00.000Z',
    });
    expect(repository.findLatestCreatedAtForUser).toHaveBeenCalledWith('user-1');
    expect(repository.markAllRead).toHaveBeenCalledWith('user-1', latestCreatedAt);
  });

  it('creates notifications that become unread again after a prior read-all', async () => {
    const repository = {
      countUnreadForUser: jest.fn().mockResolvedValue(1),
      listForUser: jest.fn().mockResolvedValue([]),
      markAllRead: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const service = new UserNotificationsService(repository as never);

    await service.createForUser({
      primaryAmount: '52500',
      primaryAmountTone: 'plus',
      primaryAssetCode: 'VND',
      referenceId: 'withdrawal-2',
      referenceType: 'withdrawal_request',
      secondaryText: 'Da hoan 52.500 VND ve vi',
      title: 'Rut tien',
      type: 'withdrawal.rejected',
      userId: 'user-1',
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryAmount: '52500',
        primaryAmountTone: 'plus',
        primaryAssetCode: 'VND',
        referenceId: 'withdrawal-2',
        referenceType: 'withdrawal_request',
        secondaryText: 'Da hoan 52.500 VND ve vi',
        title: 'Rut tien',
        type: 'withdrawal.rejected',
        userId: 'user-1',
      }),
    );
    await expect(service.getUnreadCount('user-1')).resolves.toEqual({ count: 1 });
  });

  it('stores final-result notification copy for rejected deposits and approved withdrawals', async () => {
    const repository = {
      countUnreadForUser: jest.fn(),
      listForUser: jest.fn(),
      markAllRead: jest.fn(),
      save: jest.fn(),
      saveWithTransaction: jest.fn().mockResolvedValue(undefined),
    };

    const service = new UserNotificationsService(repository as never);

    await service.createDepositRejected({} as never, {
      amount: '250000',
      assetCode: 'VND',
      depositRequestId: 'deposit-1',
      userId: 'user-1',
    });
    await service.createWithdrawalApproved({} as never, {
      assetCode: 'VND',
      totalDebit: '52500',
      userId: 'user-1',
      withdrawalRequestId: 'withdrawal-1',
    });

    expect(repository.saveWithTransaction).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        primaryAmount: '250000',
        primaryAmountTone: 'neutral',
        secondaryText: 'Yêu cầu nạp tiền đã bị từ chối',
        type: 'deposit.rejected',
      }),
    );
    expect(repository.saveWithTransaction).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        primaryAmount: '52500',
        primaryAmountTone: 'minus',
        secondaryText: 'Yêu cầu rút tiền đã được duyệt',
        type: 'withdrawal.approved',
      }),
    );
  });

  it('stores a dedicated notification when an exchange is reversed by admin', async () => {
    const repository = {
      countUnreadForUser: jest.fn(),
      listForUser: jest.fn(),
      markAllRead: jest.fn(),
      save: jest.fn(),
      saveWithTransaction: jest.fn().mockResolvedValue(undefined),
    };

    const service = new UserNotificationsService(repository as never);

    await service.createExchangeReversed({} as never, {
      fromAssetCode: 'VND',
      referenceId: 'exchange-1',
      toAmount: '0.000380',
      toAssetCode: 'USDT',
      totalDebit: '100000',
      userId: 'user-1',
    });

    expect(repository.saveWithTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        primaryAmount: '0.000380',
        primaryAmountTone: 'neutral',
        primaryAssetCode: 'USDT',
        referenceId: 'exchange-1',
        referenceType: 'exchange_order',
        secondaryText: 'Đã hoàn lại 100000 VND và thu hồi số tiền nhận trước đó',
        title: 'Đổi tiền',
        type: 'exchange.reversed',
        userId: 'user-1',
      }),
    );
  });
});
