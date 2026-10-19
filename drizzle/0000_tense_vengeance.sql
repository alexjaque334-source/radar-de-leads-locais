CREATE TABLE IF NOT EXISTS `radar_auth_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `radar_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`payload` text NOT NULL,
	`stage` text DEFAULT 'novo' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`follow_up` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `radar_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `radar_leads_owner_external_idx` ON `radar_leads` (`user_id`,`external_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `radar_leads_owner_updated_idx` ON `radar_leads` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `radar_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `radar_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `radar_sessions_user_idx` ON `radar_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `radar_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approved_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `radar_users_email_idx` ON `radar_users` (`email`);