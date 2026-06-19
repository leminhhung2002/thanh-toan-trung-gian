import type { ExchangeOrderSummary, ExchangeQuote } from '#/lib/types'
import { apiClient } from '#/lib/api/app-client'
import { createIdempotencyKey } from '#/lib/utils/idempotency'

type CreateQuoteInput = {
  amount: string
  fromAssetCode: string
  toAssetCode: string
}

type ExecuteExchangeInput = {
  quoteId: string
}

export const exchangeApi = {
  createQuote: (input: CreateQuoteInput) =>
    apiClient.post<ExchangeQuote, CreateQuoteInput>('/exchange/quote', input, {
      auth: true,
    }),
  execute: (input: ExecuteExchangeInput) =>
    apiClient.post<{ orderId: string; success: boolean }, ExecuteExchangeInput>(
      '/exchange/execute',
      input,
      {
        auth: true,
        headers: {
          'Idempotency-Key': createIdempotencyKey('exchange'),
        },
      },
    ),
  listOrders: () =>
    apiClient.get<ExchangeOrderSummary[]>('/exchange/orders', {
      auth: true,
    }),
}
