import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/platform/http/configure-app';
import { AuthPayload, ProfilePayload, responseData } from './test-helpers';
import { ensureTestDatabase } from './test-database';

describe('Profile flows (e2e)', () => {
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

  it('gets and updates profile, then changes password', async () => {
    const email = `profile-${Date.now()}@example.com`;
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Secret123!',
      })
      .expect(201);

    const registerPayload = responseData<AuthPayload>(registerResponse);
    const accessToken = registerPayload.accessToken;

    await request(app.getHttpServer())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        const profile = responseData<ProfilePayload>(response);

        expect(profile.email).toBe(email);
        expect(typeof profile.id).toBe('string');
        expect(profile.phone).toBeNull();
        expect(profile.roles).toEqual(['user']);
        expect(profile.telegram).toBeNull();
      });

    await request(app.getHttpServer())
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        phone: '0987654321',
        telegram: 'alice_telegram',
      })
      .expect(200)
      .expect((response) => {
        const profile = responseData<ProfilePayload>(response);

        expect(profile.phone).toBe('0987654321');
        expect(profile.telegram).toBe('alice_telegram');
      });

    await request(app.getHttpServer())
      .post('/api/v1/profile/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'Secret123!',
        newPassword: 'NewSecret123!',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password: 'NewSecret123!',
      })
      .expect(200);
  });
});
