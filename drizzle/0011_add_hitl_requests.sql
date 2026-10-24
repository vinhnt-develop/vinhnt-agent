CREATE TABLE `hitl_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`run_id` text NOT NULL,
	`session_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload` text NOT NULL,
	`reply` text,
	`error_message` text,
	`expires_at` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_hitl_requests_run_id` ON `hitl_requests` (`run_id`);
--> statement-breakpoint
CREATE INDEX `idx_hitl_requests_session_id` ON `hitl_requests` (`session_id`);
--> statement-breakpoint
CREATE INDEX `idx_hitl_requests_status` ON `hitl_requests` (`status`);
