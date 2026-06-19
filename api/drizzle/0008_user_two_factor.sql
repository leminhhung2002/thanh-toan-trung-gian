ALTER TABLE `users`
  ADD COLUMN `two_factor_enabled` boolean NOT NULL DEFAULT false,
  ADD COLUMN `two_factor_secret_encrypted` varchar(512),
  ADD COLUMN `two_factor_pending_secret_encrypted` varchar(512);
