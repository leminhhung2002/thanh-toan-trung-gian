import type {
  AdminSettings,
  AdminBankAccount,
  AdminDepositRequest,
  AdminExchangeOrder,
  AdminRoleOption,
  AdminReviewInput,
  AdminUserSummary,
  AdminWithdrawalRequest,
  AddAdminUserBalanceInput,
  CreateBankAccountInput,
  HomepageBanner,
  TelegramRuntimeConfigSummary,
  OverwriteAdminUserBalancesInput,
  UpdateTelegramRuntimeConfigInput,
  UpdateAdminSettingsInput,
  UpdateAdminUserPasswordInput,
  UpdateAdminUserProfileInput,
  UpdateAdminUserRolesInput,
  UpdateBankAccountInput,
} from '#/lib/types'
import { apiClient } from '#/lib/api/app-client'

export type AdminStatusFilter = 'pending' | 'approved' | 'rejected' | 'all'
type AdminReviewBody = {
  note?: string
}

function toStatusParam(status: AdminStatusFilter) {
  return status
}

function withAdminListQuery(input: {
  endDate?: string
  search?: string
  startDate?: string
  status?: AdminStatusFilter
}) {
  const params = new URLSearchParams()

  if (input.status) {
    params.set('status', toStatusParam(input.status))
  }

  if (input.startDate?.trim() && input.endDate?.trim()) {
    params.set('startDate', input.startDate.trim())
    params.set('endDate', input.endDate.trim())
  }

  if (input.search?.trim()) {
    params.set('search', input.search.trim())
  }

  return params.toString()
}

function withReviewBody(input?: AdminReviewInput) {
  const note = input?.note?.trim()

  if (!note) {
    return {}
  }

  return {
    note,
  }
}

