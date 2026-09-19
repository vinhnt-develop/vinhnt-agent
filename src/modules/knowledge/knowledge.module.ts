import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { KnowledgeController } from './controllers/knowledge.controller';
import { KnowledgeService } from './services/knowledge.service';
import { AgentKnowledgeService } from './services/agent-knowledge.service';
import { KnowledgeRepository } from './repositories/knowledge.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, AgentKnowledgeService, KnowledgeRepository],
  exports: [KnowledgeService, AgentKnowledgeService],
})
export class KnowledgeModule {}
