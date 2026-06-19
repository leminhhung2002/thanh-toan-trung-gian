# Tài khoản trung gian Workspace

Monorepo này đang được tổ chức bằng `pnpm-workspace` với 4 package chính:

- `api`
  Backend NestJS, MariaDB, Drizzle ORM. Đây là source of truth cho auth, wallet, deposits, withdrawals, exchange, admin review và notification outbox.
- `client`
  Frontend React 19 + TanStack Start. Đây là app người dùng/admin đang tương tác trên trình duyệt.
- `telegram-bot`
  NestJS RMQ microservice riêng để consume admin notification events từ RabbitMQ và gửi alert ra Telegram.
- `@nganluong/notification-contracts`
  Shared package chứa typed event contracts giữa `api` và `telegram-bot`.

## Cấu trúc workspace

```text
.
├── ecosystem.config.cjs
├── api/
├── client/
├── logs/
├── packages/
│   └── notification-contracts/
├── telegram-bot/
└── pnpm-workspace.yaml
```

## Phụ thuộc giữa các package

- `client` gọi HTTP API từ `api`
- `api` publish admin notification events sang RabbitMQ
- `telegram-bot` consume RabbitMQ events từ `api`
- `telegram-bot` đồng thời gọi internal API của `api` để lấy active Telegram runtime config và lắng nghe signal `telegram.config.updated`
- `api` và `telegram-bot` cùng dùng `@nganluong/notification-contracts`

## Cài dependencies

Chạy tại root workspace:

```bash
pnpm install
```

Lưu ý quan trọng:

- đây là `pnpm workspace`, nên các package như `api` và `telegram-bot` phụ thuộc vào package dùng chung `@nganluong/notification-contracts`
- khi deploy lên VPS, hãy chạy `pnpm install` ở root workspace rồi mới chạy các lệnh `db:migrate`, `build`, `start`
- hiện các script quan trọng của `api` và `telegram-bot` đã tự build package shared trước khi chạy

## Cách chạy theo package

### API

Chạy từ root:

```bash
pnpm --filter api db:up
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm --filter api start:dev
```

Docs chi tiết: [api/README.md](/home/gnadiah/data/Code/nganluong/api/README.md)

### Client

Chạy từ root:

```bash
pnpm --filter client dev
```

Local build preview:

```bash
pnpm --filter client build
pnpm --filter client preview
```

Production runtime:

```bash
pnpm --filter client build
pnpm --filter client start
```

Docs chi tiết: [client/README.md](/home/gnadiah/data/Code/nganluong/client/README.md)

### Telegram Bot

Chạy từ root:

```bash
pnpm --filter telegram-bot start:dev
```

Build:

```bash
pnpm --filter telegram-bot build
pnpm --filter telegram-bot start
```

Docs chi tiết: [telegram-bot/README.md](/home/gnadiah/data/Code/nganluong/telegram-bot/README.md)

## Chạy production với PM2

Từ root workspace:

```bash
pnpm install
pnpm --filter api db:migrate
pnpm --filter api build
pnpm --filter telegram-bot build
pnpm --filter client build
pm2 start ecosystem.config.cjs
pm2 save
```

Lệnh vận hành thường dùng:

```bash
pm2 status
pm2 restart ecosystem.config.cjs --only api
pm2 restart ecosystem.config.cjs --only telegram-bot
pm2 restart ecosystem.config.cjs --only client
pm2 logs api
pm2 logs telegram-bot
pm2 logs client
```

PM2 file này:

- chạy `api` từ `api/dist/src/main.js`
- chạy `telegram-bot` từ `telegram-bot/dist/main.js`
- chạy `client` từ `client/.output/server/index.mjs`
- để mỗi app tự đọc `.env.local` hoặc `.env` trong package của chính nó nhờ `cwd` riêng
- ghi log vào `logs/pm2/`

### Shared contracts

Build package typed contracts:

```bash
pnpm --filter @nganluong/notification-contracts build
```

Docs chi tiết: [packages/notification-contracts/README.md](/home/gnadiah/data/Code/nganluong/packages/notification-contracts/README.md)

## Chạy full local stack

1. Cài dependencies:

```bash
pnpm install
```

2. Tạo env cho từng package cần chạy:

- [api/.env.example](/home/gnadiah/data/Code/nganluong/api/.env.example)
- [client/.env.example](/home/gnadiah/data/Code/nganluong/client/.env.example)
- [telegram-bot/.env.example](/home/gnadiah/data/Code/nganluong/telegram-bot/.env.example)

3. Bật infra:

```bash
pnpm --filter api db:up
```

4. Migrate và seed backend:

```bash
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

5. Chạy backend:

```bash
pnpm --filter api start:dev
```

6. Chạy frontend:

```bash
pnpm --filter client dev
```

7. Chạy Telegram worker:

```bash
pnpm --filter telegram-bot start:dev
```

8. Nếu muốn bot gửi Telegram thật:

- cấu hình Telegram integration trong `api`
- đảm bảo `TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN` khớp giữa `api` và `telegram-bot`
- nếu config Telegram chưa có hoặc đang lỗi, `telegram-bot` vẫn chạy nhưng sẽ chờ refresh lại trước khi gửi được

## Verification commands

Chạy từ root workspace:

```bash
pnpm --filter @nganluong/notification-contracts build
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
pnpm --filter client test
pnpm --filter client build
PORT=3001 HOST=127.0.0.1 pnpm --filter client start
pnpm --filter telegram-bot test
pnpm --filter telegram-bot build
node -e "const ecosystem = require('./ecosystem.config.cjs'); console.log(ecosystem.apps.map((app) => app.name))"
```

## Gợi ý đọc code

- Muốn hiểu nghiệp vụ tài chính: bắt đầu từ [api/README.md](/home/gnadiah/data/Code/nganluong/api/README.md)
- Muốn hiểu flow UI: bắt đầu từ [client/README.md](/home/gnadiah/data/Code/nganluong/client/README.md)
- Muốn hiểu alert Telegram: đọc [telegram-bot/README.md](/home/gnadiah/data/Code/nganluong/telegram-bot/README.md)
- Muốn hiểu shared event schema: đọc [packages/notification-contracts/README.md](/home/gnadiah/data/Code/nganluong/packages/notification-contracts/README.md)
