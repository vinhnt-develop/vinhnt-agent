CREATE TABLE `session_surfaces` (
	`session_id` text NOT NULL,
	`surface_id` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`session_id`, `surface_id`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_session_surfaces_session_id` ON `session_surfaces` (`session_id`);
