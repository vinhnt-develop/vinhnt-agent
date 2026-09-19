ALTER TABLE `sessions` ADD `directory` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `git_branch` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `version` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `content_blocks` text DEFAULT '[]';
