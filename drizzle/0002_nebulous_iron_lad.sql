CREATE INDEX `idx_agent_runs_session_id` ON `agent_runs` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_run_events_run_id` ON `run_events` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_executions_run_id` ON `tool_executions` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_executions_session_id` ON `tool_executions` (`session_id`);