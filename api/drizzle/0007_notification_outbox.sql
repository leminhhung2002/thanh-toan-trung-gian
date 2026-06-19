CREATE TABLE `notification_outbox` (
  `id` varchar(36) NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `entity_type` varchar(64) NOT NULL,
  `entity_id` varchar(36) NOT NULL,
  `payload` json NOT NULL,
  `status` enum('pending','published','dead') NOT NULL DEFAULT 'pending',
  `attempt_count` int NOT NULL DEFAULT 0,
  `next_attempt_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_error` text,
  `published_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `notification_outbox_id_pk` PRIMARY KEY (`id`)
);
--> statement-breakpoint
CREATE INDEX `notification_outbox_status_next_attempt_idx`
  ON `notification_outbox` (`status`, `next_attempt_at`);
--> statement-breakpoint
CREATE INDEX `notification_outbox_entity_idx`
  ON `notification_outbox` (`entity_type`, `entity_id`);
