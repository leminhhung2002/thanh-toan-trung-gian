import { useQuery } from '@tanstack/react-query'
import { walletApi } from '#/features/wallet/api'
import { queryKeys } from '#/lib/query-keys'
import type { DisplaySettings } from '#/lib/types'

export const defaultDisplaySettings: DisplaySettings = {
  homepageBanners: [],
  supportLink: 'https://t.me/nganluong_support',
}

export function useDisplaySettings() {
  const query = useQuery({
    queryKey: queryKeys.displaySettings,
    queryFn: walletApi.getDisplaySettings,
    staleTime: 1000 * 60 * 5,
  })

  return {
    ...query,
    displaySettings: query.data ?? defaultDisplaySettings,
  }
}
