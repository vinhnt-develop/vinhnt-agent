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
 * Shared projectPath resolution for agent controller/gateway.
 * Priority: project.directory → workspace.directory + project.name → undefined.
 */
export function resolveProjectPathFromDeps(deps: ProjectPathDeps): string | undefined {
  const { session, project, workspace } = deps;
  if (!session?.projectId || !project) return undefined;
  if (project.directory) return project.directory;
  if (project.workspaceId && workspace?.directory) {
    return path.join(workspace.directory, project.name || '');
  }
  return undefined;
}
