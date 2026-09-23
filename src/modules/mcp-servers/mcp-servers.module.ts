import { Module, forwardRef } from '@nestjs/common';
import { AppConfigModule } from '@/infrastructure/config';
import { AgentModule } from '@/modules/agent';
import { McpServerController } from './controllers/mcp-server.controller';
import { McpServerService } from './services/mcp-server.service';
import { McpServerRepository } from './repositories/mcp-server.repository';

@Module({
  imports: [AppConfigModule, forwardRef(() => AgentModule)],
  controllers: [McpServerController],
  providers: [McpServerService, McpServerRepository],
  exports: [McpServerService],
})
export class McpServersModule {}
