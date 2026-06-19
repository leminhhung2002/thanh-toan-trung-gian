ALTER TABLE `bank_accounts` MODIFY COLUMN `daily_limit_minor` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `bank_accounts` MODIFY COLUMN `used_today_minor` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `wallets` MODIFY COLUMN `available_minor` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `wallets` MODIFY COLUMN `pending_minor` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `wallets` MODIFY COLUMN `total_minor` bigint NOT NULL DEFAULT 0;