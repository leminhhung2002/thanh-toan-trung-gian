// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SettingsSection } from './admin-page'

describe('SettingsSection', () => {
  it('groups settings into contextual sections and keeps a single operational note', () => {
    render(
      <SettingsSection
        canManageTelegramRuntimeConfig={false}
        exchangeUsdtToVndFeeBpsInput="0.5"
        exchangeUsdtToVndMarkupVndInput="700"
        exchangeVndToUsdtFeeBpsInput="1"
        exchangeMarkupVndInput="1000"
        feedback={null}
        isPending={false}
        isSubmitting={false}
        bannerFeedback={null}
        homepageBanners={[]}
        isDeletingBanner={false}
        isReorderingBanners={false}
        isUploadingBanner={false}
        onChange={vi.fn()}
        onDeleteBanner={vi.fn()}
        onReorderBanners={vi.fn()}
        onSubmit={vi.fn()}
        onTelegramRuntimeConfigChange={vi.fn()}
        onTelegramRuntimeConfigSubmit={vi.fn()}
        onUploadBanner={vi.fn()}
        reservationTtlInput="15"
        supportLinkInput="https://t.me/nganluong_support"
        telegramRuntimeBotUsername={null}
        telegramRuntimeChatIdInput=""
        telegramRuntimeFeedback={null}
        telegramRuntimeIsConfigured={false}
        telegramRuntimeIsPending={false}
        telegramRuntimeLastValidatedAt={null}
        telegramRuntimeTokenInput=""
        telegramRuntimeTokenSuffix={null}
        telegramRuntimeUpdatedAt={null}
        telegramRuntimeVersion={null}
        withdrawalUsdtFeeBpsInput="0"
        withdrawalVndFeeBpsInput="10"
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Cấu hình giữ chỗ nạp VND' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Tỷ giá và phí giao dịch' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Hiển thị cho người dùng' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Ngoại lệ vận hành' }),
    ).toBeTruthy()

    expect(
      screen.getByText(
        /Chỉ áp dụng cho nạp VND qua ngân hàng; request chỉ vào hàng chờ duyệt sau khi user bấm "Đã nạp tiền"\./i,
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        /Đổi tiền hai chiều dùng giá realtime với markup mua\/bán riêng và phí exchange riêng theo từng chiều\./i,
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        /Thay đổi ở đây cập nhật ngay trên dashboard, quên mật khẩu và khu vực hỗ trợ mà không cần rebuild client\./i,
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(/Tối đa 5 ảnh, đúng ratio 16:5 và có thể kéo thả để đổi thứ tự\./i),
    ).toBeTruthy()

    const notes = screen.getAllByRole('note')
    expect(notes).toHaveLength(1)
    expect(notes[0].textContent).toContain(
      'Reservation hết hạn nhưng user vẫn báo đã chuyển tiền thì admin đối soát thủ công.',
    )

    expect(
      screen.getByRole('button', { name: 'Lưu cấu hình' }),
    ).toBeTruthy()
    expect(screen.getByLabelText('Link hỗ trợ')).toBeTruthy()
    expect(screen.getByLabelText('Phí đổi VND -> USDT (%)')).toBeTruthy()
    expect(screen.getByLabelText('Phí rút VND (%)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Chọn ảnh banner' })).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: 'Telegram bot runtime' }),
    ).toBeNull()
  })

  it('shows the Telegram runtime section only for super admin and masks the token', () => {
    render(
      <SettingsSection
        canManageTelegramRuntimeConfig
        exchangeUsdtToVndFeeBpsInput="0.5"
        exchangeUsdtToVndMarkupVndInput="700"
        exchangeVndToUsdtFeeBpsInput="1"
        exchangeMarkupVndInput="1000"
        feedback={null}
        isPending={false}
        isSubmitting={false}
        bannerFeedback={null}
        homepageBanners={[]}
        isDeletingBanner={false}
        isReorderingBanners={false}
        isUploadingBanner={false}
        onChange={vi.fn()}
        onDeleteBanner={vi.fn()}
        onReorderBanners={vi.fn()}
        onSubmit={vi.fn()}
        onTelegramRuntimeConfigChange={vi.fn()}
        onTelegramRuntimeConfigSubmit={vi.fn()}
        onUploadBanner={vi.fn()}
        reservationTtlInput="15"
        supportLinkInput="https://t.me/nganluong_support"
        telegramRuntimeBotUsername="nganluong_bot"
        telegramRuntimeChatIdInput="-1001234567890"
        telegramRuntimeFeedback={null}
        telegramRuntimeIsConfigured
        telegramRuntimeIsPending={false}
        telegramRuntimeLastValidatedAt="2026-04-09T03:00:00.000Z"
        telegramRuntimeTokenInput=""
        telegramRuntimeTokenSuffix="CDEF"
        telegramRuntimeUpdatedAt="2026-04-09T03:00:00.000Z"
        telegramRuntimeVersion={2}
        withdrawalUsdtFeeBpsInput="0"
        withdrawalVndFeeBpsInput="10"
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Telegram bot runtime' }),
    ).toBeTruthy()
    expect(screen.getByDisplayValue('-1001234567890')).toBeTruthy()
    expect(screen.getByText('...CDEF')).toBeTruthy()
    expect(screen.getByText('nganluong_bot')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Lưu cấu hình Telegram' }),
    ).toBeTruthy()
  })
})
