UPDATE `deposit_reservations`
SET `status` = 'pending_review'
WHERE `status` = 'confirmed';
--> statement-breakpoint
ALTER TABLE `deposit_reservations`
  MODIFY COLUMN `status` enum('active','pending_review','approved','rejected','expired','cancelled') NOT NULL DEFAULT 'active';
