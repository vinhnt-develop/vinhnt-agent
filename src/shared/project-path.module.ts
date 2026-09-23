import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { SessionRepository } from '@/modules/session/repositories/session.repository';
import { ProjectRepository } from '@/modules/project/repositories/project.repository';
import { WorkspaceRepository } from '@/modules/workspace/repositories/workspace.repository';
import { ProjectPathService } from './project-path.service';

@Module({
  imports: [DatabaseModule],
  providers: [ProjectPathService, SessionRepository, ProjectRepository, WorkspaceRepository],
  exports: [ProjectPathService, SessionRepository, ProjectRepository, WorkspaceRepository],
})
export class ProjectPathModule {}
