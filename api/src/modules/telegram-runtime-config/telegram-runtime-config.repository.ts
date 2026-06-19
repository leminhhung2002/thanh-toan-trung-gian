import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../platform/database/database.service';
import { telegramRuntimeConfigs } from '../../platform/database/schema';

export type TelegramRuntimeConfigRecord =
  typeof telegramRuntimeConfigs.$inferSelect;

export interface TelegramRuntimeConfigRepository {
  getActive(): Promise<TelegramRuntimeConfigRecord | null>;
  upsertActive(input: {
    botUsername: string | null;
    chatId: string;
    tokenEncrypted: string;
    tokenSuffix: string;
    updatedBy: string;
    version: number;
  }): Promise<TelegramRuntimeConfigRecord>;
}

const ACTIVE_TELEGRAM_RUNTIME_CONFIG_ID = 'active';

@Injectable()
export class DrizzleTelegramRuntimeConfigRepository
  implements TelegramRuntimeConfigRepository
{
  constructor(private readonly databaseService: DatabaseService) {}

  async getActive() {
    const [record] = await this.databaseService.db
      .select()
      .from(telegramRuntimeConfigs)
      .where(eq(telegramRuntimeConfigs.id, ACTIVE_TELEGRAM_RUNTIME_CONFIG_ID));

    return record ?? null;
  }

  async upsertActive(input: {
    botUsername: string | null;
    chatId: string;
    tokenEncrypted: string;
    tokenSuffix: string;
    updatedBy: string;
    version: number;
  }) {
    const existing = await this.getActive();

    if (existing) {
      await this.databaseService.db
        .update(telegramRuntimeConfigs)
        .set({
          botUsername: input.botUsername,
          chatId: input.chatId,
          lastValidatedAt: new Date(),
          tokenEncrypted: input.tokenEncrypted,
          tokenSuffix: input.tokenSuffix,
          updatedBy: input.updatedBy,
          version: input.version,
        })
        .where(eq(telegramRuntimeConfigs.id, ACTIVE_TELEGRAM_RUNTIME_CONFIG_ID));
    } else {
      await this.databaseService.db.insert(telegramRuntimeConfigs).values({
        botUsername: input.botUsername,
        chatId: input.chatId,
        id: ACTIVE_TELEGRAM_RUNTIME_CONFIG_ID,
        lastValidatedAt: new Date(),
        tokenEncrypted: input.tokenEncrypted,
        tokenSuffix: input.tokenSuffix,
        updatedBy: input.updatedBy,
        version: input.version,
      });
    }

    const record = await this.getActive();
    if (!record) {
      throw new Error('Failed to persist Telegram runtime config');
    }

    return record;
  }
}
