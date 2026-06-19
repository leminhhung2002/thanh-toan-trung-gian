ALTER TABLE `withdrawal_requests`
  ADD `fee_amount_minor` bigint NOT NULL DEFAULT 0 AFTER `amount_minor`,
  ADD `total_debit_minor` bigint NOT NULL DEFAULT 0 AFTER `fee_amount_minor`;
--> statement-breakpoint
UPDATE `withdrawal_requests`
SET
  `fee_amount_minor` = 0,
  `total_debit_minor` = `amount_minor`
WHERE `total_debit_minor` = 0;
--> statement-breakpoint
ALTER TABLE `exchange_quotes`
  ADD `fee_amount_minor` bigint NOT NULL DEFAULT 0 AFTER `from_amount_minor`,
  ADD `total_debit_minor` bigint NOT NULL DEFAULT 0 AFTER `fee_amount_minor`;
--> statement-breakpoint
UPDATE `exchange_quotes`
SET
  `fee_amount_minor` = 0,
  `total_debit_minor` = `from_amount_minor`
WHERE `total_debit_minor` = 0;
--> statement-breakpoint
ALTER TABLE `exchange_orders`
  ADD `fee_amount_minor` bigint NOT NULL DEFAULT 0 AFTER `from_amount_minor`,
  ADD `total_debit_minor` bigint NOT NULL DEFAULT 0 AFTER `fee_amount_minor`;
--> statement-breakpoint
UPDATE `exchange_orders`
SET
  `fee_amount_minor` = 0,
  `total_debit_minor` = `from_amount_minor`
WHERE `total_debit_minor` = 0;
