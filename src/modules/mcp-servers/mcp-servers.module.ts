import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { McpServerController } from './controllers/mcp-server.controller';
import { McpServerService } from './services/mcp-server.service';
import { McpServerRepository } from './repositories/mcp-server.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [McpServerController],
  providers: [McpServerService, McpServerRepository],
  exports: [McpServerService],
})
export class McpServersModule {}
