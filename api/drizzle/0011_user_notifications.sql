CREATE TABLE `user_notifications` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `type` varchar(64) NOT NULL,
  `title` varchar(120) NOT NULL,
  `secondary_text` text NOT NULL,
  `primary_amount` varchar(64) NOT NULL,
  `primary_amount_tone` enum('plus','minus','neutral') NOT NULL,
  `primary_asset_code` varchar(16) NOT NULL,
  `reference_type` varchar(64) NOT NULL,
  `reference_id` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `user_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_notifications_user_created_idx` ON `user_notifications` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `user_notifications_reference_idx` ON `user_notifications` (`reference_type`,`reference_id`);
--> statement-breakpoint
CREATE TABLE `user_notification_states` (
  `user_id` varchar(36) NOT NULL,
  `last_read_at` timestamp NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_notification_states_user_id` PRIMARY KEY(`user_id`)
);
