import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import type { TelegramRuntimeConfigRepository } from './telegram-runtime-config.repository';
import { TelegramRuntimeConfigSignalPublisher } from './telegram-runtime-config-signal.publisher';
import { TelegramConfigValidationGateway } from './telegram-config-validation.gateway';

@Injectable()
export class TelegramRuntimeConfigService {
  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    @Inject('TelegramRuntimeConfigRepository')
    private readonly repository: TelegramRuntimeConfigRepository,
    private readonly signalPublisher: TelegramRuntimeConfigSignalPublisher,
    private readonly validationGateway: TelegramConfigValidationGateway,
  ) {}

  async getAdminSummary() {
    const record = await this.repository.getActive();

    if (!record) {
      return {
        botUsername: null,
        chatId: '',
        configured: false,
        lastValidatedAt: null,
        tokenSuffix: null,
        updatedAt: null,
        version: null,
      };
    }

    return {
      botUsername: record.botUsername,
      chatId: record.chatId,
      configured: true,
      lastValidatedAt: record.lastValidatedAt,
      tokenSuffix: record.tokenSuffix,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  async updateActive(
    adminUserId: string,
    input: {
      chatId: string;
      token?: string;
    },
  ) {
    const existing = await this.repository.getActive();
    const nextToken = input.token?.trim()
      ? input.token.trim()
      : existing
        ? this.decrypt(existing.tokenEncrypted)
        : '';

    if (!nextToken) {
      throw new BadRequestException({
        code: 'telegram_runtime_token_required',
        message: 'Bạn cần nhập token Telegram cho lần cấu hình đầu tiên.',
      });
    }

    const validated = await this.validationGateway.validate({
      chatId: input.chatId,
      token: nextToken,
    });
    const persisted = await this.repository.upsertActive({
      botUsername: validated.botUsername,
      chatId: input.chatId,
      tokenEncrypted: this.encrypt(nextToken),
      tokenSuffix: nextToken.slice(-4),
      updatedBy: adminUserId,
      version: existing ? existing.version + 1 : 1,
    });

    await this.auditService.log({
      action: 'telegram-runtime-config.updated',
      actorUserId: adminUserId,
      entityId: persisted.id,
      entityType: 'telegram_runtime_config',
      metadata: {
        botUsername: persisted.botUsername,
        chatId: persisted.chatId,
        version: persisted.version,
      },
    });
    await this.signalPublisher.publishUpdated({
      updatedAt: persisted.updatedAt,
      version: persisted.version,
    });

    return {
      botUsername: persisted.botUsername,
      chatId: persisted.chatId,
      configured: true,
      lastValidatedAt: persisted.lastValidatedAt,
      tokenSuffix: persisted.tokenSuffix,
      updatedAt: persisted.updatedAt,
      version: persisted.version,
    };
  }

  async getInternalRuntimeConfig() {
    const record = await this.repository.getActive();

    if (!record) {
      throw new NotFoundException({
        code: 'telegram_runtime_config_not_found',
        message: 'Telegram runtime config chưa được cấu hình.',
      });
    }

    return {
      chatId: record.chatId,
      token: this.decrypt(record.tokenEncrypted),
      version: record.version,
    };
  }

  private getEncryptionKey() {
    return Buffer.from(
      this.configService.getOrThrow<string>(
        'TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY',
      ),
      'base64',
    );
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  private decrypt(payload: string) {
    const [ivEncoded, tagEncoded, encryptedEncoded] = payload.split('.');

    if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
      throw new Error('Invalid encrypted Telegram runtime config payload');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(ivEncoded, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
