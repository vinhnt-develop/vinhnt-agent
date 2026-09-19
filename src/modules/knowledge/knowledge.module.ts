import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { StorageModule } from '@/infrastructure/storage/storage.module';
import { KnowledgeController } from './controllers/knowledge.controller';
import { KnowledgeService } from './services/knowledge.service';
import { AgentKnowledgeService } from './services/agent-knowledge.service';
import { KnowledgeRepository } from './repositories/knowledge.repository';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, AgentKnowledgeService, KnowledgeRepository],
  exports: [KnowledgeService, AgentKnowledgeService],
})
export class KnowledgeModule {}