export const adminApi = {
  addUserBalance: (id: string, input: AddAdminUserBalanceInput) =>
    apiClient.post<AdminUserSummary, AddAdminUserBalanceInput>(
      `/admin/users/${id}/add-balance`,
      input,
      { auth: true },
    ),
  createBankAccount: (input: CreateBankAccountInput) =>
    apiClient.post<AdminBankAccount, CreateBankAccountInput>(
      '/admin/bank-accounts',
      input,
      { auth: true },
    ),
  approveDeposit: (id: string, input?: AdminReviewInput) =>
    apiClient.post<{ success: boolean }, AdminReviewBody>(
      `/admin/deposits/${id}/approve`,
      withReviewBody(input),
      { auth: true },
    ),
  approveWithdrawal: (id: string, input?: AdminReviewInput) =>
    apiClient.post<{ success: boolean }, AdminReviewBody>(
      `/admin/withdrawals/${id}/approve`,
      withReviewBody(input),
      { auth: true },
    ),
  deleteBankAccount: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/admin/bank-accounts/${id}`, {
      auth: true,
    }),
  getSettings: () =>
    apiClient.get<AdminSettings>('/admin/settings', { auth: true }),
  getTelegramRuntimeConfig: () =>
    apiClient.get<TelegramRuntimeConfigSummary>('/admin/integrations/telegram', {
      auth: true,
    }),
  listBankAccounts: () =>
    apiClient.get<AdminBankAccount[]>('/admin/bank-accounts', { auth: true }),
  listRoleOptions: () =>
    apiClient.get<AdminRoleOption[]>('/admin/users/roles', { auth: true }),
  listDeposits: (
    status: AdminStatusFilter = 'all',
    startDate?: string,
    endDate?: string,
    search?: string,
  ) =>
    apiClient.get<AdminDepositRequest[]>(
      `/admin/deposits?${withAdminListQuery({ endDate, search, startDate, status })}`,
      { auth: true },
    ),
  listExchangeOrders: (startDate?: string, endDate?: string, search?: string) =>
    apiClient.get<AdminExchangeOrder[]>(
      (() => {
        const query = withAdminListQuery({ endDate, search, startDate })

        return query ? `/admin/exchange/orders?${query}` : '/admin/exchange/orders'
      })(),
      { auth: true },
    ),
  listUsers: (search = '') =>
    apiClient.get<AdminUserSummary[]>(
      `/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`,
      { auth: true },
    ),
  listWithdrawals: (
    status: AdminStatusFilter = 'all',
    startDate?: string,
    endDate?: string,
    search?: string,
  ) =>
    apiClient.get<AdminWithdrawalRequest[]>(
      `/admin/withdrawals?${withAdminListQuery({ endDate, search, startDate, status })}`,
      { auth: true },
    ),
  overwriteUserBalances: (id: string, input: OverwriteAdminUserBalancesInput) =>
    apiClient.patch<AdminUserSummary, OverwriteAdminUserBalancesInput>(
      `/admin/users/${id}/balances`,
      input,
      { auth: true },
    ),
  rejectDeposit: (id: string, input?: AdminReviewInput) =>
    apiClient.post<{ success: boolean }, AdminReviewBody>(
      `/admin/deposits/${id}/reject`,
      withReviewBody(input),
      { auth: true },
    ),
  restoreDepositPending: (id: string) =>
    apiClient.post<{ success: boolean }, Record<string, never>>(
      `/admin/deposits/${id}/restore-pending`,
      {},
      { auth: true },
    ),
  restoreWithdrawalPending: (id: string) =>
    apiClient.post<{ success: boolean }, Record<string, never>>(
      `/admin/withdrawals/${id}/restore-pending`,
      {},
      { auth: true },
    ),
  reverseExchangeOrder: (id: string) =>
    apiClient.post<{ success: boolean }, Record<string, never>>(
      `/admin/exchange/orders/${id}/reverse`,
      {},
      { auth: true },
    ),
  rejectWithdrawal: (id: string, input?: AdminReviewInput) =>
    apiClient.post<{ success: boolean }, AdminReviewBody>(
      `/admin/withdrawals/${id}/reject`,
      withReviewBody(input),
      { auth: true },
    ),
  resetBankAccountUsage: () =>
    apiClient.post<{ success: boolean }, Record<string, never>>(
      '/admin/bank-accounts/reset-daily-usage',
      {},
      { auth: true },
    ),
  updateBankAccount: (id: string, input: UpdateBankAccountInput) =>
    apiClient.patch<AdminBankAccount, UpdateBankAccountInput>(
      `/admin/bank-accounts/${id}`,
      input,
      { auth: true },
    ),
  updateSettings: (input: UpdateAdminSettingsInput) =>
    apiClient.patch<AdminSettings, UpdateAdminSettingsInput>(
      '/admin/settings',
      input,
      { auth: true },
    ),
  updateTelegramRuntimeConfig: (input: UpdateTelegramRuntimeConfigInput) =>
    apiClient.patch<TelegramRuntimeConfigSummary, UpdateTelegramRuntimeConfigInput>(
      '/admin/integrations/telegram',
      input,
      { auth: true },
    ),
  uploadHomepageBanner: (formData: FormData) =>
    apiClient.postFormData<HomepageBanner>('/admin/settings/banners', formData, {
      auth: true,
    }),
  reorderHomepageBanners: (bannerIds: string[]) =>
    apiClient.patch<HomepageBanner[], { bannerIds: string[] }>(
      '/admin/settings/banners/order',
      { bannerIds },
      { auth: true },
    ),
  deleteHomepageBanner: (bannerId: string) =>
    apiClient.delete<{ success: boolean }>(`/admin/settings/banners/${bannerId}`, {
      auth: true,
    }),
  updateUserPassword: (id: string, input: UpdateAdminUserPasswordInput) =>
    apiClient.patch<{ success: boolean }, UpdateAdminUserPasswordInput>(
      `/admin/users/${id}/password`,
      input,
      { auth: true },
    ),
  updateUserProfile: (id: string, input: UpdateAdminUserProfileInput) =>
    apiClient.patch<AdminUserSummary, UpdateAdminUserProfileInput>(
      `/admin/users/${id}/profile`,
      input,
      { auth: true },
    ),
  updateUserRoles: (id: string, input: UpdateAdminUserRolesInput) =>
    apiClient.patch<AdminUserSummary, UpdateAdminUserRolesInput>(
      `/admin/users/${id}/roles`,
      input,
      { auth: true },
    ),
}
