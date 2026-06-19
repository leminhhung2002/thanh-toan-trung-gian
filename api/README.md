# API

Backend chính của hệ thống mới, viết bằng NestJS 11, Drizzle ORM và MariaDB. Tất cả endpoint public/admin đều được expose dưới prefix `/api/v1`.

## Stack

- NestJS 11
- Drizzle ORM
- MariaDB / MySQL dialect
- JWT auth
- Swagger
- Pino logging
- Big.js cho tính toán tài chính

## Runtime mặc định

- Listen host: `0.0.0.0`
- Port: `3000`
- Local URL: `http://localhost:3000`
- API base: `http://localhost:3000/api/v1`
- Swagger docs: `http://localhost:3000/docs`
- Health check: `http://localhost:3000/api/v1/health`

Khi app boot thành công, terminal sẽ in ra local URL, network URL và docs URL.

## Cấu trúc chính

```text
api/
├── drizzle/                    # SQL migrations
├── src/
│   ├── modules/                # Domain modules
│   ├── platform/               # Auth, database, config, http plumbing
│   └── scripts/                # migrate / seed scripts
├── test/                       # e2e tests
└── docker-compose.yml          # MariaDB + RabbitMQ local
```

## Domain modules chính

- `auth`: register, login, refresh, logout, current user
- `users`: profile và admin user management
- `wallets`: wallet balances + ledger history
- `deposit-reservations`: reservation flow cho nạp `VND`
- `deposits`: user deposits và admin review
- `withdrawals`: tạo withdrawal và admin review
- `exchange`: quote/execute `VND -> USDT`, exchange orders history
- `bank-accounts`: admin CRUD tài khoản ngân hàng nạp `VND`
- `settings`: TTL reservation + financial fee settings
- `audit`: audit logs cho thao tác admin/hệ thống

## Quick start

Có 2 cách chạy:

- đứng trong thư mục `api/`
- đứng ở root workspace và dùng `pnpm --filter api ...`

### 1. Cài dependencies

Từ root workspace:

```bash
pnpm install
```

Hoặc trong package:

```bash
pnpm install
```

Lưu ý:

- `api` phụ thuộc vào workspace package `@nganluong/notification-contracts`
- các script `db:migrate`, `db:reset`, `db:seed`, `build`, `test`, `test:e2e` hiện sẽ tự build package shared này trước
- trên VPS hoặc production server, vẫn nên ưu tiên chạy `pnpm install` tại root workspace trước, không nên chỉ copy riêng thư mục `api/`

### 2. Tạo file env

File mẫu: [`.env.example`](/home/gnadiah/data/Code/nganluong/api/.env.example)

```bash
cp .env.example .env
```

### 3. Khởi động database local

Từ root workspace:

```bash
pnpm --filter api db:up
```

Hoặc trong package:

```bash
pnpm db:up
```

Mặc định Docker compose sẽ chạy:

- MariaDB
- RabbitMQ

MariaDB:

- host: `127.0.0.1`
- port: `3307`
- database: `nganluong_api`
- user: `nganluong`
- password: `nganluong`

RabbitMQ:

- AMQP URL: `amqp://127.0.0.1:5672`
- Management UI: `http://127.0.0.1:15672`
- user: `guest`
- password: `guest`

### 4. Migrate và seed

Từ root workspace:

```bash
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

Hoặc trong package:

```bash
pnpm db:migrate
pnpm db:seed
```

Nếu deploy trên VPS từ workspace root, quy trình khuyến nghị là:

```bash
pnpm install
pnpm --filter api db:migrate
pnpm --filter api build
pnpm --filter api start:prod
```

Nếu chạy production bằng PM2 ở root workspace:

```bash
pnpm install
pnpm --filter api db:migrate
pnpm --filter api build
pnpm --filter telegram-bot build
pnpm --filter client build
pm2 start ecosystem.config.cjs --only api
pm2 save
```

### 5. Chạy app

Từ root workspace:

```bash
pnpm --filter api start:dev
```

Hoặc trong package:

```bash
pnpm start:dev
```

Production-like local run:

Từ root workspace:

```bash
pnpm --filter api build
pnpm --filter api start:prod
```

Hoặc trong package:

```bash
pnpm build
pnpm start:prod
```

Nếu dùng PM2 file chung ở root:

```bash
pm2 restart ecosystem.config.cjs --only api
pm2 logs api
```

Khuyến nghị production sau reverse proxy:

- đặt `HOST=127.0.0.1` trong `.env` trên VPS nếu bạn không muốn backend bind public trực tiếp

## Biến môi trường

### App

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
```

