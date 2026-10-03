import * as path from 'node:path';

export interface ProjectPathDeps {
  session: { projectId?: string | null } | null | undefined;
  project: {
    directory?: string | null;
    workspaceId?: string | null;
    name?: string;
  } | null | undefined;
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
 * Directory values that must be treated as "unset". Filesystem roots ("/", "\")
 * would otherwise resolve to a drive root and let runs operate on all of C:\;
 * "." / "./" are equally meaningless as a project root.
 */
export function isUsableDirectory(dir?: string | null): dir is string {
  if (!dir) return false;
  const t = dir.trim();
  if (!t) return false;
  return t !== '/' && t !== '\\' && t !== '.' && t !== './' && t !== '.\\';
}

/**
 * Shared projectPath resolution for agent controller/gateway.
 * Priority: project.directory → undefined (caller falls back to workspaceRoot).
 * Relative directories are resolved against `workspaceRoot` when provided.
 */
export function resolveProjectPathFromDeps(
  deps: ProjectPathDeps,
  workspaceRoot?: string,
): string | undefined {
  const { session, project } = deps;
  if (!session?.projectId || !project) return undefined;
  if (isUsableDirectory(project.directory)) {
    return absolutizeProjectDir(project.directory, workspaceRoot);
  }
  return undefined;
}
