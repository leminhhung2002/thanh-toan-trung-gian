import { BadRequestException, Injectable } from '@nestjs/common';

type TelegramApiResponse<T> = {
  description?: string;
  ok: boolean;
  result?: T;
};

type TelegramMeResult = {
  username?: string;
};

@Injectable()
export class TelegramConfigValidationGateway {
  async validate(input: { chatId: string; token: string }) {
    const me = await this.callTelegram<TelegramMeResult>(input.token, 'getMe');
    await this.callTelegram(input.token, 'getChat', {
      chat_id: input.chatId,
    });

    return {
      botUsername: me.username ?? null,
    };
  }

  private async callTelegram<T>(
    token: string,
    method: string,
    params?: Record<string, string>,
  ) {
    const baseUrl = `https://api.telegram.org/bot${token}/${method}`;
    const url =
      params && Object.keys(params).length > 0
        ? `${baseUrl}?${new URLSearchParams(params).toString()}`
        : baseUrl;
    const response = await fetch(url, {
      method: 'GET',
    });
    const payload = (await response.json()) as TelegramApiResponse<T>;

    if (!response.ok || !payload.ok || !payload.result) {
      throw new BadRequestException({
        code: 'telegram_runtime_config_invalid',
        message:
          payload.description ??
          'Token Telegram hoặc chat ID không hợp lệ.',
      });
    }

    return payload.result;
  }
}
