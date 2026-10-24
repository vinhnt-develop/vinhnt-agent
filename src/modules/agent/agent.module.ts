import { Module, forwardRef } from '@nestjs/common';
import { StorageModule } from '@/infrastructure/storage';
import { ModelModule } from '@/infrastructure/model/model.module';
import { DatabaseModule } from '@/infrastructure/database';
import { McpServersModule } from '@/modules/mcp-servers';
import { KnowledgeModule } from '@/modules/knowledge/knowledge.module';
import { ProjectPathModule } from '@/shared';
import { AgentController, AgentSettingsController } from './controllers';
import {
  AgentService,
  AgentToolkit,
  AgentSettingsService,
  AgentOtlpService,
  AttachmentService,
} from './services';
import { AgentRunTrackingService } from './services/agent-run-tracking.service';
import { AgentRunRepository } from './repositories/agent-run.repository';
import { HitlRequestRepository } from './repositories/hitl-request.repository';
import { ToolExecutionRepository } from './repositories/tool-execution.repository';
import { AgentGateway } from './controllers/agent.gateway';
import { SessionRepository } from '@/modules/session/repositories/session.repository';

@Module({
  imports: [
    StorageModule,
    ModelModule,
    DatabaseModule,
    forwardRef(() => McpServersModule),
    KnowledgeModule,
    ProjectPathModule,
  ],
  controllers: [AgentController, AgentSettingsController],
  providers: [
    AgentService,
    AgentToolkit,
    AgentSettingsService,
    AgentOtlpService,
    AttachmentService,
    AgentGateway,
    AgentRunTrackingService,
    AgentRunRepository,
    HitlRequestRepository,
    ToolExecutionRepository,
    SessionRepository,
  ],
  exports: [AgentService, AgentToolkit, AgentSettingsService, AgentRunTrackingService, ProjectPathModule],
})
export class AgentModule {}
