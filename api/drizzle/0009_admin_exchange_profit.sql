ALTER TABLE `exchange_quotes`
  ADD `realtime_rate_vnd` decimal(30,12) NOT NULL DEFAULT '0' AFTER `rate`,
  ADD `applied_markup_vnd` int NOT NULL DEFAULT 0 AFTER `realtime_rate_vnd`,
  ADD `fee_profit_vnd_minor` bigint NOT NULL DEFAULT 0 AFTER `fee_bps`,
  ADD `markup_profit_vnd_minor` bigint NOT NULL DEFAULT 0 AFTER `fee_profit_vnd_minor`;
--> statement-breakpoint
ALTER TABLE `exchange_orders`
  ADD `realtime_rate_vnd` decimal(30,12) NOT NULL DEFAULT '0' AFTER `rate`,
  ADD `applied_markup_vnd` int NOT NULL DEFAULT 0 AFTER `realtime_rate_vnd`,
  ADD `fee_profit_vnd_minor` bigint NOT NULL DEFAULT 0 AFTER `fee_bps`,
  ADD `markup_profit_vnd_minor` bigint NOT NULL DEFAULT 0 AFTER `fee_profit_vnd_minor`;
--> statement-breakpoint
ALTER TABLE `withdrawal_requests`
  ADD `fee_profit_vnd_minor` bigint NOT NULL DEFAULT 0 AFTER `fee_amount_minor`,
  ADD `profit_fx_rate_vnd` bigint AFTER `fee_profit_vnd_minor`;
