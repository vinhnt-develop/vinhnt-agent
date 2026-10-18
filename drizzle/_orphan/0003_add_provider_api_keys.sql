CREATE TABLE `provider_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`api_key` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
DROP TABLE `provider_configs`;
--> statement-breakpoint
DROP TABLE `mcp_servers`;
--> statement-breakpoint
DROP TABLE `custom_tools`;
