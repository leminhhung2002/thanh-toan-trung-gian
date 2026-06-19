import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import OTPAuth from 'otpauth';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { BankAccountsService } from '../src/modules/bank-accounts/bank-accounts.service';
import { DatabaseService } from '../src/platform/database/database.service';
import { configureApp } from '../src/platform/http/configure-app';
import {
  bankAccounts,
  depositReservations,
  settings,
} from '../src/platform/database/schema';
import {
  AuthPayload,
  EntityWithId,
  findWallet,
  LedgerPayload,
  ProfilePayload,
  WalletSummary,
  responseData,
  responseError,
} from './test-helpers';
import { ensureTestDatabase } from './test-database';

type DepositReservationPayload = {
  amount: string;
  assetCode: string;
  confirmedAt?: string | null;
  depositRequestId?: string | null;
  depositStatus?: string | null;
  expiresAt: string;
  reservationId: string;
  selectedBankAccount?: {
    accountName: string;
    accountNumber: string;
  } | null;
  status: string;
  transferContent: string;
};

type ExchangeQuotePayload = {
  expiresAt: string;
  feeAmount: string;
  feeAssetCode: string;
  feeBps: number;
  fromAssetCode: string;
  grossReceiveAmount: string;
  id: string;
  rate: string;
  requestedAmount: string;
  roundingMode: string;
  toAmount: string;
  toAssetCode: string;
  totalDebit: string;
};

type ExchangeOrderPayload = {
  createdAt: string;
  feeAmount: string;
  feeAssetCode: string;
  fromAssetCode: string;
  grossReceiveAmount: string;
  id: string;
  rate: string;
  requestedAmount: string;
  roundingMode: string;
  status: string;
  toAmount: string;
  toAssetCode: string;
  totalDebit: string;
};

type AdminExchangeOrderPayload = {
  appliedMarkupVnd: number;
  createdAt: string;
  feeAmount: string;
  feeAssetCode: string;
  feeBps: number;
  feeProfitVnd: string;
  fromAssetCode: string;
  grossReceiveAmount: string;
  id: string;
  markupProfitVnd: string;
  rate: string;
  realtimeRateVnd: string;
  requestedAmount: string;
  status: 'completed';
  toAmount: string;
  toAssetCode: string;
  totalDebit: string;
  userEmail: string;
  userId: string;
};

type AdminBankAccountPayload = {
  accountName: string;
  canDelete: boolean;
  liveReservationCount: number;
  pendingDepositCount: number;
  remainingToday: string;
  reservedPendingReview: string;
  reservedUnconfirmed: string;
  usedToday: string;
};

type DepositQueuePayload = {
  amount: string;
  assetCode: string;
  id: string;
  selectedBankAccount?: {
    accountName: string;
    accountNumber: string;
  } | null;
  status: string;
};

type CurrentDepositReservationPayload = DepositReservationPayload & {
  depositRequestId?: string | null;
  depositStatus?: string | null;
};

type UserDepositPayload = {
  amount: string;
  approvedAt?: string | null;
  assetCode: string;
  createdAt: string;
  destinationRef?: string | null;
  externalReference?: string | null;
  id: string;
  method: string;
  note?: string | null;
  rejectedAt?: string | null;
  reviewNote?: string | null;
  selectedBankAccount?: {
    accountName: string;
    accountNumber: string;
    bankCode: string;
    bankName: string;
    id: string;
    priority: number;
  } | null;
  status: string;
};

type UserWithdrawalPayload = {
  amount: string;
  approvedAt?: string | null;
  assetCode: string;
  createdAt: string;
  destinationDetails?: Record<string, unknown> | null;
  feeAmount?: string | null;
  feeProfitVnd?: string | null;
  id: string;
  method: string;
  note?: string | null;
  profitFxRateVnd?: string | null;
  rejectedAt?: string | null;
  reviewNote?: string | null;
  status: string;
  totalDebit?: string | null;
};

type TwoFactorStatusPayload = {
  enabled: boolean;
  hasPendingSetup: boolean;
  recoveryMode: string;
};

type TwoFactorSetupPayload = {
  manualEntryKey: string;
  otpauthUri: string;
};

function generateTotpCode(manualEntryKey: string) {
  const totp = new OTPAuth.TOTP({
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(manualEntryKey),
  });

  return totp.generate();
}

function createCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}

const crc32Table = createCrc32Table();

