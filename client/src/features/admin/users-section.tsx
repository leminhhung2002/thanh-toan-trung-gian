import { useDeferredValue, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FeedbackBanner } from '#/components/feedback-banner'
import { adminApi } from '#/features/admin/api'
import { ManualRefreshButton } from '#/features/admin/manual-refresh-button'
import { getAdminUserTotalsUiCopy } from '#/features/admin/ui'
import { translateApiError } from '#/lib/api/error-copy'
import { queryKeys } from '#/lib/query-keys'
import type {
  AdminRoleOption,
  AdminUserSummary,
  AddAdminUserBalanceInput,
  OverwriteAdminUserBalancesInput,
} from '#/lib/types'
import { formatUsdt, formatVnd } from '#/lib/utils/format'
import styles from '../../routes/admin.module.css'

type FeedbackState = {
  kind: 'error' | 'success'
  message: string
}

type UserModalState =
  | { type: 'add-balance'; assetCode: 'USDT' | 'VND'; user: AdminUserSummary }
  | { type: 'balances'; user: AdminUserSummary }
  | { type: 'password'; user: AdminUserSummary }
  | { type: 'profile'; user: AdminUserSummary }
  | { type: 'roles'; user: AdminUserSummary }

export function UsersSection({
  canManageUserAccounts,
}: {
  canManageUserAccounts: boolean
}) {
  const queryClient = useQueryClient()
  const totalsUiCopy = getAdminUserTotalsUiCopy()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [modalState, setModalState] = useState<UserModalState | null>(null)
  const [profileForm, setProfileForm] = useState({
    email: '',
    phone: '',
    telegram: '',
  })
  const [passwordForm, setPasswordForm] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [balanceForm, setBalanceForm] = useState<
    Required<OverwriteAdminUserBalancesInput>
  >({
    usdt: '0.00',
    vnd: '0',
  })
  const [addBalanceForm, setAddBalanceForm] = useState<AddAdminUserBalanceInput>({
    amount: '',
    assetCode: 'VND',
  })

  const usersQuery = useQuery({
    queryKey: queryKeys.adminUsers(deferredSearch),
    queryFn: () => adminApi.listUsers(deferredSearch),
  })
  const roleOptionsQuery = useQuery({
    queryKey: queryKeys.adminRoleOptions,
    queryFn: adminApi.listRoleOptions,
    enabled: canManageUserAccounts,
    staleTime: 1000 * 60 * 60,
  })

  const invalidateUserQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.authMe }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profile }),
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets }),
      queryClient.invalidateQueries({ queryKey: queryKeys.history }),
    ])
  }

  const handleMutationError = (error: unknown, fallback: string) => {
    setFeedback({
      kind: 'error',
      message: translateApiError(error, fallback),
    })
  }

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: typeof profileForm }) =>
      adminApi.updateUserProfile(id, input),
    onSuccess: async () => {
      await invalidateUserQueries()
      setFeedback({
        kind: 'success',
        message: 'Đã cập nhật thông tin người dùng.',
      })
      setModalState(null)
    },
    onError: (error) =>
      handleMutationError(error, 'Không thể cập nhật thông tin người dùng'),
  })

  const updateRolesMutation = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) =>
      adminApi.updateUserRoles(id, { roles }),
    onSuccess: async () => {
      await invalidateUserQueries()
      setFeedback({
        kind: 'success',
        message: 'Đã cập nhật phân quyền người dùng.',
      })
      setModalState(null)
    },
    onError: (error) =>
      handleMutationError(error, 'Không thể cập nhật phân quyền'),
  })

  const updatePasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      adminApi.updateUserPassword(id, { newPassword }),
    onSuccess: async () => {
      await invalidateUserQueries()
      setFeedback({
        kind: 'success',
        message: 'Đã đặt mật khẩu mới cho người dùng.',
      })
      setModalState(null)
      setPasswordForm('')
    },
    onError: (error) => handleMutationError(error, 'Không thể đổi mật khẩu'),
  })

  const overwriteBalancesMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Required<OverwriteAdminUserBalancesInput>
    }) => adminApi.overwriteUserBalances(id, input),
    onSuccess: async () => {
      await invalidateUserQueries()
      setFeedback({
        kind: 'success',
        message: 'Đã cập nhật số dư khả dụng của người dùng.',
      })
      setModalState(null)
    },
    onError: (error) =>
      handleMutationError(error, 'Không thể cập nhật số dư người dùng'),
  })

  const addBalanceMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: AddAdminUserBalanceInput
    }) => adminApi.addUserBalance(id, input),
    onSuccess: async () => {
      await invalidateUserQueries()
      setFeedback({
        kind: 'success',
        message: 'Đã cộng thêm số dư cho người dùng.',
      })
      setModalState(null)
      setAddBalanceForm({
        amount: '',
        assetCode: 'VND',
      })
    },
    onError: (error) => handleMutationError(error, 'Không thể cộng thêm số dư'),
  })

  const openProfileModal = (user: AdminUserSummary) => {
    setFeedback(null)
    setModalState({
      type: 'profile',
      user,
    })
    setProfileForm({
      email: user.email,
      phone: user.phone ?? '',
      telegram: user.telegram ?? '',
    })
  }

  const openRolesModal = (user: AdminUserSummary) => {
    setFeedback(null)
    setModalState({
      type: 'roles',
      user,
    })
    setSelectedRoles(user.roles)
  }

  const openPasswordModal = (user: AdminUserSummary) => {
    setFeedback(null)
    setModalState({
      type: 'password',
      user,
    })
    setPasswordForm('')
  }

  const openBalancesModal = (user: AdminUserSummary) => {
    setFeedback(null)
    setModalState({
      type: 'balances',
      user,
    })
    setBalanceForm({
      usdt: user.balances.usdt.available,
      vnd: user.balances.vnd.available,
    })
  }

  const openAddBalanceModal = (
    user: AdminUserSummary,
    assetCode: 'USDT' | 'VND',
  ) => {
    setFeedback(null)
    setModalState({
      type: 'add-balance',
      assetCode,
      user,
    })
    setAddBalanceForm({
      amount: '',
      assetCode,
    })
  }

  const users = usersQuery.data ?? []
  const roleOptions = roleOptionsQuery.data ?? []
  const isMutating =
    updateProfileMutation.isPending ||
    updateRolesMutation.isPending ||
    updatePasswordMutation.isPending ||
    overwriteBalancesMutation.isPending ||
    addBalanceMutation.isPending

  return (
    <section className={styles.sectionCard}>
      {feedback ? (
        <FeedbackBanner kind={feedback.kind} message={feedback.message} />
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <i className="fas fa-search" />
          <input
            placeholder="Tìm theo email, user ID, số điện thoại..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className={styles.toolbarGroup}>
          {!canManageUserAccounts ? (
            <span className={styles.helperPill}>
              Chỉ `super_admin` mới được quản lý tài khoản
            </span>
          ) : null}
          <ManualRefreshButton
            isRefreshing={usersQuery.isRefetching}
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
            }
          />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Liên hệ</th>
              <th>Quyền</th>
              <th>Số dư VND</th>
              <th>Số dư USDT</th>
              <th>Tổng nạp / rút</th>
              {canManageUserAccounts ? <th>Thao tác</th> : null}
            </tr>
          </thead>
          <tbody>
            {usersQuery.isPending ? (
              <tr>
                <td
                  className={styles.noData}
                  colSpan={canManageUserAccounts ? 8 : 7}
                >
                  Đang tải danh sách người dùng...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  className={styles.noData}
                  colSpan={canManageUserAccounts ? 8 : 7}
                >
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <span className={styles.idBadge}>#{user.id.slice(0, 8)}</span>
                  </td>
                  <td className={styles.emailCell}>
                    <div>{user.email}</div>
                    <div className={styles.mutedText}>
                      Tạo lúc {new Date(user.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </td>
                  <td>
                    <div>{user.phone ?? '-'}</div>
                    <div className={styles.mutedText}>{user.telegram ?? '-'}</div>
                  </td>
                  <td>
                    <div className={styles.inlineRoles}>
                      {user.roles.map((role) => (
                        <span key={role} className={styles.roleChip}>
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={styles.amountCell}>
                    <div>{formatVnd(user.balances.vnd.available)} đ</div>
                    <div className={styles.mutedText}>
                      Pending: {formatVnd(user.balances.vnd.pending)} đ
                    </div>
                  </td>
                  <td className={styles.amountCell}>
                    <div>{formatUsdt(user.balances.usdt.available)} USDT</div>
                    <div className={styles.mutedText}>
                      Pending: {formatUsdt(user.balances.usdt.pending)} USDT
                    </div>
                  </td>
                  <td>
                    <div className={styles.mutedText}>
                      {totalsUiCopy.totalDepositVnd}: {formatVnd(user.totals.totalDepositVnd)} đ
                    </div>
                    <div className={styles.mutedText}>
                      {totalsUiCopy.totalWithdrawVnd}: {formatVnd(user.totals.totalWithdrawVnd)} đ
                    </div>
                    <div className={styles.mutedText}>
                      {totalsUiCopy.totalWithdrawUsdt}: {formatUsdt(user.totals.totalWithdrawUsdt)} USDT
                    </div>
                  </td>
                  {canManageUserAccounts ? (
                    <td>
                      <div className={styles.actionBtns}>
                        <button
                          className={styles.editBtn}
                          type="button"
                          onClick={() => openProfileModal(user)}
                        >
                          <i className="fas fa-user-edit" /> Sửa
                        </button>
                        <button
                          className={styles.secondaryActionBtn}
                          type="button"
                          onClick={() => openRolesModal(user)}
                        >
                          <i className="fas fa-user-shield" /> Quyền
                        </button>
                        <button
                          className={styles.secondaryActionBtn}
                          type="button"
                          onClick={() => openPasswordModal(user)}
                        >
                          <i className="fas fa-key" /> Mật khẩu
                        </button>
                        <button
                          className={styles.secondaryActionBtn}
                          type="button"
                          onClick={() => openBalancesModal(user)}
                        >
                          <i className="fas fa-wallet" /> Số dư
                        </button>
                        <button
                          className={styles.addVndBtn}
                          type="button"
                          onClick={() => openAddBalanceModal(user, 'VND')}
                        >
                          +VND
                        </button>
                        <button
                          className={styles.addUsdtBtn}
                          type="button"
                          onClick={() => openAddBalanceModal(user, 'USDT')}
                        >
                          +USDT
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canManageUserAccounts && modalState?.type === 'profile' ? (
        <AdminModal
          title={`Sửa thông tin: ${modalState.user.email}`}
          onClose={() => !isMutating && setModalState(null)}
        >
          <div className={styles.formGrid}>
            <div className={styles.modalField}>
              <label>Email</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </div>
            <div className={styles.modalField}>
              <label>Số điện thoại</label>
              <input
                type="text"
                value={profileForm.phone}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </div>
            <div className={styles.modalField}>
              <label>Telegram</label>
              <input
                type="text"
                value={profileForm.telegram}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    telegram: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className={styles.modalActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setModalState(null)}
              type="button"
            >
              Hủy
            </button>
            <button
              className={styles.saveBtn}
              disabled={updateProfileMutation.isPending}
              onClick={() =>
                void updateProfileMutation.mutateAsync({
                  id: modalState.user.id,
                  input: profileForm,
                })
              }
              type="button"
            >
              {updateProfileMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </AdminModal>
      ) : null}

      {canManageUserAccounts && modalState?.type === 'roles' ? (
        <AdminModal
          title={`Phân quyền: ${modalState.user.email}`}
          onClose={() => !isMutating && setModalState(null)}
        >
          <div className={styles.roleList}>
            {roleOptionsQuery.isPending ? (
              <div className={styles.queueEmpty}>Đang tải danh sách quyền...</div>
            ) : (
              roleOptions.map((role: AdminRoleOption) => (
                <label key={role.id} className={styles.checkboxRow}>
                  <input
                    checked={selectedRoles.includes(role.code)}
                    type="checkbox"
                    onChange={(event) => {
                      setSelectedRoles((current) =>
                        event.target.checked
                          ? [...current, role.code]
                          : current.filter((item) => item !== role.code),
                      )
                    }}
                  />
                  <span>{role.name}</span>
                </label>
              ))
            )}
          </div>
          <div className={styles.modalActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setModalState(null)}
              type="button"
            >
              Hủy
            </button>
            <button
              className={styles.saveBtn}
              disabled={updateRolesMutation.isPending || selectedRoles.length === 0}
              onClick={() =>
                void updateRolesMutation.mutateAsync({
                  id: modalState.user.id,
                  roles: selectedRoles,
                })
              }
              type="button"
            >
              {updateRolesMutation.isPending ? 'Đang lưu...' : 'Lưu quyền'}
            </button>
          </div>
        </AdminModal>
      ) : null}

      {canManageUserAccounts && modalState?.type === 'password' ? (
        <AdminModal
          title={`Đặt mật khẩu mới: ${modalState.user.email}`}
          onClose={() => !isMutating && setModalState(null)}
        >
          <div className={styles.modalField}>
            <label>Mật khẩu mới</label>
            <input
              type="password"
              placeholder="Ít nhất 8 ký tự"
              value={passwordForm}
              onChange={(event) => setPasswordForm(event.target.value)}
            />
          </div>
          <div className={styles.modalActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setModalState(null)}
              type="button"
            >
              Hủy
            </button>
            <button
              className={styles.saveBtn}
              disabled={updatePasswordMutation.isPending || passwordForm.length < 8}
              onClick={() =>
                void updatePasswordMutation.mutateAsync({
                  id: modalState.user.id,
                  newPassword: passwordForm,
                })
              }
              type="button"
            >
              {updatePasswordMutation.isPending ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </AdminModal>
      ) : null}

      {canManageUserAccounts && modalState?.type === 'balances' ? (
        <AdminModal
          title={`Chỉnh số dư: ${modalState.user.email}`}
          onClose={() => !isMutating && setModalState(null)}
        >
          <div className={styles.formGrid}>
            <div className={styles.modalField}>
              <label>Số dư khả dụng VND</label>
              <input
                type="number"
                value={balanceForm.vnd}
                onChange={(event) =>
                  setBalanceForm((current) => ({
                    ...current,
                    vnd: event.target.value,
                  }))
                }
              />
            </div>
            <div className={styles.modalField}>
              <label>Số dư khả dụng USDT</label>
              <input
                type="number"
                step="0.000001"
                value={balanceForm.usdt}
                onChange={(event) =>
                  setBalanceForm((current) => ({
                    ...current,
                    usdt: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className={styles.helperBoxMuted}>
            Pending balance sẽ được giữ nguyên; hệ thống chỉ overwrite phần available
            và điều chỉnh `total` theo cùng delta để ledger vẫn nhất quán.
          </div>
          <div className={styles.modalActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setModalState(null)}
              type="button"
            >
              Hủy
            </button>
            <button
              className={styles.saveBtn}
              disabled={overwriteBalancesMutation.isPending}
              onClick={() =>
                void overwriteBalancesMutation.mutateAsync({
                  id: modalState.user.id,
                  input: balanceForm,
                })
              }
              type="button"
            >
              {overwriteBalancesMutation.isPending ? 'Đang lưu...' : 'Lưu số dư'}
            </button>
          </div>
        </AdminModal>
      ) : null}

      {canManageUserAccounts && modalState?.type === 'add-balance' ? (
        <AdminModal
          title={`Cộng ${modalState.assetCode}: ${modalState.user.email}`}
          onClose={() => !isMutating && setModalState(null)}
        >
          <div className={styles.modalField}>
            <label>
              Số tiền thêm vào ({modalState.assetCode === 'VND' ? 'VND' : 'USDT'})
            </label>
            <input
              type="number"
              step={modalState.assetCode === 'USDT' ? '0.000001' : '1'}
              value={addBalanceForm.amount}
              onChange={(event) =>
                setAddBalanceForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
            />
          </div>
          <div className={styles.modalActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setModalState(null)}
              type="button"
            >
              Hủy
            </button>
            <button
              className={styles.saveBtn}
              disabled={addBalanceMutation.isPending || !addBalanceForm.amount.trim()}
              onClick={() =>
                void addBalanceMutation.mutateAsync({
                  id: modalState.user.id,
                  input: addBalanceForm,
                })
              }
              type="button"
            >
              {addBalanceMutation.isPending ? 'Đang lưu...' : 'Cộng tiền'}
            </button>
          </div>
        </AdminModal>
      ) : null}
    </section>
  )
}

function AdminModal({
  children,
  onClose,
  title,
}: {
  children: ReactNode
  onClose: () => void
  title: string
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalCard}
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
          <button className={styles.modalClose} onClick={onClose} type="button">
            <i className="fas fa-times" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
