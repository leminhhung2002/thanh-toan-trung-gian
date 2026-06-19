# Telegram Bot

NestJS RMQ microservice riêng dùng để nhận admin notification events từ RabbitMQ và gửi alert ra Telegram channel/chat.

Khác với phiên bản cấu hình tĩnh trước đây, bot hiện không đọc `TELEGRAM_BOT_TOKEN` hay `TELEGRAM_ADMIN_CHAT_ID` từ env. Runtime config đang active sẽ được lấy động từ `api` qua internal endpoint, đồng thời bot vừa polling định kỳ vừa lắng nghe signal `telegram.config.updated` để reload nhanh khi cấu hình đổi.

## Event scope v1

- `deposit.pending.created`
  khi một `deposit_request` mới vừa vào admin review queue
- `withdrawal.pending.created`
  khi một `withdrawal_request` mới vừa vào admin review queue

Bot không duyệt request từ Telegram trong v1. Nó chỉ gửi outbound alert.

## Vai trò trong workspace

- `api` là producer của event
- `telegram-bot` là Nest RMQ consumer + sender tới Telegram
- `api` cũng là nguồn runtime config Telegram cho bot
- `@nganluong/notification-contracts` giữ schema event dùng chung

## Runtime flow

- `api` publish admin notification events với routing key `telegram.pending`
- `telegram-bot` consume event, format nội dung alert, rồi gửi sang Telegram
- khi bot khởi động, nó gọi `GET /api/v1/internal/integrations/telegram/runtime-config` trên `api` để lấy `token`, `chatId`, `version`
- bot polling runtime config theo `TELEGRAM_RUNTIME_CONFIG_POLL_INTERVAL_MS`
- khi admin cập nhật Telegram integration bên `api`, backend publish event `telegram.config.updated` và bot refresh config gần như ngay lập tức
- nếu gửi Telegram lỗi, bot sẽ republish sang retry queue; quá ngưỡng `TELEGRAM_SEND_MAX_ATTEMPTS` thì chuyển sang dead queue
- nếu runtime config đang thiếu/hỏng hoặc `api` tạm thời trả lỗi, bot vẫn khởi động, log trạng thái degraded, rồi tiếp tục chờ polling hoặc signal để tự hồi
- trong thời gian runtime config chưa usable, notification sẽ được republish sang retry queue với cùng `attempt`, không bị tính như lỗi Telegram API thật và không bị đốt retry budget

## Quick start

Có 2 cách chạy:

- đứng trong thư mục `telegram-bot/`
- đứng ở root workspace và dùng `pnpm --filter telegram-bot ...`

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

- `telegram-bot` phụ thuộc vào workspace package `@nganluong/notification-contracts`
- các script `start:dev`, `build`, `test` hiện sẽ tự build package shared này trước
- trên VPS hoặc production server, nên chạy `pnpm install` ở root workspace thay vì deploy riêng từng package

### 2. Tạo env

File mẫu: [`.env.example`](/home/gnadiah/data/Code/nganluong/telegram-bot/.env.example)

```bash
cp .env.example .env
```

### 3. Chuẩn bị API và RabbitMQ

RabbitMQ local hiện được khai báo trong [api/docker-compose.yml](/home/gnadiah/data/Code/nganluong/api/docker-compose.yml):

Từ root workspace:

```bash
pnpm --filter api db:up
```

Hoặc theo cách cũ:

```bash
cd ../api
pnpm db:up
```

Sau đó cần chạy `api`, vì `telegram-bot` sẽ gọi sang `API_INTERNAL_BASE_URL` ngay khi bootstrap để lấy runtime config đang active.

Ví dụ chạy local từ root workspace:

```bash
pnpm --filter api start:dev
```

Lưu ý bắt buộc:

- `TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN` của `telegram-bot` phải khớp với cấu hình bên `api`
- bên `api` nên có active Telegram runtime config trước để bot gửi được ngay; nếu chưa có hoặc config đang lỗi, bot vẫn chạy nhưng sẽ ở trạng thái chưa thể gửi cho tới khi config được sửa
- active config này được quản lý từ admin Telegram integration của `api`, không còn nằm trong env của `telegram-bot`

### 4. Chạy bot

Từ root workspace:

```bash
pnpm --filter telegram-bot start:dev
```

Hoặc trong package:

```bash
pnpm start:dev
```

Build production:

Từ root workspace:

```bash
pnpm --filter telegram-bot build
pnpm --filter telegram-bot start
```

Hoặc trong package:

```bash
pnpm build
pnpm start
```

Quy trình khuyến nghị trên server:

```bash
pnpm install
pnpm --filter telegram-bot build
pnpm --filter telegram-bot start
```

Nếu dùng PM2 file chung ở root workspace:

```bash
pnpm install
pnpm --filter api build
pnpm --filter telegram-bot build
pnpm --filter client build
pm2 start ecosystem.config.cjs --only telegram-bot
pm2 save
```

## Biến môi trường

```env
API_INTERNAL_BASE_URL=http://127.0.0.1:3000
RABBITMQ_URL=amqp://127.0.0.1:5672
RABBITMQ_NOTIFICATIONS_EXCHANGE=admin_notifications
RABBITMQ_NOTIFICATIONS_QUEUE=telegram_notifications
RABBITMQ_NOTIFICATIONS_ROUTING_KEY=telegram.pending
RABBITMQ_NOTIFICATIONS_CONFIG_QUEUE=telegram_config_updates
RABBITMQ_NOTIFICATIONS_CONFIG_ROUTING_KEY=telegram.config.updated
RABBITMQ_NOTIFICATIONS_RETRY_QUEUE=telegram_notifications_retry
RABBITMQ_NOTIFICATIONS_DEAD_QUEUE=telegram_notifications_dead

TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN=change-me-internal-token
TELEGRAM_RUNTIME_CONFIG_POLL_INTERVAL_MS=30000
TELEGRAM_SEND_MAX_ATTEMPTS=5
```

Ý nghĩa các biến quan trọng:

- `API_INTERNAL_BASE_URL`: base URL của `api` mà bot sẽ gọi để lấy runtime config
- `TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN`: internal token để bot gọi endpoint protected của `api`
- `RABBITMQ_NOTIFICATIONS_CONFIG_QUEUE` và `RABBITMQ_NOTIFICATIONS_CONFIG_ROUTING_KEY`: queue/routing key cho signal reload config
- `TELEGRAM_RUNTIME_CONFIG_POLL_INTERVAL_MS`: fallback polling interval nếu signal bị trễ hoặc miss
- `TELEGRAM_SEND_MAX_ATTEMPTS`: số lần retry tối đa cho lỗi gửi Telegram thật trước khi chuyển message sang dead queue

Lưu ý vận hành:

- `TELEGRAM_SEND_MAX_ATTEMPTS` không áp dụng cho trạng thái `runtime config unavailable`; khi đó bot sẽ retry mềm cho tới khi config usable trở lại
- bot không lưu `token/chatId` Telegram trong env; env chỉ giữ internal token, polling interval và RabbitMQ wiring

## Verification

Từ root workspace:

```bash
pnpm --filter telegram-bot test
pnpm --filter telegram-bot build
```

Hoặc trong package:

```bash
pnpm test
pnpm build
```

Lệnh vận hành PM2 thường dùng:

```bash
pm2 restart ecosystem.config.cjs --only telegram-bot
pm2 logs telegram-bot
```
