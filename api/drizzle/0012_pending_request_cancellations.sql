ALTER TABLE `deposit_requests`
  ADD `cancelled_at` timestamp NULL AFTER `approved_at`;
--> statement-breakpoint
ALTER TABLE `deposit_requests`
  MODIFY COLUMN `status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE `withdrawal_requests`
  ADD `cancelled_at` timestamp NULL AFTER `approved_at`;
--> statement-breakpoint
ALTER TABLE `withdrawal_requests`
  MODIFY COLUMN `status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending';
