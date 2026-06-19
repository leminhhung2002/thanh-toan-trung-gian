CREATE TABLE `assets` (
	`id` varchar(36) NOT NULL,
	`code` varchar(16) NOT NULL,
	`name` varchar(100) NOT NULL,
	`kind` enum('fiat','crypto') NOT NULL,
	`asset_precision` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `assets_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` varchar(36) NOT NULL,
	`actor_user_id` varchar(36),
	`action` varchar(100) NOT NULL,
	`entity_type` varchar(64) NOT NULL,
	`entity_id` varchar(36) NOT NULL,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`refresh_token_hash` varchar(128) NOT NULL,
	`user_agent` varchar(255),
	`ip_address` varchar(64),
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp,
	`last_used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`id` varchar(36) NOT NULL,
	`bank_name` varchar(100) NOT NULL,
	`account_number` varchar(100) NOT NULL,
	`account_name` varchar(100) NOT NULL,
	`daily_limit_minor` bigint NOT NULL DEFAULT 0,
	`used_today_minor` bigint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deposit_requests` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`asset_id` varchar(36) NOT NULL,
	`amount_minor` bigint NOT NULL,
	`method` varchar(50) NOT NULL,
	`destination_ref` varchar(255),
	`external_reference` varchar(255),
	`proof_url` varchar(500),
	`note` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`review_note` text,
	`approved_by` varchar(36),
	`approved_at` timestamp,
	`rejected_by` varchar(36),
	`rejected_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deposit_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exchange_orders` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`quote_id` varchar(36) NOT NULL,
	`from_asset_id` varchar(36) NOT NULL,
	`to_asset_id` varchar(36) NOT NULL,
	`from_amount_minor` bigint NOT NULL,
	`to_amount_minor` bigint NOT NULL,
	`rate` decimal(30,12) NOT NULL,
	`fee_bps` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchange_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exchange_quotes` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`from_asset_id` varchar(36) NOT NULL,
	`to_asset_id` varchar(36) NOT NULL,
	`from_amount_minor` bigint NOT NULL,
	`to_amount_minor` bigint NOT NULL,
	`rate` decimal(30,12) NOT NULL,
	`fee_bps` int NOT NULL DEFAULT 0,
	`expires_at` timestamp NOT NULL,
	`executed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchange_quotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exchange_rate_configs` (
	`id` varchar(36) NOT NULL,
	`from_asset_id` varchar(36) NOT NULL,
	`to_asset_id` varchar(36) NOT NULL,
	`rate` decimal(30,12) NOT NULL,
	`fee_bps` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exchange_rate_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `exchange_rate_pair_unique` UNIQUE(`from_asset_id`,`to_asset_id`)
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`id` varchar(36) NOT NULL,
	`actor_id` varchar(36) NOT NULL,
	`scope` varchar(100) NOT NULL,
	`key_name` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `idempotency_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `idempotency_actor_scope_key_unique` UNIQUE(`actor_id`,`scope`,`key_name`)
);
--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` varchar(36) NOT NULL,
	`wallet_id` varchar(36) NOT NULL,
	`bucket` enum('available','pending','total') NOT NULL,
	`direction` enum('credit','debit') NOT NULL,
	`amount_minor` bigint NOT NULL,
	`balance_before_minor` bigint NOT NULL,
	`balance_after_minor` bigint NOT NULL,
	`reference_type` varchar(64) NOT NULL,
	`reference_id` varchar(36) NOT NULL,
	`idempotency_key` varchar(128),
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ledger_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` varchar(36) NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key_name` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_key_name` PRIMARY KEY(`key_name`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` varchar(36) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_roles_user_id_role_id_pk` PRIMARY KEY(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`phone` varchar(64),
	`telegram` varchar(64),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`asset_id` varchar(36) NOT NULL,
	`available_minor` bigint NOT NULL DEFAULT 0,
	`pending_minor` bigint NOT NULL DEFAULT 0,
	`total_minor` bigint NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallets_user_asset_unique` UNIQUE(`user_id`,`asset_id`)
);
--> statement-breakpoint
CREATE TABLE `withdrawal_requests` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`asset_id` varchar(36) NOT NULL,
	`amount_minor` bigint NOT NULL,
	`method` varchar(50) NOT NULL,
	`destination_details` json,
	`note` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`review_note` text,
	`approved_by` varchar(36),
	`approved_at` timestamp,
	`rejected_by` varchar(36),
	`rejected_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `withdrawal_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `deposit_user_idx` ON `deposit_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `exchange_orders_user_idx` ON `exchange_orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `exchange_quotes_user_idx` ON `exchange_quotes` (`user_id`);--> statement-breakpoint
CREATE INDEX `ledger_wallet_idx` ON `ledger_entries` (`wallet_id`);--> statement-breakpoint
CREATE INDEX `ledger_reference_idx` ON `ledger_entries` (`reference_type`,`reference_id`);--> statement-breakpoint
CREATE INDEX `withdrawal_user_idx` ON `withdrawal_requests` (`user_id`);