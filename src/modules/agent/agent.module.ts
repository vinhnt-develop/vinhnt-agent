import { Module } from '@nestjs/common';
import { StorageModule } from '@/infrastructure/storage';
import { ModelModule } from '@/infrastructure/model/model.module';
import { DatabaseModule } from '@/infrastructure/database';
import { McpServersModule } from '@/modules/mcp-servers';
import { AgentController } from './controllers';
import { AgentService, AgentToolkit } from './services';
import { AgentRunTrackingService } from './services/agent-run-tracking.service';
import { AgentRunRepository } from './repositories/agent-run.repository';
import { ToolExecutionRepository } from './repositories/tool-execution.repository';
import { AgentGateway } from './controllers/agent.gateway';
import { TrajectoryService } from '@/modules/session/services/trajectory.service';
import { SessionRepository } from '@/modules/session/repositories/session.repository';

@Module({
  imports: [StorageModule, ModelModule, DatabaseModule, McpServersModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    AgentToolkit,
    AgentGateway,
    AgentRunTrackingService,
    AgentRunRepository,
    ToolExecutionRepository,
    TrajectoryService,
    SessionRepository,
  ],
  exports: [AgentService, AgentToolkit, AgentRunTrackingService],
})
export class AgentModule {}
