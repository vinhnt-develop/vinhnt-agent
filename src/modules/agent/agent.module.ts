import { Module } from '@nestjs/common';
import { StorageModule } from '@/infrastructure/storage';
import { ModelModule } from '@/infrastructure/model/model.module';
import { DatabaseModule } from '@/infrastructure/database';
import { McpServersModule } from '@/modules/mcp-servers';
import { KnowledgeModule } from '@/modules/knowledge/knowledge.module';
import { AgentController, AgentSettingsController } from './controllers';
import { AgentService, AgentToolkit, AgentSettingsService } from './services';
import { AgentRunTrackingService } from './services/agent-run-tracking.service';
import { AgentRunRepository } from './repositories/agent-run.repository';
import { ToolExecutionRepository } from './repositories/tool-execution.repository';
import { AgentGateway } from './controllers/agent.gateway';
import { SessionRepository } from '@/modules/session/repositories/session.repository';

@Module({
  imports: [StorageModule, ModelModule, DatabaseModule, McpServersModule, KnowledgeModule],
  controllers: [AgentController, AgentSettingsController],
  providers: [
    AgentService,
    AgentToolkit,
    AgentSettingsService,
    AgentGateway,
    AgentRunTrackingService,
    AgentRunRepository,
    ToolExecutionRepository,
    SessionRepository,
  ],
  exports: [AgentService, AgentToolkit, AgentSettingsService, AgentRunTrackingService],
})
export class AgentModule {}
