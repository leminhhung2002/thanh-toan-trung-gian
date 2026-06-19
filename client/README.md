# Client

Frontend chính của hệ thống mới, viết bằng TanStack Start, React 19, TanStack Router, TanStack Query và Tailwind CSS.

## Stack

- React 19
- TanStack Start
- TanStack Router
- TanStack Query
- TanStack Form
- Nitro node-server output cho production runtime
- Tailwind CSS 4
- Vite 8
- Vitest + Testing Library

## Runtime mặc định

### Dev server

- Listen host: `0.0.0.0`
- Port: `5173`
- Strict port: `true`
- Local URL: `http://localhost:5173`

### Preview server

- Listen host: `0.0.0.0`
- Port: `4173`
- Strict port: `true`
- Local URL: `http://localhost:4173`

### Production server

- Runtime entry: `.output/server/index.mjs`
- Internal host khuyến nghị: `127.0.0.1`
- Internal port mặc định trong PM2: `3001`

`strictPort: true` nghĩa là Vite sẽ fail ngay nếu port đang bận, thay vì tự nhảy sang port khác.

## Cấu trúc chính

```text
client/
├── src/
│   ├── components/         # shared UI pieces
│   ├── features/           # domain-specific UI/api helpers
│   ├── lib/                # config, auth context, shared types
│   └── routes/             # TanStack Router routes
└── public/
```

## Quick start

Có 2 cách chạy:

- đứng trong thư mục `client/`
- đứng ở root workspace và dùng `pnpm --filter client ...`

### 1. Cài dependencies

Từ root workspace:

```bash
pnpm install
```

Hoặc trong package:

```bash
pnpm install
```

### 2. Tạo file env

File mẫu: [`.env.example`](/home/gnadiah/data/Code/nganluong/client/.env.example)

```bash
cp .env.example .env
```

### 3. Chạy app

Từ root workspace:

```bash
pnpm --filter client dev
```

Hoặc trong package:

```bash
pnpm dev
```

Local build preview:

Từ root workspace:

```bash
pnpm --filter client build
pnpm --filter client preview
```

Hoặc trong package:

```bash
pnpm build
pnpm preview
```

Production runtime:

Từ root workspace:

```bash
pnpm --filter client build
pnpm --filter client start
```

Hoặc trong package:

```bash
pnpm build
pnpm start
```

Ghi chú:

- `start` và `start:prod` chạy production server runtime của TanStack Start qua Node
- `preview` chỉ dùng để xem thử build local, không phải production runtime trên VPS

## Environment variables

```env
VITE_API_BASE_URL=http://localhost:3000
```

Frontend gọi API qua:

```text
${VITE_API_BASE_URL}/api/v1
```

Lưu ý:

- Thông tin hiển thị public hiện được lấy runtime từ backend qua `GET /api/v1/settings/display`; hiện tại endpoint này chỉ trả về `link hỗ trợ`
- Thông tin nạp `VND` không còn lấy từ env frontend; bank account cho `VND` được backend chọn động qua reservation flow
- Admin có thể cập nhật link hỗ trợ trực tiếp trong tab `Cài đặt`, không cần rebuild client
- Phiên đăng nhập hiện là SPA-style: access/refresh token được hydrate lại từ browser storage, chưa dùng SSR session thật
- `VITE_*` là build-time env, nên hiện tại frontend production chỉ còn cần `VITE_API_BASE_URL`
- trên production, `VITE_API_BASE_URL` nên trỏ vào public API base mà trình duyệt thật sẽ gọi, không nên giữ `localhost` nếu app được serve sau domain thật
- với website public `https://tktrunggian.com`, cấu hình đơn giản nhất là reverse proxy cùng domain để frontend gọi `https://tktrunggian.com/api/v1`

## Route map

### User-facing

- `/`: login
- `/register`: đăng ký
- `/forgot-password`: màn support-only, chưa có reset password thật
- `/dashboard`: ví, nạp tiền, rút tiền
- `/exchange`: đổi nội bộ `VND -> USDT`
- `/history`: lịch sử giao dịch
- `/account`: profile, password, 2FA placeholder rõ ràng
- `/change-password`: đổi mật khẩu

