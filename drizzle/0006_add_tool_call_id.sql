ALTER TABLE `tool_executions` ADD `tool_call_id` text;--> statement-breakpoint
CREATE INDEX `idx_tool_executions_tool_call_id` ON `tool_executions` (`tool_call_id`);
