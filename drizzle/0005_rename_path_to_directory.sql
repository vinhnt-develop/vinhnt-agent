-- Rename path -> directory in workspaces and projects tables
ALTER TABLE `workspaces` RENAME COLUMN `path` TO `directory`;--> statement-breakpoint
ALTER TABLE `projects` RENAME COLUMN `path` TO `directory`;
