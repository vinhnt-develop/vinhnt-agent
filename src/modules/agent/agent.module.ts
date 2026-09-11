import { Module } from '@nestjs/common';
import { StorageModule } from '@/infrastructure/storage';
import { ModelModule } from '@/infrastructure/model/model.module';
import { ToolConfigModule } from '@/modules/tool-config';
import { McpServersModule } from '@/modules/mcp-servers';
import { AgentController } from './controllers';
import { AgentService, AgentToolkit } from './services';
import { AgentGateway } from './controllers/agent.gateway';

@Module({
  imports: [StorageModule, ModelModule, ToolConfigModule, McpServersModule],
  controllers: [AgentController],
  providers: [AgentService, AgentToolkit, AgentGateway],
  exports: [AgentService, AgentToolkit],
})
export class AgentModule {}
