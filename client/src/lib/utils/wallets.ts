import type { WalletSummary } from '../types'

export function findWalletByAssetCode(
  wallets: WalletSummary[] | undefined,
  assetCode: string,
) {
  return wallets?.find((wallet) => wallet.assetCode === assetCode) ?? null
}
