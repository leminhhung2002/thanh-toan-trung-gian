import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { and, eq } from 'drizzle-orm';
import OTPAuth from 'otpauth';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/platform/database/database.service';
import { notificationOutbox } from '../src/platform/database/schema';
import { configureApp } from '../src/platform/http/configure-app';
import { responseData, responseError } from './test-helpers';
import { ensureTestDatabase } from './test-database';

type AuthPayload = {
  accessToken: string;
};

type DepositReservationPayload = {
  reservationId: string;
};

type DepositPayload = {
  id: string;
};

type WithdrawalPayload = {
  id: string;
};

function generateTotpCode(manualEntryKey: string) {
  const totp = new OTPAuth.TOTP({
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(manualEntryKey),
  });

  return totp.generate();
}

describe('Notification outbox (e2e)', () => {
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
        email: `notify-${Date.now()}-${Math.random()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    return responseData<AuthPayload>(response).accessToken;
  }

  async function createBankAccount(adminAccessToken: string) {
    await request(app.getHttpServer())
      .post('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        accountName: 'NGAN LUONG',
        accountNumber: `1000${Date.now()}`,
        bankCode: '970436',
        bankName: 'Vietcombank',
        dailyLimit: '500000000',
        isActive: true,
        priority: 1,
      })
      .expect(201);
  }

  async function createApprovedFundingDeposit(userAccessToken: string) {
    const adminAccessToken = await loginAsAdmin();
    await createBankAccount(adminAccessToken);

    const reservationResponse = await request(app.getHttpServer())
      .post('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        amount: '100000',
        assetCode: 'VND',
        method: 'bank_transfer',
      })
      .expect(201);

    const reservation =
      responseData<DepositReservationPayload>(reservationResponse);

    const depositResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/deposit-reservations/${String(reservation.reservationId)}/confirm`,
      )
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(201);

    const deposit = responseData<DepositPayload>(depositResponse);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({})
      .expect(200);
  }

  async function enableTwoFactor(userAccessToken: string) {
    const setupResponse = await request(app.getHttpServer())
      .post('/api/v1/profile/two-factor/setup')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({})
      .expect(201);

    const setup = responseData<{ manualEntryKey: string }>(setupResponse);

    await request(app.getHttpServer())
      .post('/api/v1/profile/two-factor/enable')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        code: generateTotpCode(setup.manualEntryKey),
      })
      .expect(200);

    return setup.manualEntryKey;
  }

  it('rejects direct USDT deposit requests and does not create an outbox row', async () => {
    const userAccessToken = await registerUser();

    await request(app.getHttpServer())
      .post('/api/v1/deposits')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `dep-${Date.now()}`)
      .send({
        amount: '25',
        assetCode: 'USDT',
        method: 'crypto_transfer',
        destinationRef: 'TRC20',
        externalReference: 'hash-123',
        proofUrl: 'https://example.com/proof.png',
        note: 'tx sent',
      })
      .expect(400)
      .expect((response) => {
        expect(responseError(response).code).toBe('deposit_usdt_disabled');
      });

    const rows = await databaseService.db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.eventType, 'deposit.pending.created'));

    expect(rows).toHaveLength(0);
  });

  it('writes a deposit pending outbox row when a VND reservation is confirmed', async () => {
    const adminAccessToken = await loginAsAdmin();
    await createBankAccount(adminAccessToken);
    const userAccessToken = await registerUser();

    const reservationResponse = await request(app.getHttpServer())
      .post('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        amount: '200000',
        assetCode: 'VND',
        method: 'bank_transfer',
      })
      .expect(201);

    const reservation =
      responseData<DepositReservationPayload>(reservationResponse);

    const confirmResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/deposit-reservations/${String(reservation.reservationId)}/confirm`,
      )
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(201);

    const deposit = responseData<DepositPayload>(confirmResponse);
    const [row] = await databaseService.db
      .select()
      .from(notificationOutbox)
      .where(
        and(
          eq(notificationOutbox.entityId, deposit.id),
          eq(notificationOutbox.eventType, 'deposit.pending.created'),
        ),
      );

    expect(row).toBeDefined();
    expect(row?.status).toBe('pending');
  });

  it('writes a withdrawal pending outbox row when a withdrawal request is created', async () => {
    const userAccessToken = await registerUser();
    await createApprovedFundingDeposit(userAccessToken);
    const twoFactorKey = await enableTwoFactor(userAccessToken);

    const withdrawalResponse = await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `wd-${Date.now()}`)
      .send({
        amount: '50000',
        assetCode: 'VND',
        destinationDetails: {
          accountName: 'NGUYEN VAN A',
          accountNumber: '0123456789',
          bankName: 'ACB',
        },
        method: 'bank_transfer',
        note: 'need cash',
        twoFactorCode: generateTotpCode(twoFactorKey),
      })
      .expect(201);

    const withdrawal = responseData<WithdrawalPayload>(withdrawalResponse);
    const [row] = await databaseService.db
      .select()
      .from(notificationOutbox)
      .where(
        and(
          eq(notificationOutbox.entityId, withdrawal.id),
          eq(notificationOutbox.eventType, 'withdrawal.pending.created'),
        ),
      );

    expect(row).toBeDefined();
    expect(row?.status).toBe('pending');
  });
});
