import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../platform/database/database.service';
import type { AppTransaction } from '../../platform/database/database.types';
import {
  userNotifications,
  userNotificationStates,
} from '../../platform/database/schema';

export type UserNotificationRecord = typeof userNotifications.$inferSelect;

export type CreateUserNotificationInput = {
  createdAt?: Date;
  primaryAmount: string;
  primaryAmountTone: 'minus' | 'neutral' | 'plus';
  primaryAssetCode: string;
  referenceId: string;
  referenceType: string;
  secondaryText: string;
  title: string;
  type: string;
  userId: string;
};

export interface UserNotificationsRepository {
  countUnreadForUser(userId: string): Promise<number>;
  findLatestCreatedAtForUser(userId: string): Promise<Date | null>;
  listForUser(userId: string, limit: number): Promise<UserNotificationRecord[]>;
  markAllRead(userId: string, readAt: Date): Promise<void>;
  save(input: CreateUserNotificationInput): Promise<void>;
  saveWithTransaction(
    tx: AppTransaction,
    input: CreateUserNotificationInput,
  ): Promise<void>;
}

@Injectable()
export class DrizzleUserNotificationsRepository
  implements UserNotificationsRepository
{
  constructor(private readonly databaseService: DatabaseService) {}

  async countUnreadForUser(userId: string) {
    const [state] = await this.databaseService.db
      .select({
        lastReadAt: userNotificationStates.lastReadAt,
      })
      .from(userNotificationStates)
      .where(eq(userNotificationStates.userId, userId))
      .limit(1);

    const [result] = await this.databaseService.db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(userNotifications)
      .where(
        state?.lastReadAt
          ? and(
              eq(userNotifications.userId, userId),
              gt(userNotifications.createdAt, state.lastReadAt),
            )
          : eq(userNotifications.userId, userId),
      );

    return Number(result?.count ?? 0);
  }

  async findLatestCreatedAtForUser(userId: string) {
    const [record] = await this.databaseService.db
      .select({
        createdAt: userNotifications.createdAt,
      })
      .from(userNotifications)
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt), desc(userNotifications.id))
      .limit(1);

    return record?.createdAt ?? null;
  }

  listForUser(userId: string, limit: number) {
    return this.databaseService.db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt), desc(userNotifications.id))
      .limit(limit);
  }

  async markAllRead(userId: string, readAt: Date) {
    await this.databaseService.db
      .insert(userNotificationStates)
      .values({
        lastReadAt: readAt,
        userId,
      })
      .onDuplicateKeyUpdate({
        set: {
          lastReadAt: readAt,
          updatedAt: new Date(),
        },
      });
  }

  async save(input: CreateUserNotificationInput) {
    await this.databaseService.db.insert(userNotifications).values({
      createdAt: input.createdAt ?? new Date(),
      id: randomUUID(),
      primaryAmount: input.primaryAmount,
      primaryAmountTone: input.primaryAmountTone,
      primaryAssetCode: input.primaryAssetCode,
      referenceId: input.referenceId,
      referenceType: input.referenceType,
      secondaryText: input.secondaryText,
      title: input.title,
      type: input.type,
      userId: input.userId,
    });
  }

  async saveWithTransaction(
    tx: AppTransaction,
    input: CreateUserNotificationInput,
  ) {
    await tx.insert(userNotifications).values({
      createdAt: input.createdAt ?? new Date(),
      id: randomUUID(),
      primaryAmount: input.primaryAmount,
      primaryAmountTone: input.primaryAmountTone,
      primaryAssetCode: input.primaryAssetCode,
      referenceId: input.referenceId,
      referenceType: input.referenceType,
      secondaryText: input.secondaryText,
      title: input.title,
      type: input.type,
      userId: input.userId,
    });
  }
}
