jest.mock('mysql2/promise', () => ({
  __esModule: true,
  default: {
    createConnection: jest.fn(),
  },
}));

jest.mock('drizzle-orm/mysql2/migrator', () => ({
  migrate: jest.fn(),
}));

import mysql from 'mysql2/promise';
import { resetDatabase, runMigrations } from './migrate';

describe('migrate script safeguards', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      DATABASE_HOST: '127.0.0.1',
      DATABASE_NAME: 'nganluong_api',
      DATABASE_PASSWORD: 'nganluong',
      DATABASE_PORT: '3307',
      DATABASE_USER: 'nganluong',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects resets in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DB_RESET;

    await expect(resetDatabase()).rejects.toThrow(
      'db:reset is disabled in production and staging environments.',
    );
    expect(mysql.createConnection).not.toHaveBeenCalled();
  });

  it('rejects resets in staging', async () => {
    process.env.NODE_ENV = 'staging';
    delete process.env.ALLOW_DB_RESET;

    await expect(resetDatabase()).rejects.toThrow(
      'db:reset is disabled in production and staging environments.',
    );
    expect(mysql.createConnection).not.toHaveBeenCalled();
  });

  it('rejects manual resets without an explicit allow flag', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_DB_RESET;

    await expect(resetDatabase()).rejects.toThrow(
      'db:reset requires ALLOW_DB_RESET=true.',
    );
    expect(mysql.createConnection).not.toHaveBeenCalled();
  });

  it('rejects manual resets for databases that are not clearly local or test databases', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_DB_RESET = 'true';

    await expect(resetDatabase()).rejects.toThrow(
      'db:reset is only allowed for databases ending in _local or _test.',
    );
    expect(mysql.createConnection).not.toHaveBeenCalled();
  });

  it('allows resets when the environment is safe and explicitly enabled', async () => {
    const query = jest.fn();
    const end = jest.fn();

    process.env.NODE_ENV = 'development';
    process.env.ALLOW_DB_RESET = 'true';
    process.env.DATABASE_NAME = 'nganluong_api_local';

    (mysql.createConnection as jest.Mock).mockResolvedValue({
      end,
      query,
    });

    await resetDatabase();

    expect(mysql.createConnection).toHaveBeenCalledWith({
      host: '127.0.0.1',
      password: 'nganluong',
      port: 3307,
      user: 'nganluong',
    });
    expect(query).toHaveBeenNthCalledWith(
      1,
      'DROP DATABASE IF EXISTS `nganluong_api_local`',
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      'CREATE DATABASE `nganluong_api_local`',
    );
    expect(end).toHaveBeenCalled();
  });

  it('still runs migrations without requiring reset permissions', async () => {
    const end = jest.fn();

    (mysql.createConnection as jest.Mock).mockResolvedValue({
      end,
    });

    await runMigrations();

    expect(mysql.createConnection).toHaveBeenCalledWith({
      database: 'nganluong_api',
      host: '127.0.0.1',
      password: 'nganluong',
      port: 3307,
      user: 'nganluong',
    });
    expect(end).toHaveBeenCalled();
  });
});
