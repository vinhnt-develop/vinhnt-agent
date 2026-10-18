CREATE INDEX IF NOT EXISTS `idx_messages_session_id` ON `messages` (`session_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sessions_project_id` ON `sessions` (`project_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_agent_runs_status` ON `agent_runs` (`status`);--> statement-breakpoint
DROP INDEX IF EXISTS `idx_run_events_run_id`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_run_events_run_id_sequence` ON `run_events` (`run_id`,`sequence`);
