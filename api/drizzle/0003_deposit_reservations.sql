CREATE TABLE `deposit_reservations` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `asset_id` varchar(36) NOT NULL,
  `amount_minor` bigint NOT NULL,
  `method` varchar(50) NOT NULL,
  `bank_account_id` varchar(36) NOT NULL,
  `transfer_content` varchar(255) NOT NULL,
  `status` enum('active','confirmed','expired','cancelled') NOT NULL DEFAULT 'active',
  `expires_at` timestamp NOT NULL,
  `confirmed_at` timestamp NULL,
  `deposit_request_id` varchar(36) NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `deposit_reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `deposit_reservations_user_idx` ON `deposit_reservations` (`user_id`);
--> statement-breakpoint
CREATE INDEX `deposit_reservations_bank_status_idx` ON `deposit_reservations` (`bank_account_id`,`status`);
--> statement-breakpoint
CREATE INDEX `deposit_reservations_expires_idx` ON `deposit_reservations` (`expires_at`);
