ALTER TABLE `exchange_orders`
  ADD `status` enum('completed','reversed') NOT NULL DEFAULT 'completed' AFTER `markup_profit_vnd_minor`,
  ADD `reversed_at` timestamp NULL AFTER `status`,
  ADD `reversed_by` varchar(36) NULL AFTER `reversed_at`;
