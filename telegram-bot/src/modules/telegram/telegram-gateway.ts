export type TelegramSendMessageOptions = {
  parseMode?: 'HTML' | 'MarkdownV2';
};

export abstract class TelegramGateway {
  abstract sendMessage(
    text: string,
    options?: TelegramSendMessageOptions,
  ): Promise<void>;
}

export class TelegramGatewayError extends Error {
  override readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TelegramGatewayError';
    this.cause = cause;
  }
}
