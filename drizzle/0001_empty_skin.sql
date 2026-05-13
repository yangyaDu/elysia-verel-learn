CREATE TABLE `users` (
	`id` bigint NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_uidx` UNIQUE(`email`)
);
--> statement-breakpoint
INSERT INTO `users` (`id`, `email`, `password_hash`) VALUES (1010101010101010101, 'legacy-placeholder@invalid', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
--> statement-breakpoint
ALTER TABLE `conversations` ADD `user_id` bigint;
--> statement-breakpoint
UPDATE `conversations` SET `user_id` = 1010101010101010101 WHERE `user_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `conversations` MODIFY `user_id` bigint NOT NULL;
--> statement-breakpoint
CREATE INDEX `conversations_user_id_idx` ON `conversations` (`user_id`);