Production note:

- `CORS_ALLOWED_ORIGINS` phải được cấu hình rõ ràng cho môi trường thật
- `JWT_ACCESS_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` không được giữ giá trị sample khi `NODE_ENV=production` hoặc `staging`
- nếu đứng sau reverse proxy như Caddy/Nginx, nên đặt `HOST=127.0.0.1` thay vì `0.0.0.0`
- với public domain `https://tktrunggian.com`, có thể publish API qua cùng domain theo path `https://tktrunggian.com/api/v1`

### Database

```env
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3307
DATABASE_USER=nganluong
DATABASE_PASSWORD=nganluong
DATABASE_NAME=nganluong_api
DATABASE_CONNECTION_LIMIT=10
```

### Notification outbox + RabbitMQ

```env
RABBITMQ_URL=amqp://127.0.0.1:5672
RABBITMQ_NOTIFICATIONS_EXCHANGE=admin_notifications
RABBITMQ_NOTIFICATIONS_ROUTING_KEY=telegram.pending
RABBITMQ_TELEGRAM_CONFIG_ROUTING_KEY=telegram.config.updated
NOTIFICATION_OUTBOX_BATCH_SIZE=20
NOTIFICATION_OUTBOX_POLL_INTERVAL_MS=5000
NOTIFICATION_OUTBOX_MAX_ATTEMPTS=5
```

`api` không gọi Telegram trực tiếp. Khi một request vừa vào admin review queue, backend sẽ:

- ghi event vào bảng `notification_outbox` trong cùng transaction
- publisher nền đọc outbox và publish sang RabbitMQ qua Nest RMQ client wrapper
- `telegram-bot` consume queue rồi gửi ra Telegram

Hiện tại Telegram alert được phát cho:

- `deposit.pending.created`
  khi một `deposit_request` mới vào admin queue
  Điều này bao gồm:
  `VND` reservation-confirm deposit request
- `withdrawal.pending.created`
  khi một `withdrawal_request` mới vào admin queue

### Telegram runtime config cho bot

`api` không chỉ publish admin notification events, mà còn là nơi lưu active Telegram runtime config cho `telegram-bot`.

Env liên quan:

```env
TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN=change-me-internal-token
RABBITMQ_TELEGRAM_CONFIG_ROUTING_KEY=telegram.config.updated
```

Luồng hoạt động:

- super admin cấu hình Telegram integration qua admin API dưới prefix `/api/v1/admin/integrations/telegram`
- backend validate `chatId` và `token`, mã hóa token trước khi lưu vào DB, và tăng `version` của active config
- sau khi update thành công, backend publish signal `telegram.config.updated` sang RabbitMQ
- `telegram-bot` đồng thời có thể gọi internal endpoint `GET /api/v1/internal/integrations/telegram/runtime-config` để lấy `chatId`, `token`, `version`

Persistence thực tế:

- active Telegram runtime config được lưu trong bảng `telegram_runtime_configs`
- `chatId`, `version`, `botUsername` và metadata nằm trong DB
- Telegram bot token thật không nằm trong `.env`; nó được mã hóa thành `token_encrypted` rồi lưu DB

Lưu ý vận hành:

- `TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN` phải khớp giữa `api` và `telegram-bot`
- nếu chưa có active Telegram runtime config hoặc record hiện tại không giải mã được, `telegram-bot` sẽ không lấy được config usable nhưng vẫn tiếp tục chạy để chờ refresh lại
- `TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY` là bắt buộc và phải là base64-encoded 32-byte key
- không được đổi `TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY` bừa sau khi DB đã có dữ liệu Telegram runtime config, nếu không token cũ sẽ không giải mã được

### Realtime exchange pricing

```env
COINBASE_API_BASE_URL=https://api.coinbase.com
COINGECKO_API_BASE_URL=https://api.coingecko.com/api/v3
COINGECKO_API_TIMEOUT_MS=5000
```

API hiện lấy tỷ giá realtime `USDT/VND` từ Coinbase qua endpoint:

```text
/v2/exchange-rates?currency=USDT
```

Khi Coinbase lỗi tạm thời, backend sẽ fallback sang CoinGecko:

```text
/simple/price?ids=tether&vs_currencies=vnd
```

### Auth và bootstrap admin

