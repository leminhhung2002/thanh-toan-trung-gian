ALTER TABLE `bank_accounts`
  ADD CONSTRAINT `bank_accounts_priority_unique` UNIQUE (`priority`);
--> statement-breakpoint
ALTER TABLE `bank_accounts`
  ADD CONSTRAINT `bank_accounts_identity_unique` UNIQUE (`bank_code`, `account_number`);
