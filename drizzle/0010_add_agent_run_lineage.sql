ALTER TABLE `agent_runs` ADD `parent_run_id` text;
--> statement-breakpoint
ALTER TABLE `agent_runs` ADD `agent_id` text;
--> statement-breakpoint
ALTER TABLE `agent_runs` ADD `trace_id` text;
--> statement-breakpoint
CREATE INDEX `idx_agent_runs_parent_run_id` ON `agent_runs` (`parent_run_id`);
--> statement-breakpoint
CREATE INDEX `idx_agent_runs_trace_id` ON `agent_runs` (`trace_id`);
