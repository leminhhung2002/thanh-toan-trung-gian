import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../platform/database/database.service';
import { idempotencyKeys } from '../../platform/database/schema';

@Injectable()
export class IdempotencyService {
  constructor(private readonly databaseService: DatabaseService) {}

  async claim(actorId: string, scope: string, key: string) {
    try {
      await this.databaseService.db.insert(idempotencyKeys).values({
        id: randomUUID(),
        actorId,
        scope,
        keyName: key,
      });
    } catch (error) {
      const databaseError =
        typeof error === 'object' && error !== null
          ? (error as { code?: unknown })
          : null;

      if (databaseError !== null && databaseError.code === 'ER_DUP_ENTRY') {
        throw new ConflictException({
          code: 'duplicate_idempotency_key',
          message: 'Idempotency-Key này đã được sử dụng.',
        });
      }

      throw error;
    }
  }
}
