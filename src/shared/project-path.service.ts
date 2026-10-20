import { ConflictException, Injectable, Logger } from '@nestjs/common';
import * as path from 'node:path';
import { SessionRepository } from '@/modules/session/repositories/session.repository';
import { ProjectRepository } from '@/modules/project/repositories/project.repository';
import { KernelSettingsStore } from './kernel-settings.store';
import {
  checkDirectoryStatus,
  resolveProjectPathFromDeps,
  type DirectoryStatus,
} from './project-path';

export interface ResolvedProjectPath {
  path: string;
  source: 'project' | 'workspace';
  status: DirectoryStatus;
  directory?: string;
}

export function projectDirectoryError(
  resolved: ResolvedProjectPath,
): Record<string, unknown> {
  return {
    statusCode: 409,
    error: 'PROJECT_DIRECTORY_MISSING',
    errorCode: 'PROJECT_DIRECTORY_MISSING',
    message: `Project directory is not available (${resolved.status}): ${resolved.path}`,
    details: {
      path: resolved.path,
      status: resolved.status,
      directory: resolved.directory,
    },
  };
}

/**
 * Shared project path resolution for agent + file/git explorers.
 * Priority: project.directory → workspaceRoot fallback (warn).
 * workspaceRoot comes from KernelSettingsStore (SC3 — saved kernel-settings.json
 * value; injecting AgentSettingsService here would cycle the module graph).
 */
@Injectable()
export class ProjectPathService {
  private readonly logger = new Logger(ProjectPathService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly settingsStore: KernelSettingsStore,
  ) {}

  async resolveDetails(sessionId?: string): Promise<ResolvedProjectPath> {
    if (sessionId) {
      const session = await this.sessionRepository.findById(sessionId);
      if (session?.projectId) {
        const project = await this.projectRepository.findById(session.projectId);
        if (project) {
          const workspaceRoot = this.settingsStore.getWorkspaceRoot();
          const dir = resolveProjectPathFromDeps({ session, project }, workspaceRoot);
          if (dir) {
            return {
              path: dir,
              source: 'project',
              status: await checkDirectoryStatus(dir),
              directory: project.directory ?? undefined,
            };
          }
        }
      }
    }

    const workspaceRoot = path.resolve(this.settingsStore.getWorkspaceRoot() || '.');
    return {
      path: workspaceRoot,
      source: 'workspace',
      status: await checkDirectoryStatus(workspaceRoot),
    };
  }

  async resolve(sessionId: string): Promise<string | undefined> {
    const resolved = await this.resolveDetails(sessionId);
    return resolved.source === 'project' ? resolved.path : undefined;
  }

  /**
   * Resolve project path for session, or fall back to workspaceRoot with explicit warn
   * (never silent monorepo root). Always returns an absolute path.
   * Throws 409 when a project directory is configured but unusable.
   */
  async resolveOrFallback(sessionId?: string): Promise<string> {
    const resolved = await this.resolveDetails(sessionId);
    if (resolved.status !== 'ok') {
      if (resolved.source === 'project') {
        throw new ConflictException(projectDirectoryError(resolved));
      }
      this.logger.warn(
        `Workspace root is not usable (${resolved.status}): ${resolved.path}`,
      );
      throw new ConflictException(projectDirectoryError(resolved));
    }
    if (resolved.source === 'workspace') {
      this.logger.warn(
        sessionId
          ? `No projectPath for session ${sessionId} — falling back to workspaceRoot=${resolved.path}`
          : `No sessionId — falling back to workspaceRoot=${resolved.path}`,
      );
    }
    return resolved.path;
  }
}
