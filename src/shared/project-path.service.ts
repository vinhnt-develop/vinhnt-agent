import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionRepository } from '@/modules/session/repositories/session.repository';
import { ProjectRepository } from '@/modules/project/repositories/project.repository';
import { WorkspaceRepository } from '@/modules/workspace/repositories/workspace.repository';
import { resolveProjectPathFromDeps } from './project-path';

/**
 * Shared project path resolution for agent + file/git explorers.
 * Priority: project.directory → workspace.directory + project.name → workspaceRoot fallback (warn).
 */
@Injectable()
export class ProjectPathService {
  private readonly logger = new Logger(ProjectPathService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly configService: ConfigService,
  ) {}

  async resolve(sessionId: string): Promise<string | undefined> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (!session?.projectId) return undefined;
      const project = await this.projectRepository.findById(session.projectId);
      if (!project) return undefined;
      const workspace = project.workspaceId
        ? await this.workspaceRepository.findById(project.workspaceId)
        : null;
      return resolveProjectPathFromDeps({ session, project, workspace });
    } catch {
      return undefined;
    }
  }

  /**
   * Resolve project path for session, or fall back to workspaceRoot with explicit warn
   * (never silent monorepo root).
   */
  async resolveOrFallback(sessionId?: string): Promise<string> {
    if (sessionId) {
      const projectPath = await this.resolve(sessionId);
      if (projectPath) return projectPath;
    }
    const fallback =
      this.configService.get<string>('agent.workspaceRoot', '.') || '.';
    this.logger.warn(
      sessionId
        ? `No projectPath for session ${sessionId} — falling back to workspaceRoot=${fallback}`
        : `No sessionId — falling back to workspaceRoot=${fallback}`,
    );
    return fallback;
  }
}
