CREATE TABLE `telegram_runtime_configs` (
  `id` varchar(36) NOT NULL,
  `bot_username` varchar(255),
  `chat_id` varchar(255) NOT NULL,
  `token_encrypted` text NOT NULL,
  `token_suffix` varchar(4) NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `last_validated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `telegram_runtime_configs_id` PRIMARY KEY(`id`)
);
