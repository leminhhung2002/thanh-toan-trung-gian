import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/platform/database/database.service';
import { userNotifications } from '../src/platform/database/schema';
import { configureApp } from '../src/platform/http/configure-app';
import { ensureTestDatabase } from './test-database';
import { AuthPayload, responseData } from './test-helpers';

type NotificationListPayload = {
  items: Array<{
    createdAt: string;
    id: string;
    primaryAmount: string;
    primaryAmountTone: 'minus' | 'neutral' | 'plus';
    primaryAssetCode: string;
    referenceId: string;
    referenceType: string;
    secondaryText: string;
    title: string;
    type: string;
  }>;
  unreadCount: number;
};

describe('User notifications (e2e)', () => {
  let app: INestApplication<App>;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    await ensureTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    databaseService = app.get(DatabaseService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('lists unread notifications, resets them on read-all, and counts new notifications afterward', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'notify@example.com',
        password: 'StrongPass123!',
        phone: '0901234567',
      })
      .expect(201);

    const userAccessToken = responseData<AuthPayload>(registerResponse).accessToken;

    const userId = responseData<AuthPayload>(registerResponse).user.id;

    await databaseService.db.insert(userNotifications).values({
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
      id: 'notification-1',
      primaryAmount: '52500',
      primaryAmountTone: 'minus',
      primaryAssetCode: 'VND',
      referenceId: 'withdrawal-1',
      referenceType: 'withdrawal_request',
      secondaryText: 'Yêu cầu rút tiền đã được duyệt',
      title: 'Rút tiền',
      type: 'withdrawal.approved',
      userId,
    });

    const unreadBeforeRead = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200);

    expect(responseData<{ count: number }>(unreadBeforeRead)).toEqual({ count: 1 });

    const notificationList = await request(app.getHttpServer())
      .get('/api/v1/notifications?limit=50')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200);

    expect(responseData<NotificationListPayload>(notificationList)).toMatchObject({
      items: [
        expect.objectContaining({
          primaryAmount: '52500',
          primaryAmountTone: 'minus',
          primaryAssetCode: 'VND',
          secondaryText: 'Yêu cầu rút tiền đã được duyệt',
          title: 'Rút tiền',
          type: 'withdrawal.approved',
        }),
      ],
      unreadCount: 1,
    });

    const markReadResponse = await request(app.getHttpServer())
      .post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(201);

    expect(responseData<{ count: number; readAt: string | null }>(markReadResponse)).toEqual({
      count: 0,
      readAt: expect.any(String),
    });

    const unreadAfterRead = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200);

    expect(responseData<{ count: number }>(unreadAfterRead)).toEqual({ count: 0 });

    await databaseService.db.insert(userNotifications).values({
      createdAt: new Date('2026-04-12T10:10:00.000Z'),
      id: 'notification-2',
      primaryAmount: '4.000000',
      primaryAmountTone: 'plus',
      primaryAssetCode: 'USDT',
      referenceId: 'exchange-1',
      referenceType: 'exchange_order',
      secondaryText: 'Đã trừ 101000 VND',
      title: 'Đổi tiền',
      type: 'exchange.completed',
      userId,
    });

    const unreadAfterNewNotification = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200);

    expect(responseData<{ count: number }>(unreadAfterNewNotification)).toEqual({ count: 1 });
  });
});
