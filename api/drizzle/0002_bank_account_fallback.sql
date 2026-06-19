ALTER TABLE `bank_accounts`
  ADD `bank_code` varchar(32) NOT NULL DEFAULT '970436',
  ADD `priority` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `deposit_requests`
  ADD `bank_account_id` varchar(36);
--> statement-breakpoint
UPDATE `bank_accounts`
SET `bank_code` = '970436'
WHERE `bank_code` IS NULL OR `bank_code` = '';
--> statement-breakpoint
ALTER TABLE `bank_accounts`
  ALTER COLUMN `bank_code` DROP DEFAULT;