Mail icon ở góc phải trên của `/dashboard`, `/history`, và `/account` hiện mở cùng một overlay `Thông báo`.

### Admin

- `/adminxxx`: shell admin nhiều tab
  - `Tổng quan`
  - `Tài khoản`
  - `Giao dịch`
  - `Ngân hàng`
  - `Rút tiền`
  - `Cài đặt`

## Flow UI chính

### Dashboard

- Hiển thị wallet balances
- Mở modal nạp `VND` theo reservation flow
- Hiển thị nạp `USDT` bằng địa chỉ ví do backend settings trả về
- Tạo withdrawal với input `gross debit`, preview `feeAmount`, `netReceive`, `totalDebit`

### Exchange

Flow hiện chỉ hỗ trợ `VND -> USDT`:

- user nhập số `VND` muốn đổi
- client gọi backend quote
- UI hiển thị:
  - số tiền gốc muốn đổi
  - phí đổi tiền
  - tổng `VND` sẽ bị trừ
  - tỷ giá realtime
  - `USDT` nhận được sau floor xuống số nguyên

Màn này chỉ là quy đổi số dư nội bộ, không phải giao dịch blockchain thật.

### History

Lịch sử hiển thị có cấu trúc cho:

- deposits
- withdrawals
- exchange orders

Exchange history không còn parse từ text note của ledger; client dùng payload có cấu trúc từ backend.

Ngoài danh sách lịch sử chính, màn này còn có overlay `Thông báo` theo kiểu app ngân hàng:

- feed được dựng client-side từ `wallet ledger`, `deposits`, `withdrawals`, `exchange orders`
- nạp tiền hiển thị số cộng, rút tiền hiển thị tổng số bị trừ, đổi tiền hiển thị số nhận được và dòng phụ là số đã trừ
- overlay này không có notification table riêng, không có read/unread trong v1, và chỉ fetch khi user mở mail icon

### Account

- chỉnh profile
- đổi mật khẩu
- 2FA hiện được hiển thị là tính năng chưa hỗ trợ, không phải toggle hoạt động thật
- mail icon dùng chung overlay `Thông báo` với `/dashboard` và `/history`

### Admin

- Quản trị user: profile, role, password, balances
- Duyệt nạp và rút
- Quản trị bank accounts cho nạp `VND`
- Cấu hình TTL reservation và financial fee settings

## Tích hợp với API

- API base mặc định: `http://localhost:3000/api/v1`
- Auth dựa trên JWT access/refresh flow từ backend
- Các flow tài chính quan trọng phụ thuộc hoàn toàn vào backend contract:
  - reservation state
  - review state
  - exchange quote
  - financial settings
  - admin bank capacity

Client không nên tự suy luận semantics từ raw backend text. Các flow chính hiện dùng typed response + `error.code`.

## Scripts hữu ích

Từ root workspace:

```bash
pnpm --filter client dev
pnpm --filter client build
pnpm --filter client start
pnpm --filter client start:prod
pnpm --filter client preview
pnpm --filter client test
pnpm --filter client format
pnpm --filter client check
```

## Production với PM2

Client production hiện được chạy bằng Node runtime của TanStack Start, không phải static hosting thuần và cũng không dùng `vite preview`.

Quy trình từ root workspace:

```bash
pnpm install
pnpm --filter client build
pm2 start ecosystem.config.cjs --only client
pm2 save
```

Lệnh thường dùng:

```bash
pm2 restart ecosystem.config.cjs --only client
pm2 logs client
```

Trong PM2:

- `client` chạy từ `.output/server/index.mjs`
- mặc định bind `HOST=127.0.0.1`
- mặc định chạy nội bộ ở `PORT=3001`

## Ghi chú vận hành

- `/forgot-password` hiện là màn support-only, chưa có backend reset flow
- Nạp `VND` dùng reservation flow nên UI sẽ phục hồi `active` hoặc `pending_review` từ backend khi mở lại modal
- Nếu financial settings chưa tải được, màn rút tiền và đổi tiền sẽ chặn submit thay vì giả định phí `0%`