function crc32(buffer: Buffer) {
  let value = 0xffffffff;

  for (const byte of buffer) {
    value = crc32Table[(value ^ byte) & 0xff] ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
}

function createPngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function createPngBuffer(width: number, height: number) {
  const zlib = require('node:zlib') as typeof import('node:zlib');
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const row = Buffer.alloc(1 + width * 4, 0);
  for (let pixel = 0; pixel < width; pixel += 1) {
    const offset = 1 + pixel * 4;
    row[offset] = 0xf2;
    row[offset + 1] = 0x66;
    row[offset + 2] = 0x22;
    row[offset + 3] = 0xff;
  }

  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', idat),
    createPngChunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('Wallet operations (e2e)', () => {
  let app: INestApplication<App>;
  let pricingFetchSpy: jest.SpiedFunction<typeof fetch>;
  let bannerUploadDir: string;

  beforeEach(async () => {
    await ensureTestDatabase();
    bannerUploadDir = join(
      tmpdir(),
      `nganluong-homepage-banners-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    process.env.BANNER_UPLOAD_DIR = bannerUploadDir;

    pricingFetchSpy = jest.spyOn(global, 'fetch').mockImplementation(
      async (input) => {
        const url = String(input);

        if (url.includes('coinbase.com')) {
          return new Response(
            JSON.stringify({
              data: {
                rates: {
                  VND: '25000',
                },
              },
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          );
        }

        return new Response(
          JSON.stringify({
            tether: {
              vnd: 25000,
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    pricingFetchSpy?.mockRestore();
    if (app) {
      await app.close();
    }
    await rm(bannerUploadDir, { force: true, recursive: true });
  });

  async function createBankAccount(
    adminAccessToken: string,
    overrides: Partial<{
      accountName: string;
      accountNumber: string;
      bankCode: string;
      bankName: string;
      dailyLimit: string;
      isActive: boolean;
      priority: number;
    }> = {},
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        accountName: 'DEFAULT BANK',
        accountNumber: `1000${Date.now()}`,
        bankCode: '970436',
        bankName: 'Vietcombank',
        dailyLimit: '1000000',
        isActive: true,
        priority: 1,
        ...overrides,
      })
      .expect(201);
  }

  async function createConfirmedVndDeposit(
    userAccessToken: string,
    amount: string,
  ) {
    const reservationResponse = await request(app.getHttpServer())
      .post('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        amount,
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

    return {
      deposit: responseData<DepositQueuePayload>(depositResponse),
      reservation,
    };
  }

  async function enableTwoFactor(userAccessToken: string) {
    const setupResponse = await request(app.getHttpServer())
      .post('/api/v1/profile/two-factor/setup')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({})
      .expect(201);

    const setup = responseData<TwoFactorSetupPayload>(setupResponse);

    await request(app.getHttpServer())
      .post('/api/v1/profile/two-factor/enable')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        code: generateTotpCode(setup.manualEntryKey),
      })
      .expect(200);

    return setup.manualEntryKey;
  }

  it('supports the user two-factor setup lifecycle with TOTP enable and disable', async () => {
    const email = `two-factor-lifecycle-${Date.now()}@example.com`;
    const password = 'Secret123!';

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    await request(app.getHttpServer())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<ProfilePayload>(response)).toEqual(
          expect.objectContaining({
            email,
            twoFactorEnabled: false,
          }),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/profile/two-factor')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<TwoFactorStatusPayload>(response)).toEqual({
          enabled: false,
          hasPendingSetup: false,
          recoveryMode: 'admin_reset',
        });
      });

    const setupResponse = await request(app.getHttpServer())
      .post('/api/v1/profile/two-factor/setup')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({})
      .expect(201);

    const setup = responseData<TwoFactorSetupPayload>(setupResponse);

    expect(setup.manualEntryKey).toEqual(expect.any(String));
    expect(setup.otpauthUri.startsWith('otpauth://totp/')).toBe(true);

    await request(app.getHttpServer())
      .get('/api/v1/profile/two-factor')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<TwoFactorStatusPayload>(response)).toEqual({
          enabled: false,
          hasPendingSetup: true,
          recoveryMode: 'admin_reset',
        });
      });

    await request(app.getHttpServer())
      .post('/api/v1/profile/two-factor/enable')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        code: generateTotpCode(setup.manualEntryKey),
      })
      .expect(200)
      .expect((response) => {
        expect(responseData<{ enabled: boolean }>(response)).toEqual({
          enabled: true,
        });
      });

    await request(app.getHttpServer())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<ProfilePayload>(response)).toEqual(
          expect.objectContaining({
            email,
            twoFactorEnabled: true,
          }),
        );
      });

    await request(app.getHttpServer())
      .post('/api/v1/profile/two-factor/disable')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        code: generateTotpCode(setup.manualEntryKey),
      })
      .expect(200)
      .expect((response) => {
        expect(responseData<{ enabled: boolean }>(response)).toEqual({
          enabled: false,
        });
      });

    await request(app.getHttpServer())
      .get('/api/v1/profile/two-factor')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<TwoFactorStatusPayload>(response)).toEqual({
          enabled: false,
          hasPendingSetup: false,
          recoveryMode: 'admin_reset',
        });
      });
  });

  it('enforces two-factor for change-password and withdrawals, and supports admin reset recovery', async () => {
    const email = `two-factor-enforcement-${Date.now()}@example.com`;
    const password = 'Secret123!';

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
      })
      .expect(201);

    const auth = responseData<AuthPayload>(registerResponse);
    const userAccessToken = auth.accessToken;

    const { deposit } = await createConfirmedVndDeposit(userAccessToken, '100000');

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Fund for two-factor test',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `withdraw-two-factor-required-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '10000',
        method: 'bank_transfer',
        destinationDetails: {
          accountName: 'Wallet User',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
        },
      })
      .expect(403)
      .expect((response) => {
        expect(responseError(response).code).toBe('two_factor_required');
      });

    const setupResponse = await request(app.getHttpServer())
      .post('/api/v1/profile/two-factor/setup')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({})
      .expect(201);

    const setup = responseData<TwoFactorSetupPayload>(setupResponse);
    const validCode = generateTotpCode(setup.manualEntryKey);

    await request(app.getHttpServer())
      .post('/api/v1/profile/two-factor/enable')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        code: validCode,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/profile/change-password')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        currentPassword: password,
        newPassword: 'Changed123!',
      })
      .expect(401)
      .expect((response) => {
        expect(responseError(response).code).toBe('two_factor_code_required');
      });

    await request(app.getHttpServer())
      .post('/api/v1/profile/change-password')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        currentPassword: password,
        newPassword: 'Changed123!',
        twoFactorCode: generateTotpCode(setup.manualEntryKey),
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `withdraw-two-factor-missing-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '10000',
        method: 'bank_transfer',
        destinationDetails: {
          accountName: 'Wallet User',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
        },
      })
      .expect(401)
      .expect((response) => {
        expect(responseError(response).code).toBe('two_factor_code_required');
      });

    await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `withdraw-two-factor-invalid-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '10000',
        method: 'bank_transfer',
        twoFactorCode: '000000',
        destinationDetails: {
          accountName: 'Wallet User',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
        },
      })
      .expect(401)
      .expect((response) => {
        expect(responseError(response).code).toBe('two_factor_invalid');
      });

    await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `withdraw-two-factor-valid-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '10000',
        method: 'bank_transfer',
        twoFactorCode: generateTotpCode(setup.manualEntryKey),
        destinationDetails: {
          accountName: 'Wallet User',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
        },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${auth.user.id}/two-factor/reset`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({})
      .expect(200)
      .expect((response) => {
        expect(responseData<{ success: boolean }>(response)).toEqual({
          success: true,
        });
      });

    await request(app.getHttpServer())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<ProfilePayload>(response)).toEqual(
          expect.objectContaining({
            email,
            twoFactorEnabled: false,
          }),
        );
      });

    await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `withdraw-two-factor-after-reset-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '10000',
        method: 'bank_transfer',
        twoFactorCode: generateTotpCode(setup.manualEntryKey),
        destinationDetails: {
          accountName: 'Wallet User',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
        },
      })
      .expect(403)
      .expect((response) => {
        expect(responseError(response).code).toBe('two_factor_required');
      });
  });

  it('creates a deposit, admin approves it, then withdrawal reject and exchange execute update balances and ledger', async () => {
    const userEmail = `wallet-${Date.now()}@example.com`;
    const userPassword = 'Secret123!';

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: userEmail,
        password: userPassword,
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit } = await createConfirmedVndDeposit(
      userAccessToken,
      '100000',
    );

    const depositId = deposit.id;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${depositId}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Approved by test',
      })
      .expect(200);

    const twoFactorKey = await enableTwoFactor(userAccessToken);

    await request(app.getHttpServer())
      .get('/api/v1/wallets')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        const vndWallet = findWallet(
          responseData<WalletSummary[]>(response),
          'VND',
        );

        expect(vndWallet.balances).toEqual({
          available: '100000',
          pending: '0',
          total: '100000',
        });
      });

    const withdrawalResponse = await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `withdraw-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '40000',
        method: 'bank_transfer',
        twoFactorCode: generateTotpCode(twoFactorKey),
        destinationDetails: {
          bankName: 'VCB',
          accountNumber: '123456789',
        },
      })
      .expect(201);

    const withdrawalId = responseData<EntityWithId>(withdrawalResponse).id;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/reject`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Rejected by test',
      })
      .expect(200);

    const quoteResponse = await request(app.getHttpServer())
      .post('/api/v1/exchange/quote')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        fromAssetCode: 'VND',
        toAssetCode: 'USDT',
        amount: '50000',
      })
      .expect(201);

    const quoteId = responseData<EntityWithId>(quoteResponse).id;

    await request(app.getHttpServer())
      .post('/api/v1/exchange/execute')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `exchange-${Date.now()}`)
      .send({
        quoteId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/exchange/orders')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<ExchangeOrderPayload[]>(response)).toEqual([
          expect.objectContaining({
            feeAmount: '0.02',
            feeAssetCode: 'USDT',
            feeBps: 100,
            fromAssetCode: 'VND',
            grossReceiveAmount: '1.92',
            requestedAmount: '50000',
            roundingMode: 'floor_asset_precision',
            status: 'completed',
            toAmount: '1.90',
            toAssetCode: 'USDT',
            totalDebit: '50000',
          }),
        ]);
      });

    await request(app.getHttpServer())
      .get('/api/v1/wallets/VND/ledger')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          responseData<LedgerPayload>(response).entries.length,
        ).toBeGreaterThan(0);
      });
  });

  it('lists admin deposit and withdrawal review queues with filterable statuses', async () => {
    const email = `admin-list-${Date.now()}@example.com`;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit: fundingDeposit } = await createConfirmedVndDeposit(
      userAccessToken,
      '250000',
    );

    const fundingDepositId = fundingDeposit.id;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${fundingDepositId}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Seeded for review queue test',
      })
      .expect(200);

    const twoFactorKey = await enableTwoFactor(userAccessToken);

    const { deposit: pendingDeposit, reservation: pendingReservation } =
      await createConfirmedVndDeposit(userAccessToken, '125000');

    const depositId = pendingDeposit.id;

    const withdrawalResponse = await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `withdraw-admin-list-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '100000',
        method: 'bank_transfer',
        twoFactorCode: generateTotpCode(twoFactorKey),
        destinationDetails: {
          accountName: 'Wallet User',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
        },
        note: 'Send to trading wallet',
      })
      .expect(201);

    const withdrawalId = responseData<EntityWithId>(withdrawalResponse).id;

    await request(app.getHttpServer())
      .get('/api/v1/admin/deposits')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<Array<Record<string, unknown>>>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              amount: '125000',
              assetCode: 'VND',
              createdAt: expect.any(String) as string,
              destinationRef: pendingReservation.transferContent,
              externalReference: null,
              id: depositId,
              method: 'bank_transfer',
              note: null,
              proofUrl: null,
              reviewNote: null,
              status: 'pending',
              userEmail: email,
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/admin/withdrawals')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<Array<Record<string, unknown>>>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              amount: '90000',
              assetCode: 'VND',
              createdAt: expect.any(String) as string,
              destinationDetails: {
                accountName: 'Wallet User',
                accountNumber: '123456789',
                bankName: 'Vietcombank',
              },
              id: withdrawalId,
              method: 'bank_transfer',
              note: 'Send to trading wallet',
              reviewNote: null,
              status: 'pending',
              totalDebit: '100000',
              userEmail: email,
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${depositId}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Matched incoming transfer',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/reject`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Destination wallet failed validation',
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/deposits?status=approved')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<Array<Record<string, unknown>>>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: depositId,
              reviewNote: 'Matched incoming transfer',
              status: 'approved',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/admin/withdrawals?status=rejected')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<Array<Record<string, unknown>>>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: withdrawalId,
              reviewNote: 'Destination wallet failed validation',
              status: 'rejected',
            }),
          ]),
        );
      });
  });

  it('restores a rejected deposit back to pending review and linked reservation state', async () => {
    const email = `restore-deposit-rejected-${Date.now()}@example.com`;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit, reservation } = await createConfirmedVndDeposit(
      userAccessToken,
      '125000',
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/reject`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Rejected by mistake',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/restore-pending`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/deposits')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<UserDepositPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: deposit.id,
              rejectedAt: null,
              reviewNote: null,
              status: 'pending',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/deposit-reservations/current')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<CurrentDepositReservationPayload | null>(response)).toEqual(
          expect.objectContaining({
            depositRequestId: deposit.id,
            depositStatus: 'pending',
            reservationId: reservation.reservationId,
            status: 'pending_review',
            transferContent: reservation.transferContent,
          }),
        );
      });
  });

  it('restores an approved deposit to pending and reverses the credited wallet balance', async () => {
    const email = `restore-deposit-approved-${Date.now()}@example.com`;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit, reservation } = await createConfirmedVndDeposit(
      userAccessToken,
      '100000',
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Approved by mistake',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/restore-pending`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/wallets')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        const vndWallet = findWallet(
          responseData<WalletSummary[]>(response),
          'VND',
        );

        expect(vndWallet.balances).toEqual({
          available: '0',
          pending: '0',
          total: '0',
        });
      });

    await request(app.getHttpServer())
      .get('/api/v1/deposit-reservations/current')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<CurrentDepositReservationPayload | null>(response)).toEqual(
          expect.objectContaining({
            depositRequestId: deposit.id,
            depositStatus: 'pending',
            reservationId: reservation.reservationId,
            status: 'pending_review',
          }),
        );
      });
  });

  it('restores a rejected withdrawal to pending and re-reserves the amount', async () => {
    const email = `restore-withdrawal-rejected-${Date.now()}@example.com`;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit } = await createConfirmedVndDeposit(userAccessToken, '150000');

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Seed balance',
      })
      .expect(200);

    const twoFactorKey = await enableTwoFactor(userAccessToken);

    const withdrawalResponse = await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `restore-withdrawal-rejected-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '25000',
        method: 'bank_transfer',
        twoFactorCode: generateTotpCode(twoFactorKey),
        destinationDetails: {
          accountName: 'NGUYEN VAN A',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
          method: 'bank_transfer',
        },
      })
      .expect(201);

    const withdrawalId = responseData<EntityWithId>(withdrawalResponse).id;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/reject`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Rejected by mistake',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/restore-pending`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<UserWithdrawalPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: withdrawalId,
              rejectedAt: null,
              reviewNote: null,
              status: 'pending',
              totalDebit: '25000',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/wallets')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        const vndWallet = findWallet(
          responseData<WalletSummary[]>(response),
          'VND',
        );

        expect(vndWallet.balances).toEqual({
          available: '125000',
          pending: '25000',
          total: '150000',
        });
      });
  });

  it('restores an approved withdrawal to pending and returns the amount to pending balance', async () => {
    const email = `restore-withdrawal-approved-${Date.now()}@example.com`;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit } = await createConfirmedVndDeposit(userAccessToken, '150000');

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Seed balance',
      })
      .expect(200);

    const twoFactorKey = await enableTwoFactor(userAccessToken);

    const withdrawalResponse = await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `restore-withdrawal-approved-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '25000',
        method: 'bank_transfer',
        twoFactorCode: generateTotpCode(twoFactorKey),
        destinationDetails: {
          accountName: 'NGUYEN VAN A',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
          method: 'bank_transfer',
        },
      })
      .expect(201);

    const withdrawalId = responseData<EntityWithId>(withdrawalResponse).id;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Approved by mistake',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/restore-pending`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<UserWithdrawalPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              approvedAt: null,
              id: withdrawalId,
              reviewNote: null,
              status: 'pending',
              totalDebit: '25000',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/wallets')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        const vndWallet = findWallet(
          responseData<WalletSummary[]>(response),
          'VND',
        );

        expect(vndWallet.balances).toEqual({
          available: '125000',
          pending: '25000',
          total: '150000',
        });
      });
  });

  it('fails to restore an approved deposit when the credited balance has already been spent', async () => {
    const email = `restore-deposit-conflict-${Date.now()}@example.com`;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit } = await createConfirmedVndDeposit(userAccessToken, '100000');

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Approved and later spent',
      })
      .expect(200);

    const quoteResponse = await request(app.getHttpServer())
      .post('/api/v1/exchange/quote')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        fromAssetCode: 'VND',
        toAssetCode: 'USDT',
        amount: '50000',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/exchange/execute')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `restore-deposit-conflict-${Date.now()}`)
      .send({
        quoteId: responseData<EntityWithId>(quoteResponse).id,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/restore-pending`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({})
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe('insufficient_balance');
      });
  });

  it('rejects admin queue access for non-admin users', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `not-admin-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    await request(app.getHttpServer())
      .get('/api/v1/admin/deposits')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/admin/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(403);
  });

  it('lets admin manage bank accounts and exposes daily limit metrics', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    const createResponse = await createBankAccount(adminAccessToken, {
      accountName: 'NGAN LUONG A',
      accountNumber: '1234567890',
      dailyLimit: '500000',
      priority: 1,
    });

    const created = responseData<Record<string, unknown>>(createResponse);
    expect(created).toEqual(
      expect.objectContaining({
        accountName: 'NGAN LUONG A',
        accountNumber: '1234567890',
        bankCode: '970436',
        bankName: 'Vietcombank',
        dailyLimit: '500000',
        isActive: true,
        priority: 1,
        remainingToday: '500000',
        usedToday: '0',
      }),
    );

    const bankAccountId = String(created.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/bank-accounts/${bankAccountId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        accountName: 'NGAN LUONG PRIMARY',
        accountNumber: '1234567890',
        bankCode: '970436',
        bankName: 'Vietcombank',
        dailyLimit: '800000',
        isActive: true,
        priority: 1,
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<Array<Record<string, unknown>>>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              accountName: 'NGAN LUONG PRIMARY',
              accountNumber: '1234567890',
              bankCode: '970436',
              bankName: 'Vietcombank',
              dailyLimit: '800000',
              isActive: true,
              priority: 1,
              remainingToday: '800000',
              usedToday: '0',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .post('/api/v1/admin/bank-accounts/reset-daily-usage')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/bank-accounts/${bankAccountId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);
  });

  it('selects deposit bank accounts by priority and remaining daily limit, then increments usage on approval', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'BANK A',
      accountNumber: '111111111',
      dailyLimit: '100000',
      priority: 1,
    });

    await createBankAccount(adminAccessToken, {
      accountName: 'BANK B',
      accountNumber: '222222222',
      bankCode: '970418',
      bankName: 'BIDV',
      dailyLimit: '300000',
      priority: 2,
    });

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `bank-fallback-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit: firstDeposit } = await createConfirmedVndDeposit(
      userAccessToken,
      '90000',
    );
    expect(firstDeposit).toEqual(
      expect.objectContaining({
        amount: '90000',
        assetCode: 'VND',
        status: 'pending',
      }),
    );
    expect(firstDeposit.selectedBankAccount).toEqual(
      expect.objectContaining({
        accountName: 'BANK A',
        accountNumber: '111111111',
        bankCode: '970436',
        bankName: 'Vietcombank',
        priority: 1,
      }),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${String(firstDeposit.id)}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Matched to bank A',
      })
      .expect(200);

    const { deposit: secondDeposit } = await createConfirmedVndDeposit(
      userAccessToken,
      '120000',
    );
    expect(secondDeposit.selectedBankAccount).toEqual(
      expect.objectContaining({
        accountName: 'BANK B',
        accountNumber: '222222222',
        bankCode: '970418',
        bankName: 'BIDV',
        priority: 2,
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<Array<Record<string, unknown>>>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              accountName: 'BANK A',
              remainingToday: '10000',
              usedToday: '90000',
            }),
            expect.objectContaining({
              accountName: 'BANK B',
              remainingToday: '180000',
              reservedPendingReview: '120000',
              usedToday: '0',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${String(secondDeposit.id)}/reject`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Transfer not received',
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/deposits')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .query({
        status: 'all',
      })
      .expect(200)
      .expect((response) => {
        const adminDeposits =
          responseData<Array<Record<string, unknown>>>(response);
        const reviewedDeposit = adminDeposits.find(
          (item) => item.id === String(secondDeposit.id),
        );

        expect(reviewedDeposit).toEqual(
          expect.objectContaining({
            id: String(secondDeposit.id),
          }),
        );
        expect(reviewedDeposit?.selectedBankAccount).toEqual(
          expect.objectContaining({
            accountName: 'BANK B',
            accountNumber: '222222222',
          }),
        );
      });
  });

  it('resets usedToday once per usage date when housekeeping runs', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    const createdBank = responseData<EntityWithId>(
      await createBankAccount(adminAccessToken, {
        accountName: 'RESET HOUSEKEEPING BANK',
        accountNumber: '555111333',
        bankCode: '970436',
        bankName: 'Vietcombank',
        dailyLimit: '500000',
        priority: 1,
      }),
    );

    const databaseService = app.get(DatabaseService);
    const bankAccountsService = app.get(BankAccountsService);

    await databaseService.db
      .update(bankAccounts)
      .set({
        usedTodayMinor: 12345n,
      })
      .where(eq(bankAccounts.id, createdBank.id));

    const [existingUsageDateSetting] = await databaseService.db
      .select({ key: settings.key })
      .from(settings)
      .where(eq(settings.key, 'bank_account_usage_date'))
      .limit(1);

    if (existingUsageDateSetting) {
      await databaseService.db
        .update(settings)
        .set({
          value: '2000-01-01',
        })
        .where(eq(settings.key, 'bank_account_usage_date'));
    } else {
      await databaseService.db.insert(settings).values({
        key: 'bank_account_usage_date',
        value: '2000-01-01',
      });
    }

    await bankAccountsService.ensureUsageDateCurrent();

    const [afterFirstRun] = await databaseService.db
      .select({
        usedTodayMinor: bankAccounts.usedTodayMinor,
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.id, createdBank.id))
      .limit(1);

    expect(afterFirstRun?.usedTodayMinor).toBe(0n);

    await databaseService.db
      .update(bankAccounts)
      .set({
        usedTodayMinor: 777n,
      })
      .where(eq(bankAccounts.id, createdBank.id));

    await bankAccountsService.ensureUsageDateCurrent();

    const [afterSecondRun] = await databaseService.db
      .select({
        usedTodayMinor: bankAccounts.usedTodayMinor,
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.id, createdBank.id))
      .limit(1);

    expect(afterSecondRun?.usedTodayMinor).toBe(777n);
  });

  it('rejects VND bank deposits when no active bank account has enough remaining daily limit', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'LIMITED BANK',
      accountNumber: '333333333',
      bankCode: '970422',
      bankName: 'MB',
      dailyLimit: '50000',
      priority: 1,
    });

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `bank-limit-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    await request(app.getHttpServer())
      .post('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        amount: '60000',
        assetCode: 'VND',
        method: 'bank_transfer',
      })
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe(
          'bank_account_capacity_exhausted',
        );
        expect(responseError(response).message).toBe(
          'Hiện tại chưa có tài khoản ngân hàng phù hợp cho số tiền này.',
        );
      });
  });

  it('creates a VND deposit reservation, keeps it out of admin queue until confirmed, and turns it into a deposit request on confirm', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'RESERVATION BANK',
      accountNumber: '444444444',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '500000',
      priority: 1,
    });

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `reservation-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const reservationResponse = await request(app.getHttpServer())
      .post('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        amount: '50000',
        assetCode: 'VND',
        method: 'bank_transfer',
      })
      .expect(201);

    const reservation =
      responseData<DepositReservationPayload>(reservationResponse);

    expect(reservation).toEqual(
      expect.objectContaining({
        amount: '50000',
        assetCode: 'VND',
        status: 'active',
      }),
    );
    expect(typeof reservation.reservationId).toBe('string');
    expect(reservation.selectedBankAccount).toEqual(
      expect.objectContaining({
        accountName: 'RESERVATION BANK',
        accountNumber: '444444444',
      }),
    );
    expect(typeof reservation.expiresAt).toBe('string');
    expect(typeof reservation.transferContent).toBe('string');

    await request(app.getHttpServer())
      .get('/api/v1/admin/deposits')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .query({
        status: 'all',
      })
      .expect(200)
      .expect((response) => {
        const deposits = responseData<Array<Record<string, unknown>>>(response);
        expect(
          deposits.find((item) => item.id === reservation.reservationId),
        ).toBeUndefined();
      });

    const confirmResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/deposit-reservations/${String(reservation.reservationId)}/confirm`,
      )
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(201);

    const confirmedDeposit = responseData<DepositQueuePayload>(confirmResponse);

    expect(confirmedDeposit).toEqual(
      expect.objectContaining({
        amount: '50000',
        assetCode: 'VND',
        status: 'pending',
      }),
    );
    expect(typeof confirmedDeposit.id).toBe('string');
    expect(confirmedDeposit.selectedBankAccount).toEqual(
      expect.objectContaining({
        accountName: 'RESERVATION BANK',
        accountNumber: '444444444',
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/admin/deposits')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .query({
        status: 'pending',
      })
      .expect(200)
      .expect((response) => {
        const deposits = responseData<Array<Record<string, unknown>>>(response);
        expect(
          deposits.find((item) => item.id === confirmedDeposit.id),
        ).toEqual(
          expect.objectContaining({
            id: confirmedDeposit.id,
          }),
        );
      });
  });

  it('returns the current live reservation for the user and transitions it from active to pending_review to null', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'CURRENT RESERVATION BANK',
      accountNumber: '445566778',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '500000',
      priority: 1,
    });

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `current-reservation-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const reservation = responseData<DepositReservationPayload>(
      await request(app.getHttpServer())
        .post('/api/v1/deposit-reservations')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          amount: '75000',
          assetCode: 'VND',
          method: 'bank_transfer',
        })
        .expect(201),
    );

    await request(app.getHttpServer())
      .get('/api/v1/deposit-reservations/current')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          responseData<CurrentDepositReservationPayload | null>(response),
        ).toEqual(
          expect.objectContaining({
            amount: '75000',
            assetCode: 'VND',
            depositRequestId: null,
            depositStatus: null,
            reservationId: reservation.reservationId,
            status: 'active',
          }),
        );
      });

    const confirmedDeposit = responseData<DepositQueuePayload>(
      await request(app.getHttpServer())
        .post(
          `/api/v1/deposit-reservations/${String(reservation.reservationId)}/confirm`,
        )
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201),
    );

    await request(app.getHttpServer())
      .get('/api/v1/deposit-reservations/current')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          responseData<CurrentDepositReservationPayload | null>(response),
        ).toEqual(
          expect.objectContaining({
            amount: '75000',
            assetCode: 'VND',
            depositRequestId: confirmedDeposit.id,
            depositStatus: 'pending',
            reservationId: reservation.reservationId,
            status: 'pending_review',
          }),
        );
      });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${confirmedDeposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'approved current reservation test',
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/deposit-reservations/current')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          responseData<CurrentDepositReservationPayload | null>(response),
        ).toBeNull();
      });
  });

  it('treats expired active reservations as non-live for current reservation reads and new reservation creation', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'CURRENT EXPIRY BANK',
      accountNumber: '445566779',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '500000',
      priority: 1,
    });

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `current-expired-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const expiredReservation = responseData<DepositReservationPayload>(
      await request(app.getHttpServer())
        .post('/api/v1/deposit-reservations')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          amount: '75000',
          assetCode: 'VND',
          method: 'bank_transfer',
        })
        .expect(201),
    );

    const databaseService = app.get(DatabaseService);

    await databaseService.db
      .update(depositReservations)
      .set({
        expiresAt: new Date(Date.now() - 60_000),
      })
      .where(eq(depositReservations.id, expiredReservation.reservationId));

    await request(app.getHttpServer())
      .get('/api/v1/deposit-reservations/current')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          responseData<CurrentDepositReservationPayload | null>(response),
        ).toBeNull();
      });

    await request(app.getHttpServer())
      .post('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        amount: '65000',
        assetCode: 'VND',
        method: 'bank_transfer',
      })
      .expect(201);
  });

  it('moves confirmed reservations from reservedUnconfirmed into reservedPendingReview in admin bank accounting', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'BANK PRIMARY',
      accountNumber: '555555555',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '100000',
      priority: 1,
    });
    await createBankAccount(adminAccessToken, {
      accountName: 'BANK FALLBACK',
      accountNumber: '666666666',
      bankCode: '970418',
      bankName: 'BIDV',
      dailyLimit: '300000',
      priority: 2,
    });

    const userOneResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `reservation-primary-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);
    const userTwoResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `reservation-fallback-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userOneAccessToken =
      responseData<AuthPayload>(userOneResponse).accessToken;
    const userTwoAccessToken =
      responseData<AuthPayload>(userTwoResponse).accessToken;

    const firstReservationResponse = await request(app.getHttpServer())
      .post('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${userOneAccessToken}`)
      .send({
        amount: '90000',
        assetCode: 'VND',
        method: 'bank_transfer',
      })
      .expect(201);

    const secondReservationResponse = await request(app.getHttpServer())
      .post('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${userTwoAccessToken}`)
      .send({
        amount: '20000',
        assetCode: 'VND',
        method: 'bank_transfer',
      })
      .expect(201);

    const firstReservation = responseData<DepositReservationPayload>(
      firstReservationResponse,
    );
    const secondReservation = responseData<DepositReservationPayload>(
      secondReservationResponse,
    );

    expect(firstReservation.selectedBankAccount).toMatchObject({
      accountName: 'BANK PRIMARY',
      accountNumber: '555555555',
    });

    expect(secondReservation.selectedBankAccount).toMatchObject({
      accountName: 'BANK FALLBACK',
      accountNumber: '666666666',
    });

    await request(app.getHttpServer())
      .post(
        `/api/v1/deposit-reservations/${String(firstReservation.reservationId)}/confirm`,
      )
      .set('Authorization', `Bearer ${userOneAccessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<AdminBankAccountPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              accountName: 'BANK PRIMARY',
              reservedPendingReview: '90000',
              reservedUnconfirmed: '0',
              remainingToday: '10000',
              usedToday: '0',
            }),
            expect.objectContaining({
              accountName: 'BANK FALLBACK',
              reservedPendingReview: '0',
              reservedUnconfirmed: '20000',
              remainingToday: '280000',
              usedToday: '0',
            }),
          ]),
        );
      });
  });

  it('moves pending-review reserved amounts into usedToday on approve and clears them on reject', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'BANK A',
      accountNumber: '777777777',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '200000',
      priority: 1,
    });
    await createBankAccount(adminAccessToken, {
      accountName: 'BANK B',
      accountNumber: '888888888',
      bankCode: '970418',
      bankName: 'BIDV',
      dailyLimit: '200000',
      priority: 2,
    });

    const approveUserResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `reservation-approve-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);
    const rejectUserResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `reservation-reject-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const approveUserAccessToken =
      responseData<AuthPayload>(approveUserResponse).accessToken;
    const rejectUserAccessToken =
      responseData<AuthPayload>(rejectUserResponse).accessToken;

    const approveReservation = responseData<DepositReservationPayload>(
      await request(app.getHttpServer())
        .post('/api/v1/deposit-reservations')
        .set('Authorization', `Bearer ${approveUserAccessToken}`)
        .send({
          amount: '70000',
          assetCode: 'VND',
          method: 'bank_transfer',
        })
        .expect(201),
    );

    const rejectReservation = responseData<DepositReservationPayload>(
      await request(app.getHttpServer())
        .post('/api/v1/deposit-reservations')
        .set('Authorization', `Bearer ${rejectUserAccessToken}`)
        .send({
          amount: '30000',
          assetCode: 'VND',
          method: 'bank_transfer',
        })
        .expect(201),
    );

    const approvedDeposit = responseData<DepositQueuePayload>(
      await request(app.getHttpServer())
        .post(
          `/api/v1/deposit-reservations/${approveReservation.reservationId}/confirm`,
        )
        .set('Authorization', `Bearer ${approveUserAccessToken}`)
        .expect(201),
    );
    const rejectedDeposit = responseData<DepositQueuePayload>(
      await request(app.getHttpServer())
        .post(
          `/api/v1/deposit-reservations/${rejectReservation.reservationId}/confirm`,
        )
        .set('Authorization', `Bearer ${rejectUserAccessToken}`)
        .expect(201),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${approvedDeposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'approved reservation bucket',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${rejectedDeposit.id}/reject`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'rejected reservation bucket',
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<AdminBankAccountPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              accountName: 'BANK A',
              reservedPendingReview: '0',
              reservedUnconfirmed: '0',
              remainingToday: '130000',
              usedToday: '70000',
            }),
            expect.objectContaining({
              accountName: 'BANK B',
              reservedPendingReview: '0',
              reservedUnconfirmed: '0',
              remainingToday: '200000',
              usedToday: '0',
            }),
          ]),
        );
      });
  });

  it('loads and updates the global deposit reservation ttl from admin settings', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;
    const userRegisterResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `settings-user-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(userRegisterResponse).accessToken;

    await request(app.getHttpServer())
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
          expect(responseData<Record<string, unknown>>(response)).toEqual(
          expect.objectContaining({
            depositReservationTtlMinutes: 15,
            exchangeVndToUsdtMarkupVnd: 1000,
            homepageBanners: [],
            supportLink: 'https://t.me/nganluong_support',
            withdrawalUsdtFeeBps: 0,
            withdrawalVndFeeBps: 1000,
          }),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/settings/display')
      .expect(200)
      .expect((response) => {
        expect(responseData<Record<string, unknown>>(response)).toEqual(
          expect.objectContaining({
            homepageBanners: [],
            supportLink: 'https://t.me/nganluong_support',
          }),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/settings/financial')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
          expect(responseData<Record<string, unknown>>(response)).toEqual(
          expect.objectContaining({
            exchangeVndToUsdtMarkupVnd: 1000,
            withdrawalUsdtFeeBps: 0,
            withdrawalVndFeeBps: 1000,
          }),
        );
      });

    await request(app.getHttpServer())
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        depositReservationTtlMinutes: 20,
        exchangeUsdtToVndFeeBps: 50,
        exchangeUsdtToVndMarkupVnd: 700,
        exchangeVndToUsdtFeeBps: 100,
        exchangeVndToUsdtMarkupVnd: 1750,
        supportLink: ' https://t.me/nganluong_hotline ',
        withdrawalUsdtFeeBps: 125,
        withdrawalVndFeeBps: 1200,
      })
      .expect(200)
      .expect((response) => {
          expect(responseData<Record<string, unknown>>(response)).toEqual(
          expect.objectContaining({
            depositReservationTtlMinutes: 20,
            exchangeVndToUsdtMarkupVnd: 1750,
            homepageBanners: [],
            supportLink: 'https://t.me/nganluong_hotline',
            withdrawalUsdtFeeBps: 125,
            withdrawalVndFeeBps: 1200,
          }),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
          expect(responseData<Record<string, unknown>>(response)).toEqual(
          expect.objectContaining({
            depositReservationTtlMinutes: 20,
            exchangeVndToUsdtMarkupVnd: 1750,
            homepageBanners: [],
            supportLink: 'https://t.me/nganluong_hotline',
            withdrawalUsdtFeeBps: 125,
            withdrawalVndFeeBps: 1200,
          }),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/settings/display')
      .expect(200)
      .expect((response) => {
        expect(responseData<Record<string, unknown>>(response)).toEqual(
          expect.objectContaining({
            homepageBanners: [],
            supportLink: 'https://t.me/nganluong_hotline',
          }),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/settings/financial')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
          expect(responseData<Record<string, unknown>>(response)).toEqual(
          expect.objectContaining({
            exchangeVndToUsdtMarkupVnd: 1750,
            withdrawalUsdtFeeBps: 125,
            withdrawalVndFeeBps: 1200,
          }),
        );
      });
  });

  it('uploads, reorders, deletes, and publicly serves homepage banners from admin settings', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;
    const firstBanner = createPngBuffer(1600, 500);
    const secondBanner = createPngBuffer(3200, 1000);

    const firstUpload = await request(app.getHttpServer())
      .post('/api/v1/admin/settings/banners')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .attach('image', firstBanner, {
        contentType: 'image/png',
        filename: 'banner-1.png',
      })
      .expect(201);

    const secondUpload = await request(app.getHttpServer())
      .post('/api/v1/admin/settings/banners')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .attach('image', secondBanner, {
        contentType: 'image/png',
        filename: 'banner-2.png',
      })
      .expect(201);

    const firstBannerData = responseData<Record<string, unknown>>(firstUpload);
    const secondBannerData = responseData<Record<string, unknown>>(secondUpload);

    expect(firstBannerData).toEqual(
      expect.objectContaining({
        height: 500,
        imageUrl: expect.stringMatching(/^\/api\/v1\/public\/homepage-banners\/.+\.png$/),
        sortOrder: 0,
        width: 1600,
      }),
    );
    expect(secondBannerData).toEqual(
      expect.objectContaining({
        height: 1000,
        imageUrl: expect.stringMatching(/^\/api\/v1\/public\/homepage-banners\/.+\.png$/),
        sortOrder: 1,
        width: 3200,
      }),
    );

    await request(app.getHttpServer())
      .get(String(firstBannerData.imageUrl))
      .expect(200)
      .expect('Content-Type', /image\/png/);

    await request(app.getHttpServer())
      .patch('/api/v1/admin/settings/banners/order')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        bannerIds: [String(secondBannerData.id), String(firstBannerData.id)],
      })
      .expect(200)
      .expect((response) => {
        expect(responseData<Array<Record<string, unknown>>>(response)).toEqual([
          expect.objectContaining({
            id: secondBannerData.id,
            sortOrder: 0,
          }),
          expect.objectContaining({
            id: firstBannerData.id,
            sortOrder: 1,
          }),
        ]);
      });

    await request(app.getHttpServer())
      .get('/api/v1/settings/display')
      .expect(200)
      .expect((response) => {
        expect(responseData<Record<string, unknown>>(response)).toEqual(
          expect.objectContaining({
            homepageBanners: [
              expect.objectContaining({ id: secondBannerData.id, sortOrder: 0 }),
              expect.objectContaining({ id: firstBannerData.id, sortOrder: 1 }),
            ],
            supportLink: 'https://t.me/nganluong_support',
          }),
        );
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/settings/banners/${String(firstBannerData.id)}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/settings/display')
      .expect(200)
      .expect((response) => {
        expect(responseData<Record<string, unknown>>(response)).toEqual(
          expect.objectContaining({
            homepageBanners: [
              expect.objectContaining({ id: secondBannerData.id, sortOrder: 0 }),
            ],
          }),
        );
      });
  });

  it('rejects invalid homepage banner uploads for wrong ratio and when exceeding the five-banner cap', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await request(app.getHttpServer())
      .post('/api/v1/admin/settings/banners')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .attach('image', createPngBuffer(900, 500), {
        contentType: 'image/png',
        filename: 'invalid-ratio.png',
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.error).toEqual(
          expect.objectContaining({
            code: 'invalid_banner_image',
          }),
        );
      });

    for (let index = 0; index < 5; index += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/admin/settings/banners')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .attach('image', createPngBuffer(1600, 500), {
          contentType: 'image/png',
          filename: `banner-${index}.png`,
        })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/api/v1/admin/settings/banners')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .attach('image', createPngBuffer(1600, 500), {
        contentType: 'image/png',
        filename: 'banner-overflow.png',
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.error).toEqual(
          expect.objectContaining({
            code: 'homepage_banner_limit_reached',
          }),
        );
      });
  });

  it('rejects blank display settings in admin settings updates', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await request(app.getHttpServer())
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        depositReservationTtlMinutes: 20,
        exchangeUsdtToVndFeeBps: 50,
        exchangeUsdtToVndMarkupVnd: 700,
        exchangeVndToUsdtFeeBps: 100,
        exchangeVndToUsdtMarkupVnd: 1750,
        supportLink: '   ',
        withdrawalUsdtFeeBps: 125,
        withdrawalVndFeeBps: 1200,
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.error).toEqual(
          expect.objectContaining({
            code: 'invalid_setting',
          }),
        );
      });
  });

  it('rejects direct VND bank-transfer deposits and requires the reservation flow instead', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'DIRECT BLOCK BANK',
      accountNumber: '912345678',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '400000',
      priority: 1,
    });

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `direct-vnd-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    await request(app.getHttpServer())
      .post('/api/v1/deposits')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `deposit-direct-vnd-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '100000',
        method: 'bank_transfer',
      })
      .expect(400)
      .expect((response) => {
        expect(responseError(response).code).toBe(
          'deposit_vnd_requires_reservation',
        );
        expect(responseError(response).message).toContain('giữ chỗ');
      });
  });

  it('rejects direct USDT deposits and keeps the reservation flow as the only supported deposit path', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `direct-usdt-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    await request(app.getHttpServer())
      .post('/api/v1/deposits')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `deposit-direct-usdt-${Date.now()}`)
      .send({
        assetCode: 'USDT',
        amount: '25',
        method: 'bep20',
        destinationRef: '0x123',
      })
      .expect(400)
      .expect((response) => {
        expect(responseError(response).code).toBe('deposit_usdt_disabled');
        expect(responseError(response).message).toContain('VNĐ');
      });
  });

  it('allows up to 10 pending-review VND bills and then blocks creating a new reservation', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'LIMITED USER FLOW BANK',
      accountNumber: '923456781',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '2000000',
      priority: 1,
    });

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `single-reservation-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

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

    await request(app.getHttpServer())
      .post('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        amount: '120000',
        assetCode: 'VND',
        method: 'bank_transfer',
      })
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe(
          'deposit_reservation_active_exists',
        );
        expect(responseError(response).message).toContain('còn hiệu lực');
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/deposit-reservations/${String(reservation.reservationId)}/confirm`,
      )
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(201);

    for (let index = 0; index < 9; index += 1) {
      const nextReservation = responseData<DepositReservationPayload>(
        await request(app.getHttpServer())
          .post('/api/v1/deposit-reservations')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            amount: '100000',
            assetCode: 'VND',
            method: 'bank_transfer',
          })
          .expect(201),
      );

      await request(app.getHttpServer())
        .post(
          `/api/v1/deposit-reservations/${String(nextReservation.reservationId)}/confirm`,
        )
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        amount: '140000',
        assetCode: 'VND',
        method: 'bank_transfer',
      })
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe(
          'deposit_reservation_pending_review_limit_reached',
        );
        expect(responseError(response).message).toContain('10 bill');
      });
  });

  it('lists live reservations so the dashboard can show one active QR and multiple pending-review bills', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'LIST RESERVATIONS BANK',
      accountNumber: '923456782',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '500000',
      priority: 1,
    });

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `list-reservations-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const firstReservation = responseData<DepositReservationPayload>(
      await request(app.getHttpServer())
        .post('/api/v1/deposit-reservations')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          amount: '70000',
          assetCode: 'VND',
          method: 'bank_transfer',
        })
        .expect(201),
    );

    const firstDeposit = responseData<DepositQueuePayload>(
      await request(app.getHttpServer())
        .post(
          `/api/v1/deposit-reservations/${String(firstReservation.reservationId)}/confirm`,
        )
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(201),
    );

    const secondReservation = responseData<DepositReservationPayload>(
      await request(app.getHttpServer())
        .post('/api/v1/deposit-reservations')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          amount: '80000',
          assetCode: 'VND',
          method: 'bank_transfer',
        })
        .expect(201),
    );

    await request(app.getHttpServer())
      .get('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<DepositReservationPayload[]>(response)).toEqual([
          expect.objectContaining({
            amount: '80000',
            reservationId: secondReservation.reservationId,
            status: 'active',
          }),
          expect.objectContaining({
            amount: '70000',
            depositRequestId: firstDeposit.id,
            depositStatus: 'pending',
            reservationId: firstReservation.reservationId,
            status: 'pending_review',
          }),
        ]);
      });
  });

  it('allows the owner to cancel a pending-review bill and removes it from admin pending review', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'CANCEL PENDING BILL BANK',
      accountNumber: '934567893',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '200000',
      priority: 1,
    });

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `cancel-pending-bill-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit, reservation } = await createConfirmedVndDeposit(
      userAccessToken,
      '80000',
    );

    await request(app.getHttpServer())
      .post(
        `/api/v1/deposit-reservations/${String(reservation.reservationId)}/cancel`,
      )
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/deposits')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<UserDepositPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: deposit.id,
              reviewNote: 'Hủy bởi người dùng',
              status: 'rejected',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/admin/deposits?status=pending')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          responseData<Array<{ id: string }>>(response).some(
            (item) => item.id === deposit.id,
          ),
        ).toBe(false);
      });

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<AdminBankAccountPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              accountName: 'CANCEL PENDING BILL BANK',
              reservedPendingReview: '0',
              reservedUnconfirmed: '0',
              remainingToday: '200000',
            }),
          ]),
        );
      });
  });

  it('allows the owner to cancel an active reservation and frees the held capacity immediately', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'CANCEL RESERVATION BANK',
      accountNumber: '934567892',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '100000',
      priority: 1,
    });

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `cancel-reservation-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const reservation = responseData<DepositReservationPayload>(
      await request(app.getHttpServer())
        .post('/api/v1/deposit-reservations')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          amount: '80000',
          assetCode: 'VND',
          method: 'bank_transfer',
        })
        .expect(201),
    );

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<AdminBankAccountPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              accountName: 'CANCEL RESERVATION BANK',
              reservedUnconfirmed: '80000',
              remainingToday: '20000',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/deposit-reservations/${String(reservation.reservationId)}/cancel`,
      )
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<AdminBankAccountPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              accountName: 'CANCEL RESERVATION BANK',
              reservedPendingReview: '0',
              reservedUnconfirmed: '0',
              remainingToday: '100000',
              usedToday: '0',
            }),
          ]),
        );
      });
  });

  it('rejects lowering a bank daily limit below reservedUnconfirmed', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    const bankResponse = await createBankAccount(adminAccessToken, {
      accountName: 'LIMIT ACTIVE BANK',
      accountNumber: '955678901',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '200000',
      priority: 1,
    });

    const activeUserResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `limit-active-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const activeUserAccessToken =
      responseData<AuthPayload>(activeUserResponse).accessToken;

    const activeReservation = responseData<DepositReservationPayload>(
      await request(app.getHttpServer())
        .post('/api/v1/deposit-reservations')
        .set('Authorization', `Bearer ${activeUserAccessToken}`)
        .send({
          amount: '80000',
          assetCode: 'VND',
          method: 'bank_transfer',
        })
        .expect(201),
    );

    const bankId = String(
      responseData<Record<string, unknown>>(bankResponse).id,
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/bank-accounts/${bankId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        accountName: 'LIMIT ACTIVE BANK',
        accountNumber: '955678901',
        bankCode: '970436',
        bankName: 'Vietcombank',
        dailyLimit: '79999',
        isActive: true,
        priority: 1,
      })
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe(
          'bank_account_daily_limit_below_committed_usage',
        );
      });

    expect(activeReservation.selectedBankAccount).toMatchObject({
      accountName: 'LIMIT ACTIVE BANK',
    });
  });

  it('rejects lowering a bank daily limit below reservedPendingReview', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    const bankResponse = await createBankAccount(adminAccessToken, {
      accountName: 'LIMIT PENDING BANK',
      accountNumber: '955678902',
      bankCode: '970418',
      bankName: 'BIDV',
      dailyLimit: '200000',
      priority: 1,
    });

    const pendingUserResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `limit-pending-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const pendingUserAccessToken =
      responseData<AuthPayload>(pendingUserResponse).accessToken;

    const pendingReservation = responseData<DepositReservationPayload>(
      await request(app.getHttpServer())
        .post('/api/v1/deposit-reservations')
        .set('Authorization', `Bearer ${pendingUserAccessToken}`)
        .send({
          amount: '60000',
          assetCode: 'VND',
          method: 'bank_transfer',
        })
        .expect(201),
    );

    await request(app.getHttpServer())
      .post(
        `/api/v1/deposit-reservations/${pendingReservation.reservationId}/confirm`,
      )
      .set('Authorization', `Bearer ${pendingUserAccessToken}`)
      .expect(201);

    const bankId = String(
      responseData<Record<string, unknown>>(bankResponse).id,
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/bank-accounts/${bankId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        accountName: 'LIMIT PENDING BANK',
        accountNumber: '955678902',
        bankCode: '970418',
        bankName: 'BIDV',
        dailyLimit: '59999',
        isActive: true,
        priority: 1,
      })
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe(
          'bank_account_daily_limit_below_committed_usage',
        );
      });
  });

  it('rejects lowering a bank daily limit below usedToday', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    const bankResponse = await createBankAccount(adminAccessToken, {
      accountName: 'LIMIT USED BANK',
      accountNumber: '955678903',
      bankCode: '970422',
      bankName: 'MB',
      dailyLimit: '200000',
      priority: 1,
    });

    const usedUserResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `limit-used-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const usedUserAccessToken =
      responseData<AuthPayload>(usedUserResponse).accessToken;

    const usedDeposit = await createConfirmedVndDeposit(
      usedUserAccessToken,
      '70000',
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${usedDeposit.deposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'seed used today for daily limit validation',
      })
      .expect(200);

    const bankId = String(
      responseData<Record<string, unknown>>(bankResponse).id,
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/bank-accounts/${bankId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        accountName: 'LIMIT USED BANK',
        accountNumber: '955678903',
        bankCode: '970422',
        bankName: 'MB',
        dailyLimit: '69999',
        isActive: true,
        priority: 1,
      })
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe(
          'bank_account_daily_limit_below_committed_usage',
        );
      });
  });

  it('expires stale active reservations and frees the held capacity on the next selection', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'EXPIRY PRIMARY BANK',
      accountNumber: '965678901',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '100000',
      priority: 1,
    });
    await createBankAccount(adminAccessToken, {
      accountName: 'EXPIRY FALLBACK BANK',
      accountNumber: '965678902',
      bankCode: '970418',
      bankName: 'BIDV',
      dailyLimit: '100000',
      priority: 2,
    });

    const firstUserResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `expiry-first-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);
    const secondUserResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `expiry-second-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const firstUserAccessToken =
      responseData<AuthPayload>(firstUserResponse).accessToken;
    const secondUserAccessToken =
      responseData<AuthPayload>(secondUserResponse).accessToken;

    const reservation = responseData<DepositReservationPayload>(
      await request(app.getHttpServer())
        .post('/api/v1/deposit-reservations')
        .set('Authorization', `Bearer ${firstUserAccessToken}`)
        .send({
          amount: '90000',
          assetCode: 'VND',
          method: 'bank_transfer',
        })
        .expect(201),
    );

    const databaseService = app.get(DatabaseService);

    await databaseService.db
      .update(depositReservations)
      .set({
        expiresAt: new Date(Date.now() - 60_000),
      })
      .where(eq(depositReservations.id, reservation.reservationId));

    await request(app.getHttpServer())
      .post('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${secondUserAccessToken}`)
      .send({
        amount: '90000',
        assetCode: 'VND',
        method: 'bank_transfer',
      })
      .expect(201)
      .expect((response) => {
        expect(
          responseData<DepositReservationPayload>(response).selectedBankAccount,
        ).toMatchObject({
          accountName: 'EXPIRY PRIMARY BANK',
        });
      });
  });

  it('rejects duplicate bank account priority and duplicate bank identity', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    const firstBank = await createBankAccount(adminAccessToken, {
      accountName: 'UNIQUE PRIMARY',
      accountNumber: '975678901',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '100000',
      priority: 1,
    });
    const secondBank = await createBankAccount(adminAccessToken, {
      accountName: 'UNIQUE SECOND',
      accountNumber: '975678902',
      bankCode: '970418',
      bankName: 'BIDV',
      dailyLimit: '100000',
      priority: 2,
    });

    await request(app.getHttpServer())
      .post('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        accountName: 'DUPLICATE PRIORITY',
        accountNumber: '975678903',
        bankCode: '970422',
        bankName: 'MB',
        dailyLimit: '100000',
        isActive: true,
        priority: 1,
      })
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe(
          'bank_account_priority_conflict',
        );
      });

    await request(app.getHttpServer())
      .post('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        accountName: 'DUPLICATE IDENTITY',
        accountNumber: '975678901',
        bankCode: '970436',
        bankName: 'Vietcombank',
        dailyLimit: '100000',
        isActive: true,
        priority: 3,
      })
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe(
          'bank_account_identity_conflict',
        );
      });

    const secondBankId = String(
      responseData<Record<string, unknown>>(secondBank).id,
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/bank-accounts/${secondBankId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        accountName: 'UNIQUE SECOND',
        accountNumber: '975678902',
        bankCode: '970418',
        bankName: 'BIDV',
        dailyLimit: '100000',
        isActive: true,
        priority: 1,
      })
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe(
          'bank_account_priority_conflict',
        );
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/bank-accounts/${secondBankId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        accountName: 'UNIQUE SECOND',
        accountNumber: '975678901',
        bankCode: '970436',
        bankName: 'Vietcombank',
        dailyLimit: '100000',
        isActive: true,
        priority: 2,
      })
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe(
          'bank_account_identity_conflict',
        );
      });

    expect(
      String(responseData<Record<string, unknown>>(firstBank).id),
    ).toBeTruthy();
  });

  it('rejects deleting bank accounts that still back live reservations or pending deposits', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    const bankAccountResponse = await createBankAccount(adminAccessToken, {
      accountName: 'DELETE BLOCK BANK',
      accountNumber: '945678903',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '500000',
      priority: 1,
    });

    const bankAccountId = String(
      responseData<Record<string, unknown>>(bankAccountResponse).id,
    );

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `delete-bank-block-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const reservation = responseData<DepositReservationPayload>(
      await request(app.getHttpServer())
        .post('/api/v1/deposit-reservations')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          amount: '150000',
          assetCode: 'VND',
          method: 'bank_transfer',
        })
        .expect(201),
    );

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<AdminBankAccountPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              accountName: 'DELETE BLOCK BANK',
              canDelete: false,
              liveReservationCount: 1,
              pendingDepositCount: 0,
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/bank-accounts/${bankAccountId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe('bank_account_in_use');
        expect(responseError(response).message).toContain('được sử dụng');
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/deposit-reservations/${String(reservation.reservationId)}/confirm`,
      )
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<AdminBankAccountPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              accountName: 'DELETE BLOCK BANK',
              canDelete: false,
              liveReservationCount: 1,
              pendingDepositCount: 1,
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/bank-accounts/${bankAccountId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe('bank_account_in_use');
        expect(responseError(response).message).toContain('được sử dụng');
      });
  });

  it('returns rich user-facing deposit and withdrawal payloads for history and account screens', async () => {
    const email = `user-flow-${Date.now()}@example.com`;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken, {
      accountName: 'USER FLOW BANK',
      accountNumber: '956789014',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '900000',
      priority: 1,
    });

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit, reservation } = await createConfirmedVndDeposit(
      userAccessToken,
      '150000',
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Đã nhận đúng tiền',
      })
      .expect(200);

    const twoFactorKey = await enableTwoFactor(userAccessToken);

    const withdrawalResponse = await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `withdraw-rich-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '25000',
        method: 'bank_transfer',
        twoFactorCode: generateTotpCode(twoFactorKey),
        destinationDetails: {
          accountName: 'NGUYEN VAN A',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
          method: 'bank_transfer',
        },
        note: 'Rut tien test',
      })
      .expect(201);

    const withdrawalId = responseData<EntityWithId>(withdrawalResponse).id;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/reject`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Sai thông tin nhận tiền',
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/deposits')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<UserDepositPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              approvedAt: expect.any(String) as string,
              amount: '150000',
              destinationRef: reservation.transferContent,
              id: deposit.id,
              rejectedAt: null,
              reviewNote: 'Đã nhận đúng tiền',
              selectedBankAccount: expect.objectContaining({
                accountName: 'USER FLOW BANK',
                bankName: 'Vietcombank',
              }) as UserDepositPayload['selectedBankAccount'],
              status: 'approved',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<UserWithdrawalPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              approvedAt: null,
              destinationDetails: expect.objectContaining({
                accountName: 'NGUYEN VAN A',
                accountNumber: '123456789',
                bankName: 'Vietcombank',
                method: 'bank_transfer',
              }) as UserWithdrawalPayload['destinationDetails'],
              feeAmount: '2500',
              id: withdrawalId,
              rejectedAt: expect.any(String) as string,
              reviewNote: 'Sai thông tin nhận tiền',
              status: 'rejected',
              totalDebit: '25000',
            }),
          ]),
        );
      });
  });

  it('creates USDT withdrawals over the TRC20 network and returns the selected method in user history', async () => {
    const email = `withdraw-trc20-${Date.now()}@example.com`;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
      })
      .expect(201);

    const auth = responseData<AuthPayload>(registerResponse);
    const userAccessToken = auth.accessToken;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${auth.user.id}/add-balance`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        amount: '20',
        assetCode: 'USDT',
      })
      .expect(201);

    const twoFactorKey = await enableTwoFactor(userAccessToken);

    const withdrawalResponse = await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `withdraw-trc20-${Date.now()}`)
      .send({
        assetCode: 'USDT',
        amount: '10',
        method: 'trc20',
        twoFactorCode: generateTotpCode(twoFactorKey),
        destinationDetails: {
          method: 'trc20',
          network: 'TRC20',
          walletAddress: 'TXYZ123',
        },
        note: 'Rut USDT qua TRC20',
      })
      .expect(201);

    const withdrawalId = responseData<EntityWithId>(withdrawalResponse).id;

    await request(app.getHttpServer())
      .get('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<UserWithdrawalPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              amount: '10.00',
              assetCode: 'USDT',
              destinationDetails: expect.objectContaining({
                method: 'trc20',
                network: 'TRC20',
                walletAddress: 'TXYZ123',
              }) as UserWithdrawalPayload['destinationDetails'],
              feeAmount: '0.00',
              id: withdrawalId,
              method: 'trc20',
              status: 'pending',
              totalDebit: '10.00',
            }),
          ]),
        );
      });
  });

  it('lists completed exchange orders for admin with profit snapshots and date filtering', async () => {
    const email = `admin-exchange-orders-${Date.now()}@example.com`;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
      })
      .expect(201);

    const auth = responseData<AuthPayload>(registerResponse);
    const userAccessToken = auth.accessToken;
    const { deposit } = await createConfirmedVndDeposit(userAccessToken, '51000');

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Fund VND for exchange admin list',
      })
      .expect(200);

    const quoteResponse = await request(app.getHttpServer())
      .post('/api/v1/exchange/quote')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        amount: '50000',
        fromAssetCode: 'VND',
        toAssetCode: 'USDT',
      })
      .expect(201);

    const quoteId = responseData<EntityWithId>(quoteResponse).id;

    await request(app.getHttpServer())
      .post('/api/v1/exchange/execute')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `admin-exchange-${Date.now()}`)
      .send({
        quoteId,
      })
      .expect(201);

    const todayVietnam = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    await request(app.getHttpServer())
      .get('/api/v1/admin/exchange/orders')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .query({
        date: todayVietnam,
      })
      .expect(200)
      .expect((response) => {
        expect(responseData<AdminExchangeOrderPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              appliedMarkupVnd: 1000,
              feeAmount: '0.02',
              feeAssetCode: 'USDT',
              feeBps: 100,
              feeProfitVnd: '500',
              fromAssetCode: 'VND',
              grossReceiveAmount: '1.92',
              markupProfitVnd: '2000',
              rate: '26000.000000000000',
              realtimeRateVnd: '25000.000000000000',
              requestedAmount: '50000',
              status: 'completed',
              toAmount: '1.90',
              toAssetCode: 'USDT',
              totalDebit: '50000',
              userEmail: email,
              userId: auth.user.id,
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/admin/exchange/orders')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .query({
        date: '2020-01-01',
      })
      .expect(200)
      .expect((response) => {
        expect(responseData<AdminExchangeOrderPayload[]>(response)).toEqual([]);
      });
  });

  it('records USDT withdrawal fee profit snapshots when an admin approves the request', async () => {
    const email = `withdrawal-profit-${Date.now()}@example.com`;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await request(app.getHttpServer())
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        depositReservationTtlMinutes: 15,
        exchangeUsdtToVndFeeBps: 50,
        exchangeUsdtToVndMarkupVnd: 700,
        exchangeVndToUsdtFeeBps: 100,
        exchangeVndToUsdtMarkupVnd: 1000,
        supportLink: 'https://t.me/nganluong_support',
        withdrawalUsdtFeeBps: 125,
        withdrawalVndFeeBps: 1000,
      })
      .expect(200);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
      })
      .expect(201);

    const auth = responseData<AuthPayload>(registerResponse);
    const userAccessToken = auth.accessToken;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${auth.user.id}/add-balance`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        amount: '20',
        assetCode: 'USDT',
      })
      .expect(201);

    const twoFactorKey = await enableTwoFactor(userAccessToken);

    const withdrawalResponse = await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `withdrawal-profit-${Date.now()}`)
      .send({
        assetCode: 'USDT',
        amount: '10',
        method: 'trc20',
        twoFactorCode: generateTotpCode(twoFactorKey),
        destinationDetails: {
          method: 'trc20',
          network: 'TRC20',
          walletAddress: 'TXYZ_PROFIT_123',
        },
      })
      .expect(201);

    const withdrawalId = responseData<EntityWithId>(withdrawalResponse).id;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Approve USDT withdrawal with profit snapshot',
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<UserWithdrawalPayload[]>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              feeAmount: '0.13',
              feeProfitVnd: '3250',
              id: withdrawalId,
              method: 'trc20',
              profitFxRateVnd: '25000',
              status: 'approved',
              totalDebit: '10.00',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/admin/withdrawals?status=approved')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200)
      .expect((response) => {
        expect(responseData<Array<Record<string, unknown>>>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              feeAmount: '0.13',
              feeProfitVnd: '3250',
              id: withdrawalId,
              profitFxRateVnd: '25000',
              status: 'approved',
              totalDebit: '10.00',
              userEmail: email,
            }),
          ]),
        );
      });
  });

  it('quotes VND to USDT from realtime provider price plus markup and fee', async () => {
    pricingFetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            rates: {
              VND: '24000',
            },
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `quote-realtime-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    await request(app.getHttpServer())
      .post('/api/v1/exchange/quote')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        amount: '100000',
        fromAssetCode: 'VND',
        toAssetCode: 'USDT',
      })
      .expect(201)
      .expect((response) => {
        expect(responseData<ExchangeQuotePayload>(response)).toEqual(
          expect.objectContaining({
            feeAmount: '0.04',
            feeAssetCode: 'USDT',
            feeBps: 100,
            fromAssetCode: 'VND',
            grossReceiveAmount: '4.00',
            rate: '25000',
            requestedAmount: '100000',
            roundingMode: 'floor_asset_precision',
            toAmount: '3.96',
            toAssetCode: 'USDT',
            totalDebit: '100000',
          }),
        );
      });
  });

  it('rounds VND exchange fees up so the quote total debit favors the platform', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await request(app.getHttpServer())
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        depositReservationTtlMinutes: 15,
        exchangeUsdtToVndFeeBps: 50,
        exchangeUsdtToVndMarkupVnd: 700,
        exchangeVndToUsdtFeeBps: 125,
        exchangeVndToUsdtMarkupVnd: 1000,
        supportLink: 'https://t.me/nganluong_hotline',
        withdrawalUsdtFeeBps: 125,
        withdrawalVndFeeBps: 1000,
      })
      .expect(200);

    pricingFetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            rates: {
              VND: '24000',
            },
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `quote-vnd-roundup-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    await request(app.getHttpServer())
      .post('/api/v1/exchange/quote')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        amount: '1000',
        fromAssetCode: 'VND',
        toAssetCode: 'USDT',
      })
      .expect(201)
      .expect((response) => {
        expect(responseData<ExchangeQuotePayload>(response)).toEqual(
          expect.objectContaining({
            feeAmount: '0.01',
            feeAssetCode: 'USDT',
            feeBps: 125,
            fromAssetCode: 'VND',
            grossReceiveAmount: '0.04',
            rate: '25000',
            requestedAmount: '1000',
            roundingMode: 'floor_asset_precision',
            toAmount: '0.03',
            toAssetCode: 'USDT',
            totalDebit: '1000',
          }),
        );
      });
  });

  it('rejects exchange directions other than VND to USDT', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `exchange-direction-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    await request(app.getHttpServer())
      .post('/api/v1/exchange/quote')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        amount: '10',
        fromAssetCode: 'VND',
        toAssetCode: 'VND',
      })
      .expect(400)
      .expect((response) => {
        expect(responseError(response).code).toBe(
          'exchange_direction_not_supported',
        );
      });
  });

  it('reserves withdrawal totalDebit instead of only the requested amount and releases the same total on reject', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `withdraw-fee-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit } = await createConfirmedVndDeposit(
      userAccessToken,
      '200000',
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Fund for withdrawal fee test',
      })
      .expect(200);

    const twoFactorKey = await enableTwoFactor(userAccessToken);

    const withdrawalResponse = await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `withdraw-fee-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '100000',
        method: 'bank_transfer',
        twoFactorCode: generateTotpCode(twoFactorKey),
        destinationDetails: {
          accountName: 'NGUYEN VAN B',
          accountNumber: '999999999',
          bankName: 'Vietcombank',
          method: 'bank_transfer',
        },
      })
      .expect(201);

    const createdWithdrawal =
      responseData<UserWithdrawalPayload>(withdrawalResponse);

    expect(createdWithdrawal).toEqual(
      expect.objectContaining({
        amount: '90000',
        assetCode: 'VND',
        feeAmount: '10000',
        totalDebit: '100000',
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/wallets')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        const vndWallet = findWallet(
          responseData<WalletSummary[]>(response),
          'VND',
        );

        expect(vndWallet.balances).toEqual({
          available: '100000',
          pending: '100000',
          total: '200000',
        });
      });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${createdWithdrawal.id}/reject`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Reject to test release',
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/wallets')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        const vndWallet = findWallet(
          responseData<WalletSummary[]>(response),
          'VND',
        );

        expect(vndWallet.balances).toEqual({
          available: '200000',
          pending: '0',
          total: '200000',
        });
      });
  });

  it('rounds VND withdrawal fees up so the reserved gross debit favors the platform', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await request(app.getHttpServer())
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        depositReservationTtlMinutes: 15,
        exchangeUsdtToVndFeeBps: 50,
        exchangeUsdtToVndMarkupVnd: 700,
        exchangeVndToUsdtFeeBps: 100,
        exchangeVndToUsdtMarkupVnd: 1000,
        supportLink: 'https://t.me/nganluong_hotline',
        withdrawalUsdtFeeBps: 125,
        withdrawalVndFeeBps: 125,
      })
      .expect(200);

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `withdraw-vnd-roundup-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit } = await createConfirmedVndDeposit(userAccessToken, '1000');

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'Fund VND withdrawal fee round-up test',
      })
      .expect(200);

    const twoFactorKey = await enableTwoFactor(userAccessToken);

    await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .set('Idempotency-Key', `withdraw-vnd-roundup-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '101',
        method: 'bank_transfer',
        twoFactorCode: generateTotpCode(twoFactorKey),
        destinationDetails: {
          accountName: 'NGUYEN VAN B',
          accountNumber: '999999999',
          bankName: 'Vietcombank',
          method: 'bank_transfer',
        },
      })
      .expect(201)
      .expect((response) => {
        expect(responseData<UserWithdrawalPayload>(response)).toEqual(
          expect.objectContaining({
            amount: '99',
            assetCode: 'VND',
            feeAmount: '2',
            totalDebit: '101',
          }),
        );
      });
  });

  it('rejects zero, negative, and malformed amounts with a 400 response', async () => {
    const email = `invalid-${Date.now()}@example.com`;
    const password = 'Secret123!';

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
      })
      .expect(201);

    const accessToken = responseData<AuthPayload>(registerResponse).accessToken;
    const twoFactorKey = await enableTwoFactor(accessToken);

    await request(app.getHttpServer())
      .post('/api/v1/deposit-reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        assetCode: 'VND',
        amount: '0',
        method: 'bank_transfer',
      })
      .expect(400)
      .expect((response) => {
        expect(responseError(response).message).toBe('Số tiền phải lớn hơn 0.');
      });

    await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', `withdraw-negative-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '-1000',
        method: 'bank_transfer',
        twoFactorCode: generateTotpCode(twoFactorKey),
      })
      .expect(400)
      .expect((response) => {
        expect(responseError(response).message).toBe('Số tiền phải lớn hơn 0.');
      });

    await request(app.getHttpServer())
      .post('/api/v1/exchange/quote')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fromAssetCode: 'VND',
        toAssetCode: 'USDT',
        amount: 'abc',
      })
      .expect(400)
      .expect((response) => {
        expect(responseError(response).message).toBe('Số tiền không hợp lệ.');
      });
  });

  it('allows only one successful approval for the same deposit under parallel requests', async () => {
    const userEmail = `parallel-deposit-${Date.now()}@example.com`;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: userEmail,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit } = await createConfirmedVndDeposit(
      userAccessToken,
      '100000',
    );

    const depositId = deposit.id;

    const [firstApproval, secondApproval] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/admin/deposits/${depositId}/approve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          note: 'parallel approval 1',
        }),
      request(app.getHttpServer())
        .post(`/api/v1/admin/deposits/${depositId}/approve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          note: 'parallel approval 2',
        }),
    ]);

    const statuses = [firstApproval.status, secondApproval.status].sort();
    expect(statuses).toEqual([200, 409]);

    await request(app.getHttpServer())
      .get('/api/v1/wallets')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        const vndWallet = findWallet(
          responseData<WalletSummary[]>(response),
          'VND',
        );

        expect(vndWallet.balances).toEqual({
          available: '100000',
          pending: '0',
          total: '100000',
        });
      });
  });

  it('allows only one successful execution for the same quote under parallel requests', async () => {
    const userEmail = `parallel-exchange-${Date.now()}@example.com`;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await createBankAccount(adminAccessToken);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: userEmail,
        password: 'Secret123!',
      })
      .expect(201);

    const userAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit } = await createConfirmedVndDeposit(
      userAccessToken,
      '100000',
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${deposit.id}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        note: 'fund wallet for exchange race test',
      })
      .expect(200);

    const quoteResponse = await request(app.getHttpServer())
      .post('/api/v1/exchange/quote')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        fromAssetCode: 'VND',
        toAssetCode: 'USDT',
        amount: '50000',
      })
      .expect(201);

    const quoteId = responseData<EntityWithId>(quoteResponse).id;

    const [firstExecution, secondExecution] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/exchange/execute')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .set('Idempotency-Key', `parallel-execute-1-${Date.now()}`)
        .send({
          quoteId,
        }),
      request(app.getHttpServer())
        .post('/api/v1/exchange/execute')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .set('Idempotency-Key', `parallel-execute-2-${Date.now()}`)
        .send({
          quoteId,
        }),
    ]);

    const statuses = [firstExecution.status, secondExecution.status].sort();
    expect(statuses).toEqual([201, 409]);

    await request(app.getHttpServer())
      .get('/api/v1/wallets')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(200)
      .expect((response) => {
        const wallets = responseData<WalletSummary[]>(response);
        const vndWallet = findWallet(wallets, 'VND');
        const usdtWallet = findWallet(wallets, 'USDT');

        expect(vndWallet.balances).toEqual({
          available: '50000',
          pending: '0',
          total: '50000',
        });
        expect(usdtWallet.balances.available).toBe('1.90');
      });
  });

  it('lets super admin manage user profile, password, roles, and balances', async () => {
    const superAdminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const superAdminAccessToken =
      responseData<AuthPayload>(superAdminLogin).accessToken;

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `managed-user-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const managedUser = responseData<AuthPayload>(registerResponse).user;

    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .query({
        search: 'managed-user',
      })
      .expect(200)
      .expect((response) => {
        expect(responseData<Array<Record<string, unknown>>>(response)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              createdAt: expect.any(String) as string,
              email: managedUser.email,
              id: managedUser.id,
              phone: null,
              roles: ['user'],
              telegram: null,
              balances: {
                vnd: {
                  available: '0',
                  pending: '0',
                  total: '0',
                },
                usdt: {
                  available: '0.00',
                  pending: '0.00',
                  total: '0.00',
                },
              },
            }),
          ]),
        );
      });

    const updatedEmail = `updated-managed-${Date.now()}@example.com`;

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${managedUser.id}/profile`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .send({
        email: updatedEmail,
        phone: '0901234567',
        telegram: '@managed_user',
      })
      .expect(200)
      .expect((response) => {
        expect(responseData<Record<string, unknown>>(response)).toEqual(
          expect.objectContaining({
            email: updatedEmail,
            phone: '0901234567',
            telegram: 'managed_user',
          }),
        );
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${managedUser.id}/password`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .send({
        newPassword: 'Changed123!',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: updatedEmail,
        password: 'Changed123!',
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${managedUser.id}/roles`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .send({
        roles: ['user', 'admin'],
      })
      .expect(200)
      .expect((response) => {
        const managedSummary = responseData<Record<string, unknown>>(response);

        expect(managedSummary).toEqual(
          expect.objectContaining({
            email: updatedEmail,
          }),
        );
        expect(managedSummary.roles).toEqual(
          expect.arrayContaining(['user', 'admin']),
        );
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${managedUser.id}/balances`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .send({
        usdt: '3.50',
        vnd: '150000',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${managedUser.id}/add-balance`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .send({
        amount: '25000',
        assetCode: 'VND',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${managedUser.id}/add-balance`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .send({
        amount: '1.50',
        assetCode: 'USDT',
      })
      .expect(201);

    await createBankAccount(superAdminAccessToken, {
      accountName: 'MANAGED USER FUNDING',
      accountNumber: `7000${Date.now()}`,
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '1000000',
      priority: 1,
    });

    const managedUserRegistrationAccessToken =
      responseData<AuthPayload>(registerResponse).accessToken;

    const { deposit: fundingDeposit } = await createConfirmedVndDeposit(
      managedUserRegistrationAccessToken,
      '100000',
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/deposits/${fundingDeposit.id}/approve`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .send({
        note: 'Seed VND for withdrawal total test',
      })
      .expect(200);

    const twoFactorKey = await enableTwoFactor(
      managedUserRegistrationAccessToken,
    );

    const withdrawalResponse = await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Authorization', `Bearer ${managedUserRegistrationAccessToken}`)
      .set('Idempotency-Key', `managed-withdrawal-${Date.now()}`)
      .send({
        assetCode: 'VND',
        amount: '100000',
        method: 'bank_transfer',
        twoFactorCode: generateTotpCode(twoFactorKey),
        destinationDetails: {
          accountName: 'Managed User',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
        },
      })
      .expect(201);

    const managedWithdrawalId =
      responseData<EntityWithId>(withdrawalResponse).id;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${managedWithdrawalId}/approve`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .send({
        note: 'Approved for total debit semantics',
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .query({
        search: 'updated-managed',
      })
      .expect(200)
      .expect((response) => {
        const users = responseData<
          Array<{
            balances: {
              usdt: {
                available: string;
                pending: string;
                total: string;
              };
              vnd: {
                available: string;
                pending: string;
                total: string;
              };
            };
            email: string;
            id: string;
            phone: string | null;
            roles: string[];
            telegram: string | null;
            totals: {
              totalWithdrawVnd: string;
            };
          }>
        >(response);
        const updatedUser = users.find((item) => item.id === managedUser.id);

        expect(updatedUser).toEqual(
          expect.objectContaining({
            balances: {
              vnd: {
                available: '175000',
                pending: '0',
                total: '175000',
              },
              usdt: {
                available: '5.00',
                pending: '0.00',
                total: '5.00',
              },
            },
            email: updatedEmail,
            id: managedUser.id,
            phone: '0901234567',
            telegram: 'managed_user',
          }),
        );
        expect(updatedUser?.totals.totalWithdrawVnd).toBe('100000');
        expect(updatedUser?.roles).toEqual(
          expect.arrayContaining(['user', 'admin']),
        );
      });

    const managedUserLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: updatedEmail,
        password: 'Changed123!',
      })
      .expect(200);

    const managedUserAccessToken =
      responseData<AuthPayload>(managedUserLogin).accessToken;

    await request(app.getHttpServer())
      .get('/api/v1/wallets/VND/ledger')
      .set('Authorization', `Bearer ${managedUserAccessToken}`)
      .expect(200)
      .expect((ledgerResponse) => {
        const ledgerEntries =
          responseData<LedgerPayload>(ledgerResponse).entries;
        const adminAdjustEntry = ledgerEntries.find(
          (entry) => entry.referenceType === 'admin_adjust',
        );

        expect(adminAdjustEntry).toEqual(
          expect.objectContaining({
            referenceType: 'admin_adjust',
          }),
        );
        expect(adminAdjustEntry?.note).toEqual(
          expect.stringContaining('Admin'),
        );
      });
  });

  it('rejects duplicate admin email updates and restricts role changes to super admin only', async () => {
    const superAdminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@example.com',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const superAdminAccessToken =
      responseData<AuthPayload>(superAdminLogin).accessToken;

    const existingUserResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `existing-user-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const promotedAdminResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `admin-user-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const targetUserResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `target-user-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const existingUser = responseData<AuthPayload>(existingUserResponse).user;
    const promotedAdmin = responseData<AuthPayload>(promotedAdminResponse).user;
    const targetUser = responseData<AuthPayload>(targetUserResponse).user;

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${targetUser.id}/profile`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .send({
        email: existingUser.email,
      })
      .expect(409)
      .expect((response) => {
        expect(responseError(response).code).toBe('email_already_exists');
        expect(responseError(response).message).toBe(
          'Email này đã được sử dụng.',
        );
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${promotedAdmin.id}/roles`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .send({
        roles: ['user', 'admin'],
      })
      .expect(200);

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: promotedAdmin.email,
        password: 'Secret123!',
      })
      .expect(200);

    const adminAccessToken = responseData<AuthPayload>(adminLogin).accessToken;

    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${targetUser.id}/roles`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        roles: ['user', 'admin'],
      })
      .expect(403);

    const nonAdminRegisterResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `non-admin-${Date.now()}@example.com`,
        password: 'Secret123!',
      })
      .expect(201);

    const nonAdminAccessToken = responseData<AuthPayload>(
      nonAdminRegisterResponse,
    ).accessToken;

    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${nonAdminAccessToken}`)
      .expect(403);
  });
});
