import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/infrastructure/config';
import { McpServerController } from './controllers/mcp-server.controller';
import { McpServerService } from './services/mcp-server.service';
import { McpServerRepository } from './repositories/mcp-server.repository';

@Module({
  imports: [AppConfigModule],
  controllers: [McpServerController],
  providers: [McpServerService, McpServerRepository],
  exports: [McpServerService],
})
export class McpServersModule {}
