ALTER TABLE `agent_runs` ADD `cache_read_tokens` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `agent_runs` ADD `cache_write_tokens` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `agent_runs` ADD `total_tokens` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `agent_runs` ADD `stop_reason` text;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `path` text;