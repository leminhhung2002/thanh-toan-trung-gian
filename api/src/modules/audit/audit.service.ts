import { Injectable } from '@nestjs/common';
import { desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../platform/database/database.service';
import {
  AppDatabase,
  AppTransaction,
} from '../../platform/database/database.types';
import { auditLogs } from '../../platform/database/schema';

type AuditExecutor = AppDatabase | AppTransaction;

@Injectable()
export class AuditService {
  constructor(private readonly databaseService: DatabaseService) {}

  async log(input: {
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown> | null;
  }) {
    await this.insert(this.databaseService.db, input);
  }

  async logWithTransaction(
    tx: AppTransaction,
    input: {
      actorUserId?: string | null;
      action: string;
      entityType: string;
      entityId: string;
      metadata?: Record<string, unknown> | null;
    },
  ) {
    await this.insert(tx, input);
  }

  async list() {
    return this.databaseService.db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt));
  }

  private async insert(
    executor: AuditExecutor,
    input: {
      actorUserId?: string | null;
      action: string;
      entityType: string;
      entityId: string;
      metadata?: Record<string, unknown> | null;
    },
  ) {
    await executor.insert(auditLogs).values({
      id: randomUUID(),
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? null,
    });
  }
}
