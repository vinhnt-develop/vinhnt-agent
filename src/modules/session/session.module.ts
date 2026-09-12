import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { AgentModule } from '@/modules/agent';
import { SessionController } from './controllers/session.controller';
import { SessionService } from './services/session.service';
import { TrajectoryService } from './services/trajectory.service';
import { SessionRepository } from './repositories/session.repository';
import { AgentRunRepository } from '@/modules/agent/repositories/agent-run.repository';
import { ToolExecutionRepository } from '@/modules/agent/repositories/tool-execution.repository';

@Module({
  imports: [DatabaseModule, AgentModule],
  controllers: [SessionController],
  providers: [SessionService, SessionRepository, TrajectoryService, AgentRunRepository, ToolExecutionRepository],
  exports: [SessionService, TrajectoryService],
})
export class SessionModule {}
