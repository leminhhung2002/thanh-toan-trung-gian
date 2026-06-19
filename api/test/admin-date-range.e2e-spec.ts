import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/platform/database/database.service';
import {
  assets,
  depositRequests,
  exchangeOrders,
  withdrawalRequests,
} from '../src/platform/database/schema';
import { configureApp } from '../src/platform/http/configure-app';
import { ensureTestDatabase } from './test-database';
import { AuthPayload, responseData, responseError } from './test-helpers';

describe('Admin date range filters (e2e)', () => {
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

  async function loginAsAdmin() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    return responseData<AuthPayload>(response).accessToken;
  }

  async function registerUser() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `range-${Date.now()}-${Math.random()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    return responseData<AuthPayload>(response).user.id;
  }

  it('filters deposits, withdrawals, and exchange orders by a vietnam date range and keeps status filtering', async () => {
    const adminAccessToken = await loginAsAdmin();
    const userId = await registerUser();
    const assetRows = await databaseService.db.select().from(assets);
    const vndAsset = assetRows.find((item) => item.code === 'VND');
    const usdtAsset = assetRows.find((item) => item.code === 'USDT');

    expect(vndAsset).toBeTruthy();
    expect(usdtAsset).toBeTruthy();

    await databaseService.db.insert(depositRequests).values([
      {
        amountMinor: 100000n,
        assetId: String(vndAsset?.id),
        createdAt: new Date('2026-04-05T16:59:59.000Z'),
        id: 'deposit-before-range',
        method: 'bank_transfer',
        status: 'pending',
        userId,
      },
      {
        amountMinor: 200000n,
        assetId: String(vndAsset?.id),
        createdAt: new Date('2026-04-05T17:00:00.000Z'),
        id: 'deposit-range-start',
        method: 'bank_transfer',
        status: 'pending',
        userId,
      },
      {
        amountMinor: 300000n,
        assetId: String(vndAsset?.id),
        createdAt: new Date('2026-04-06T16:59:59.000Z'),
        id: 'deposit-range-end',
        method: 'bank_transfer',
        status: 'approved',
        userId,
      },
      {
        amountMinor: 400000n,
        assetId: String(vndAsset?.id),
        createdAt: new Date('2026-04-06T17:00:00.000Z'),
        id: 'deposit-after-range',
        method: 'bank_transfer',
        status: 'pending',
        userId,
      },
    ]);

    await databaseService.db.insert(withdrawalRequests).values([
      {
        amountMinor: 90000n,
        assetId: String(vndAsset?.id),
        createdAt: new Date('2026-04-05T17:00:00.000Z'),
        destinationDetails: { accountNumber: '123', bankName: 'VCB' },
        feeAmountMinor: 10000n,
        id: 'withdrawal-range-start',
        method: 'bank_transfer',
        status: 'approved',
        totalDebitMinor: 100000n,
        userId,
      },
      {
        amountMinor: 50000n,
        assetId: String(vndAsset?.id),
        createdAt: new Date('2026-04-06T17:00:00.000Z'),
        destinationDetails: { accountNumber: '456', bankName: 'VCB' },
        feeAmountMinor: 5000n,
        id: 'withdrawal-after-range',
        method: 'bank_transfer',
        status: 'pending',
        totalDebitMinor: 55000n,
        userId,
      },
    ]);

    await databaseService.db.insert(exchangeOrders).values([
      {
        appliedMarkupVnd: 0,
        createdAt: new Date('2026-04-06T10:00:00.000Z'),
        feeAmountMinor: 10000n,
        feeBps: 100,
        feeProfitVndMinor: 10000n,
        fromAmountMinor: 100000n,
        fromAssetId: String(vndAsset?.id),
        id: 'exchange-in-range',
        markupProfitVndMinor: 5000n,
        quoteId: randomUUID(),
        rate: '25000',
        realtimeRateVnd: '24500',
        toAmountMinor: 3600000n,
        toAssetId: String(usdtAsset?.id),
        totalDebitMinor: 100000n,
        userId,
      },
      {
        appliedMarkupVnd: 0,
        createdAt: new Date('2026-04-06T17:00:00.000Z'),
        feeAmountMinor: 10000n,
        feeBps: 100,
        feeProfitVndMinor: 10000n,
        fromAmountMinor: 100000n,
        fromAssetId: String(vndAsset?.id),
        id: 'exchange-after-range',
        markupProfitVndMinor: 5000n,
        quoteId: randomUUID(),
        rate: '25000',
        realtimeRateVnd: '24500',
        toAmountMinor: 3600000n,
        toAssetId: String(usdtAsset?.id),
        totalDebitMinor: 100000n,
        userId,
      },
    ]);

    const depositsResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/deposits?status=all&startDate=2026-04-06&endDate=2026-04-06')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(
      responseData<Array<{ id: string }>>(depositsResponse).map((item) => item.id),
    ).toEqual(['deposit-range-end', 'deposit-range-start']);

    const pendingDepositsResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/deposits?status=pending&startDate=2026-04-06&endDate=2026-04-06')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(
      responseData<Array<{ id: string }>>(pendingDepositsResponse).map((item) => item.id),
    ).toEqual(['deposit-range-start']);

    const withdrawalsResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/withdrawals?status=all&startDate=2026-04-06&endDate=2026-04-06')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(
      responseData<Array<{ id: string }>>(withdrawalsResponse).map((item) => item.id),
    ).toEqual(['withdrawal-range-start']);

    const exchangeResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/exchange/orders?startDate=2026-04-06&endDate=2026-04-06')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(
      responseData<Array<{ id: string }>>(exchangeResponse).map((item) => item.id),
    ).toEqual(['exchange-in-range']);
  });

  it('rejects reversed admin date ranges', async () => {
    const adminAccessToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .get('/api/v1/admin/deposits?status=all&startDate=2026-04-07&endDate=2026-04-06')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(400)
      .expect((response) => {
        expect(responseError(response).code).toBe('invalid_review_date_range');
      });
  });
});
