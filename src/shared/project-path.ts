import * as path from 'node:path';

export interface ProjectPathDeps {
  session: { projectId?: string | null } | null | undefined;
  project: {
    directory?: string | null;
    workspaceId?: string | null;
    name?: string;
  } | null | undefined;
  workspace: { directory?: string | null } | null | undefined;
}

/**
 * Absolute-ise a project directory. Relative values are resolved against the
 * configured workspace root (falling back to process.cwd()) so files never
 * silently land under whatever directory the agent process was started from.
 */
function absolutizeProjectDir(dir: string, workspaceRoot?: string): string {
  if (path.isAbsolute(dir)) return path.normalize(dir);
  return workspaceRoot ? path.resolve(workspaceRoot, dir) : path.resolve(dir);
}

/**
 * Shared projectPath resolution for agent controller/gateway.
 * Priority: project.directory → workspace.directory + project.name → undefined.
 * Relative directories are resolved against `workspaceRoot` when provided.
 */
export function resolveProjectPathFromDeps(
  deps: ProjectPathDeps,
  workspaceRoot?: string,
): string | undefined {
  const { session, project, workspace } = deps;
  if (!session?.projectId || !project) return undefined;
  if (project.directory) return absolutizeProjectDir(project.directory, workspaceRoot);
  if (project.workspaceId && workspace?.directory) {
    return absolutizeProjectDir(path.join(workspace.directory, project.name || ''), workspaceRoot);
  }
  return undefined;
}
