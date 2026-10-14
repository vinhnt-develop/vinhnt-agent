import { Injectable, Logger } from '@nestjs/common';
import * as path from 'node:path';
import { SessionRepository } from '@/modules/session/repositories/session.repository';
import { ProjectRepository } from '@/modules/project/repositories/project.repository';
import { KernelSettingsStore } from './kernel-settings.store';
import { resolveProjectPathFromDeps } from './project-path';

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

  async resolve(sessionId: string): Promise<string | undefined> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (!session?.projectId) return undefined;
      const project = await this.projectRepository.findById(session.projectId);
      if (!project) return undefined;
      const workspaceRoot = this.settingsStore.getWorkspaceRoot();
      return resolveProjectPathFromDeps({ session, project }, workspaceRoot);
    } catch {
      return undefined;
    }
  }

  /**
   * Resolve project path for session, or fall back to workspaceRoot with explicit warn
   * (never silent monorepo root). Always returns an absolute path.
   */
  async resolveOrFallback(sessionId?: string): Promise<string> {
    if (sessionId) {
      const projectPath = await this.resolve(sessionId);
      if (projectPath) return projectPath;
    }
    const fallback = this.settingsStore.getWorkspaceRoot() || '.';
    this.logger.warn(
      sessionId
        ? `No projectPath for session ${sessionId} — falling back to workspaceRoot=${fallback}`
        : `No sessionId — falling back to workspaceRoot=${fallback}`,
    );
    return path.resolve(fallback);
  }
}
