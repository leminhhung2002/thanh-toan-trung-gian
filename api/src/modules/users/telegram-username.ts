import { BadRequestException } from '@nestjs/common';

const TELEGRAM_USERNAME_INVALID_MESSAGE =
  'Telegram chỉ được nhập username, không nhập link hoặc đường dẫn không hợp lệ.';

export function normalizeTelegramUsername(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('@')) {
    return assertTelegramUsername(normalized.slice(1));
  }

  const linkMatch = normalized.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([^/?#]+)\/?$/i,
  );

  if (linkMatch) {
    return assertTelegramUsername(linkMatch[1] ?? '');
  }

  const directUsername = assertTelegramUsername(normalized, false);
  if (directUsername) {
    return directUsername;
  }

  throw new BadRequestException({
    code: 'telegram_username_invalid',
    message: TELEGRAM_USERNAME_INVALID_MESSAGE,
  });
}

export function normalizeTelegramUsernameForRead(
  value: string | null | undefined,
) {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return normalizeTelegramUsername(value);
  } catch {
    const normalized = value.trim();
    return normalized || null;
  }
}

function assertTelegramUsername(value: string, required = true) {
  const normalized = value.trim();

  if (!normalized) {
    if (required) {
      throw new BadRequestException({
        code: 'telegram_username_invalid',
        message: TELEGRAM_USERNAME_INVALID_MESSAGE,
      });
    }

    return null;
  }

  if (!/^[A-Za-z0-9_]+$/.test(normalized)) {
    if (required) {
      throw new BadRequestException({
        code: 'telegram_username_invalid',
        message: TELEGRAM_USERNAME_INVALID_MESSAGE,
      });
    }

    return null;
  }

  return normalized;
}
