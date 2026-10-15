import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { StorageModule } from '@/infrastructure/storage/storage.module';
import { ProviderConfigModule } from '@/modules/provider-config/provider-config.module';
import { KnowledgeController } from './controllers/knowledge.controller';
import { KnowledgeService } from './services/knowledge.service';
import { AgentKnowledgeService } from './services/agent-knowledge.service';
import { EmbeddingService } from './services/embedding.service';
import { KnowledgeRepository } from './repositories/knowledge.repository';

@Module({
  imports: [DatabaseModule, StorageModule, ProviderConfigModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, AgentKnowledgeService, EmbeddingService, KnowledgeRepository],
  exports: [KnowledgeService, AgentKnowledgeService],
})
export class KnowledgeModule {}
