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
CREATE TABLE `credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`label` text,
	`type` text NOT NULL,
	`value_encrypted` text NOT NULL,
	`metadata` text DEFAULT '{}',
	`expires_at` text,
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now'),
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_credentials_name` ON `credentials` (`name`);--> statement-breakpoint
CREATE TABLE `mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`transport` text NOT NULL,
	`command` text,
	`args` text,
	`url` text,
	`env` text DEFAULT '{}',
	`is_enabled` integer DEFAULT true,
	`tool_count` integer DEFAULT 0,
	`last_connected_at` text,
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now'),
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_servers_name_unique` ON `mcp_servers` (`name`);--> statement-breakpoint
CREATE INDEX `idx_mcp_servers_name` ON `mcp_servers` (`name`);--> statement-breakpoint
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
CREATE TABLE `provider_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`name` text,
	`api_key` text,
	`base_url` text,
	`default_model` text,
	`configs` text DEFAULT '{}',
	`pricing` text DEFAULT '{}',
	`is_active` integer DEFAULT true,
	`is_default` integer DEFAULT false,
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now'),
	`deleted_at` text
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
CREATE TABLE `custom_tools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`input_schema` text DEFAULT '{}',
	`handler_type` text DEFAULT 'webhook' NOT NULL,
	`handler_config` text DEFAULT '{}',
	`timeout_ms` integer DEFAULT 30000,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now'),
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_custom_tools_name` ON `custom_tools` (`name`);--> statement-breakpoint
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
CREATE TABLE `plugin_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`plugin_id` text NOT NULL,
	`source` text DEFAULT 'custom' NOT NULL,
	`version` text,
	`latest_version` text,
	`author` text,
	`repository` text,
	`description` text,
	`dependencies` text DEFAULT '[]',
	`local_path` text,
	`config` text DEFAULT '{}',
	`is_enabled` integer DEFAULT true,
	`installed_at` text DEFAULT datetime('now'),
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now'),
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_plugin_configs_plugin_source` ON `plugin_configs` (`plugin_id`,`source`);--> statement-breakpoint
CREATE INDEX `idx_plugin_configs_source` ON `plugin_configs` (`source`);--> statement-breakpoint
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
	`metadata` text DEFAULT '{}',
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now'),
	`deleted_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tool_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`tool_id` text NOT NULL,
	`source` text DEFAULT 'custom' NOT NULL,
	`mcp_server_name` text,
	`mcp_tool_name` text,
	`version` text,
	`config` text DEFAULT '{}',
	`is_enabled` integer DEFAULT true,
	`manifest` text,
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now'),
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tool_configs_tool_source` ON `tool_configs` (`tool_id`,`source`);--> statement-breakpoint
CREATE INDEX `idx_tool_configs_source` ON `tool_configs` (`source`);--> statement-breakpoint
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
