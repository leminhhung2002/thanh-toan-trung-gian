import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from '../src/platform/http/configure-app';
import { responseError } from './test-helpers';
import { ensureTestDatabase } from './test-database';

describe('Platform bootstrap (e2e)', () => {
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

  it('GET /api/v1/health returns the standard success envelope', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({
        data: {
          service: 'api',
          status: 'ok',
        },
      });
  });

  it('GET /missing returns the standard error envelope', () => {
    return request(app.getHttpServer())
      .get('/api/v1/missing')
      .expect(404)
      .expect((response) => {
        const error = responseError(response);

        expect(error.code).toBe('not_found');
        expect(error.details).toBeNull();
        expect(error.message).toBe('Không tìm thấy đường dẫn yêu cầu.');
        expect(typeof error.requestId).toBe('string');
      });
  });

  it('responds to auth preflight requests for the client origin', () => {
    return request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization')
      .expect(204)
      .expect((response) => {
        expect(response.headers['access-control-allow-origin']).toBe(
          'http://localhost:5173',
        );
        expect(response.headers['access-control-allow-methods']).toContain(
          'POST',
        );
        expect(response.headers['access-control-allow-headers']).toContain(
          'content-type',
        );
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
