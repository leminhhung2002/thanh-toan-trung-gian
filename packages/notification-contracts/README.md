# Notification Contracts

Shared package này chứa typed contracts cho notification pipeline giữa `api` và `telegram-bot`, bao gồm cả admin notification events lẫn Telegram runtime config signal events.

## Mục đích

Package này giúp tránh drift schema message giữa producer và consumer.

Hiện tại package export:

- event type constants
- `AdminNotificationEvent`
- `DepositPendingCreatedEvent`
- `WithdrawalPendingCreatedEvent`
- `TelegramConfigUpdatedEvent`
- shared payload types cho deposit và withdrawal alerts
- payload/type helpers cho event `telegram.config.updated`

Nguồn chính nằm ở [src/index.ts](/home/gnadiah/data/Code/nganluong/packages/notification-contracts/src/index.ts).

## Package này được dùng ở đâu

- `api`
  dùng để build typed RabbitMQ payload cho outbox/publisher và config-update signal
- `telegram-bot`
  dùng để parse typed notification events, format admin alerts, và nhận signal refresh Telegram runtime config

## Scripts

Chạy trong package:

```bash
pnpm build
```

Chạy từ root workspace:

```bash
pnpm --filter @nganluong/notification-contracts build
```

## Khi nào cần sửa package này

Sửa package này khi:

- thêm event type mới
- đổi payload schema của event hiện có
- cần thêm versioning hoặc helper types cho notification pipeline

Khi sửa, nên build lại package và verify cả producer lẫn consumer:

```bash
pnpm --filter @nganluong/notification-contracts build
pnpm --filter api test
pnpm --filter telegram-bot test
```
