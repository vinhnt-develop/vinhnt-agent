ALTER TABLE `memories` ADD `scope` text DEFAULT 'session' NOT NULL;
--> statement-breakpoint
ALTER TABLE `memories` ADD `user_id` text;
--> statement-breakpoint
ALTER TABLE `memories` ADD `app_id` text;
--> statement-breakpoint
CREATE INDEX `idx_memories_scope_user` ON `memories` (`scope`,`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_memories_scope_app` ON `memories` (`scope`,`app_id`);
