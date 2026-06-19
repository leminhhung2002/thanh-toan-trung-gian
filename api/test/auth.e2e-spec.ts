import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/platform/http/configure-app';
import { AuthPayload, responseData } from './test-helpers';
import { ensureTestDatabase } from './test-database';

describe('Auth flows (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    await ensureTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers a user and returns tokens plus seeded wallets', async () => {
    const email = `alice-${Date.now()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
        phone: '0123456789',
      })
      .expect(201);

    const payload = responseData<AuthPayload>(response);

    expect(typeof payload.accessToken).toBe('string');
    expect(typeof payload.refreshToken).toBe('string');
    expect(payload.user.email).toBe(email);
    expect(typeof payload.user.id).toBe('string');
    expect(payload.user.roles).toEqual(['user']);
    expect(payload.wallets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetCode: 'USDT' }),
        expect.objectContaining({ assetCode: 'VND' }),
      ]),
    );
  });

  it('refresh rotates the refresh token and invalidates the old one', async () => {
    const email = `rotate-${Date.now()}@example.com`;
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
      })
      .expect(201);

    const registerPayload = responseData<AuthPayload>(registerResponse);
    const firstRefreshToken = registerPayload.refreshToken;

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: firstRefreshToken,
      })
      .expect(200);

    const refreshPayload =
      responseData<Pick<AuthPayload, 'accessToken' | 'refreshToken'>>(
        refreshResponse,
      );

    expect(typeof refreshPayload.accessToken).toBe('string');
    expect(typeof refreshPayload.refreshToken).toBe('string');

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: firstRefreshToken,
      })
      .expect(401);
  });
});