```env
JWT_ACCESS_SECRET=local-access-secret-change-me
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30

SUPER_ADMIN_EMAIL=superadmin@example.com
SUPER_ADMIN_PASSWORD=ChangeMe123!
SUPER_ADMIN_PHONE=
```

## Response shape

API dùng envelope dạng:

```json
{
  "data": {}
}
```

Lỗi nghiệp vụ quan trọng dùng `code` ổn định trong payload lỗi, ví dụ:

- `deposit_vnd_requires_reservation`
- `deposit_reservation_active_exists`
- `deposit_reservation_pending_review_exists`
- `exchange_rate_unavailable`
- `bank_account_in_use`

Client nên dựa vào `error.code`, không nên parse `message`.

## Verification

Từ root workspace:

```bash
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
```

Hoặc trong package:

```bash
pnpm test
pnpm test:e2e
pnpm build
```

## Endpoint surfaces chính

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Profile và wallets

- `GET /profile`
- `PATCH /profile`
- `POST /profile/change-password`
- `GET /wallets`
- `GET /wallets/:assetCode/ledger`

### Nạp tiền

- `POST /deposit-reservations`
- `GET /deposit-reservations/current`
- `POST /deposit-reservations/:id/confirm`
- `POST /deposit-reservations/:id/cancel`
- `GET /deposits`
- `POST /deposits`
- `GET /admin/deposits`
- `POST /admin/deposits/:id/approve`
- `POST /admin/deposits/:id/reject`

Lưu ý:

- `VND + bank_transfer` phải đi qua reservation flow
- `POST /deposits` không còn là đường trực tiếp hợp lệ cho nạp `VND` qua bank

### Rút tiền

- `GET /withdrawals`
- `POST /withdrawals`
- `GET /admin/withdrawals`
- `POST /admin/withdrawals/:id/approve`
- `POST /admin/withdrawals/:id/reject`

### Exchange

- `GET /exchange/orders`
- `POST /exchange/quote`
- `POST /exchange/execute`

Flow hiện chỉ hỗ trợ `VND -> USDT`.

### Admin banks và settings

- `GET /admin/bank-accounts`
- `POST /admin/bank-accounts`
- `PATCH /admin/bank-accounts/:id`
- `DELETE /admin/bank-accounts/:id`
- `POST /admin/bank-accounts/reset-daily-usage`
- `GET /admin/settings`
- `PATCH /admin/settings`
- `GET /settings/financial`
- `GET /settings/display`

### Admin users

- `GET /admin/users`
- `GET /admin/users/roles`
- `PATCH /admin/users/:id/profile`
- `PATCH /admin/users/:id/roles`
- `PATCH /admin/users/:id/password`
- `PATCH /admin/users/:id/balances`
- `POST /admin/users/:id/add-balance`

## Quy tắc nghiệp vụ quan trọng

### 1. VND deposit reservation

Flow nạp `VND` dùng reservation để tránh rác admin queue và tránh vượt hạn mức bank account:

- `active`: user đã lấy thông tin nạp nhưng chưa bấm `Đã nạp tiền`
- `pending_review`: user đã bấm `Đã nạp tiền`, đang chờ admin duyệt
- `approved` / `rejected` / `expired`

Capacity runtime của bank account:

```text
remaining = dailyLimit - usedToday - reservedUnconfirmed - reservedPendingReview
```

### 2. Withdrawal semantics

User nhập số tiền muốn rút khỏi ví:

```text
totalDebit = inputAmount
feeAmount = floor(totalDebit * feePercent)
amount = totalDebit - feeAmount
```

Wallet reserve/settle/release theo `totalDebit`.

### 3. Exchange semantics

`exchange` chỉ là quy đổi số dư nội bộ:

- user nhập `requestedAmount` bằng `VND`
- fee tính trên `requestedAmount`
- wallet bị trừ `totalDebit = requestedAmount + feeAmount`
- chỉ `requestedAmount` được đem đi quy đổi sang `USDT`
- kết quả `USDT` được floor xuống số nguyên

## Scripts hữu ích

```bash
pnpm start:dev
pnpm start:prod
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm db:up
pnpm db:down
pnpm db:generate
pnpm db:migrate
pnpm db:reset
pnpm db:seed
```

## Tích hợp với client

- `client` mặc định gọi API qua `http://localhost:3000/api/v1`
- CORS mặc định cho:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
  - `http://localhost:4173`
  - `http://127.0.0.1:4173`
- Nếu đổi host/port API, cập nhật `VITE_API_BASE_URL` bên `client`
