import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createCipheriv, randomBytes } from 'crypto';
import { TelegramRuntimeConfigService } from './telegram-runtime-config.service';
import type { AuditService } from '../audit/audit.service';
import type {
  TelegramRuntimeConfigRecord,
  TelegramRuntimeConfigRepository,
} from './telegram-runtime-config.repository';
import type { TelegramConfigValidationGateway } from './telegram-config-validation.gateway';
import type { TelegramRuntimeConfigSignalPublisher } from './telegram-runtime-config-signal.publisher';

function buildRecord(
  overrides: Partial<TelegramRuntimeConfigRecord> = {},
): TelegramRuntimeConfigRecord {
  return {
    botUsername: 'nganluong_bot',
    chatId: '-1001234567890',
    createdAt: new Date('2026-04-09T03:00:00.000Z'),
    id: 'active',
    lastValidatedAt: new Date('2026-04-09T03:00:00.000Z'),
    tokenEncrypted: 'encrypted-token',
    tokenSuffix: 'CDEF',
    updatedAt: new Date('2026-04-09T03:00:00.000Z'),
    updatedBy: 'admin-1',
    version: 3,
    ...overrides,
  };
}

function encryptForTest(value: string) {
  const key = Buffer.from(
    Buffer.from('0123456789abcdef0123456789abcdef', 'utf8').toString('base64'),
    'base64',
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

describe('TelegramRuntimeConfigService', () => {
  const repository: jest.Mocked<TelegramRuntimeConfigRepository> = {
    getActive: jest.fn(),
    upsertActive: jest.fn(),
  };
  const validationGateway: jest.Mocked<TelegramConfigValidationGateway> = {
    validate: jest.fn(),
  } as unknown as jest.Mocked<TelegramConfigValidationGateway>;
  const signalPublisher: jest.Mocked<TelegramRuntimeConfigSignalPublisher> = {
    publishUpdated: jest.fn(),
  } as unknown as jest.Mocked<TelegramRuntimeConfigSignalPublisher>;
  const auditService: jest.Mocked<AuditService> = {
    log: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;
  const configService = {
    getOrThrow: jest.fn(),
  } as unknown as jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.resetAllMocks();
    configService.getOrThrow.mockReturnValue(
      Buffer.from('0123456789abcdef0123456789abcdef', 'utf8').toString('base64'),
    );
  });

  it('creates and returns a masked runtime config summary after validating a new token', async () => {
    repository.getActive.mockResolvedValue(null);
    validationGateway.validate.mockResolvedValue({
      botUsername: 'nganluong_bot',
    });
    repository.upsertActive.mockImplementation(async (input) =>
      buildRecord({
        botUsername: input.botUsername,
        chatId: input.chatId,
        tokenEncrypted: input.tokenEncrypted,
        tokenSuffix: input.tokenSuffix,
        updatedBy: input.updatedBy,
        version: input.version,
      }),
    );

    const service = new TelegramRuntimeConfigService(
      auditService,
      configService,
      repository,
      signalPublisher,
      validationGateway,
    );

    const result = await service.updateActive('admin-1', {
      chatId: '-100999000111',
      token: '123456:ABCDEF',
    });

    expect(validationGateway.validate).toHaveBeenCalledWith({
      chatId: '-100999000111',
      token: '123456:ABCDEF',
    });
    expect(repository.upsertActive).toHaveBeenCalledWith(
      expect.objectContaining({
        botUsername: 'nganluong_bot',
        chatId: '-100999000111',
        tokenEncrypted: expect.not.stringContaining('123456:ABCDEF'),
        tokenSuffix: 'CDEF',
        updatedBy: 'admin-1',
        version: 1,
      }),
    );
    expect(signalPublisher.publishUpdated).toHaveBeenCalledWith({
      updatedAt: expect.any(Date),
      version: 1,
    });
    expect(result).toEqual({
      botUsername: 'nganluong_bot',
      chatId: '-100999000111',
      configured: true,
      lastValidatedAt: expect.any(Date),
      tokenSuffix: 'CDEF',
      updatedAt: expect.any(Date),
      version: 1,
    });
  });

  it('reuses the existing token when only the chat id changes', async () => {
    repository.getActive.mockResolvedValue(
      buildRecord({
        tokenEncrypted: encryptForTest('existing-token'),
      }),
    );
    validationGateway.validate.mockResolvedValue({
      botUsername: 'nganluong_rotated_bot',
    });
    repository.upsertActive.mockImplementation(async (input) =>
      buildRecord({
        botUsername: input.botUsername,
        chatId: input.chatId,
        tokenEncrypted: input.tokenEncrypted,
        tokenSuffix: input.tokenSuffix,
        updatedBy: input.updatedBy,
        version: input.version,
      }),
    );

    const service = new TelegramRuntimeConfigService(
      auditService,
      configService,
      repository,
      signalPublisher,
      validationGateway,
    );

    const result = await service.updateActive('admin-2', {
      chatId: '-100222333444',
      token: '   ',
    });

    expect(validationGateway.validate).toHaveBeenCalledWith({
      chatId: '-100222333444',
      token: 'existing-token',
    });
    expect(repository.upsertActive).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: '-100222333444',
        tokenSuffix: 'oken',
        updatedBy: 'admin-2',
        version: 4,
      }),
    );
    expect(result.version).toBe(4);
    expect(result.botUsername).toBe('nganluong_rotated_bot');
  });

  it('rejects write-only updates when there is no existing token to keep', async () => {
    repository.getActive.mockResolvedValue(null);

    const service = new TelegramRuntimeConfigService(
      auditService,
      configService,
      repository,
      signalPublisher,
      validationGateway,
    );

    await expect(
      service.updateActive('admin-1', {
        chatId: '-100111222333',
        token: '   ',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(validationGateway.validate).not.toHaveBeenCalled();
    expect(repository.upsertActive).not.toHaveBeenCalled();
  });

  it('does not update the stored config when Telegram validation fails', async () => {
    repository.getActive.mockResolvedValue(buildRecord());
    validationGateway.validate.mockRejectedValue(new Error('telegram invalid'));

    const service = new TelegramRuntimeConfigService(
      auditService,
      configService,
      repository,
      signalPublisher,
      validationGateway,
    );

    await expect(
      service.updateActive('admin-1', {
        chatId: '-100111222333',
        token: 'new-token',
      }),
    ).rejects.toThrow('telegram invalid');

    expect(repository.upsertActive).not.toHaveBeenCalled();
    expect(signalPublisher.publishUpdated).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
