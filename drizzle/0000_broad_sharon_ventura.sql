CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`status` text DEFAULT 'pending',
	`trigger_type` text,
	`model` text,
	`provider` text,
	`input_tokens` integer DEFAULT 0,
	`output_tokens` integer DEFAULT 0,
	`reasoning_tokens` integer DEFAULT 0,
	`total_cost` real DEFAULT 0,
	`duration_ms` integer,
	`tool_calls_count` integer DEFAULT 0,
	`error_message` text,
	`metadata` text DEFAULT '{}',
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT datetime('now')
);
--> statement-breakpoint
CREATE INDEX `idx_agent_runs_session_id` ON `agent_runs` (`session_id`);--> statement-breakpoint
CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`tier` text DEFAULT 'working',
	`key` text NOT NULL,
	`value` text NOT NULL,
	`tags` text DEFAULT '[]',
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now'),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `run_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`type` text NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`data` text DEFAULT '{}',
	`trace_id` text,
	`occurred_at` text DEFAULT datetime('now')
);
--> statement-breakpoint
CREATE INDEX `idx_run_events_run_id` ON `run_events` (`run_id`);--> statement-breakpoint
CREATE TABLE `tool_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`session_id` text,
	`message_id` text,
	`tool_name` text NOT NULL,
	`tool_input` text DEFAULT '{}',
	`tool_output` text DEFAULT '{}',
	`status` text DEFAULT 'pending',
	`error_message` text,
	`duration_ms` integer DEFAULT 0,
	`started_at` text DEFAULT datetime('now'),
	`completed_at` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tool_executions_run_id` ON `tool_executions` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_executions_session_id` ON `tool_executions` (`session_id`);--> statement-breakpoint
CREATE TABLE `knowledge` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`source_ref` text,
	`tier` text DEFAULT 'stable',
	`tags` text DEFAULT '[]',
	`embedding` text,
	`content_hash` text,
	`file_path` text,
	`is_editable` integer DEFAULT true,
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now'),
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_source` ON `knowledge` (`source`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_content_hash` ON `knowledge` (`content_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_knowledge_key_source` ON `knowledge` (`key`,`source`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`path` text,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now'),
	`deleted_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text DEFAULT '',
	`tool_call_id` text,
	`content_blocks` text DEFAULT '[]',
	`input_tokens` integer DEFAULT 0,
	`output_tokens` integer DEFAULT 0,
	`reasoning_tokens` integer DEFAULT 0,
	`model` text,
	`provider` text,
	`cost` real DEFAULT 0,
	`metadata` text DEFAULT '{}',
	`created_at` text DEFAULT datetime('now'),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`title` text,
	`is_active` integer DEFAULT true,
	`model` text,
	`provider` text,
	`cost` real DEFAULT 0,
	`input_tokens` integer DEFAULT 0,
	`output_tokens` integer DEFAULT 0,
	`directory` text,
	`git_branch` text,
	`version` text,
	`parent_id` text,
	`metadata` text DEFAULT '{}',
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now'),
	`deleted_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_id` text NOT NULL,
	`is_active` integer DEFAULT false,
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now'),
	`deleted_at` text
);
