-- Rename path -> directory in workspaces and projects tables
ALTER TABLE `workspaces` RENAME COLUMN `path` TO `directory`;
ALTER TABLE `projects` RENAME COLUMN `path` TO `directory`;
