ALTER TABLE `users`
  DROP COLUMN `two_factor_enabled`,
  DROP COLUMN `two_factor_secret_encrypted`,
  DROP COLUMN `two_factor_pending_secret_encrypted`;
