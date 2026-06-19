import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { schema } from './schema';
import { AppDatabase } from './database.types';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: mysql.Pool;
  db!: AppDatabase;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.pool = mysql.createPool({
      host: this.configService.getOrThrow<string>('DATABASE_HOST'),
      port: this.configService.getOrThrow<number>('DATABASE_PORT'),
      user: this.configService.getOrThrow<string>('DATABASE_USER'),
      password: this.configService.getOrThrow<string>('DATABASE_PASSWORD'),
      database: this.configService.getOrThrow<string>('DATABASE_NAME'),
      connectionLimit: this.configService.get<number>(
        'DATABASE_CONNECTION_LIMIT',
        10,
      ),
      namedPlaceholders: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
    });

    this.db = drizzle(this.pool, { schema, mode: 'default' });
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async ping() {
    await this.pool.query('SELECT 1');
  }
}
