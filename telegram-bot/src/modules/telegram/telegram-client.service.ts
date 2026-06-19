import { Injectable } from '@nestjs/common';
import { GrammyError, HttpError } from 'grammy';
import { TelegramApiClientFactory } from './telegram-api-client.factory';
import {
  TelegramRuntimeConfigUnavailableError,
} from './telegram-runtime-config.service';
import {
  TelegramGateway,
  TelegramGatewayError,
  type TelegramSendMessageOptions,
} from './telegram-gateway';
import { TelegramRuntimeConfigService } from './telegram-runtime-config.service';

@Injectable()
export class TelegramClientService extends TelegramGateway {
  constructor(
    private readonly runtimeConfigService: TelegramRuntimeConfigService,
    private readonly apiClientFactory: TelegramApiClientFactory,
  ) {
    super();
  }

  async sendMessage(text: string, options?: TelegramSendMessageOptions) {
    const config = this.runtimeConfigService.getActiveConfigOrThrow();
    const client = this.apiClientFactory.getClient(config);

    try {
      await client.sendMessage(
        config.chatId,
        text,
        options?.parseMode
          ? {
              parse_mode: options.parseMode,
            }
          : undefined,
      );
    } catch (error) {
      throw normalizeTelegramError(error);
    }
  }
}

function normalizeTelegramError(error: unknown) {
  if (error instanceof TelegramRuntimeConfigUnavailableError) {
    return error;
  }

  if (error instanceof TelegramGatewayError) {
    return error;
  }

  if (error instanceof GrammyError) {
    return new TelegramGatewayError(
      `Telegram sendMessage failed: ${error.error_code} ${error.description}`,
      error,
    );
  }

  if (error instanceof HttpError) {
    return new TelegramGatewayError(
      `Telegram sendMessage failed: ${error.message}`,
      error,
    );
  }

  if (error instanceof Error) {
    return new TelegramGatewayError(
      `Telegram sendMessage failed: ${error.message}`,
      error,
    );
  }

  return new TelegramGatewayError('Telegram sendMessage failed: Unknown error', error);
}
