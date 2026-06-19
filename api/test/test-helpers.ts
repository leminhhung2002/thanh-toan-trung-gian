import type { Response } from 'supertest';

type ApiEnvelope<T> = {
  data: T;
};

type ErrorEnvelope = {
  error: {
    code: string;
    details: unknown;
    message: string;
    requestId: string;
  };
};

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: {
    email: string;
    id: string;
    roles: string[];
  };
  wallets: WalletSummary[];
};

export type WalletSummary = {
  assetCode: string;
  assetName: string;
  walletId: string;
  balances: {
    available: string;
    pending: string;
    total: string;
  };
};

export type ProfilePayload = {
  email: string;
  id: string;
  phone: string | null;
  roles: string[];
  telegram: string | null;
  twoFactorEnabled: boolean;
};

export type EntityWithId = {
  id: string;
};

export type LedgerPayload = {
  entries: Array<Record<string, unknown>>;
};

export function responseData<T>(response: Response): T {
  return (response.body as ApiEnvelope<T>).data;
}

export function responseError(response: Response) {
  return (response.body as ErrorEnvelope).error;
}

export function findWallet(wallets: WalletSummary[], assetCode: string) {
  const wallet = wallets.find((item) => item.assetCode === assetCode);

  if (!wallet) {
    throw new Error(`Missing wallet for asset ${assetCode}`);
  }

  return wallet;
}
