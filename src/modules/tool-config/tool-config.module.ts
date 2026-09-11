import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { ToolConfigController } from './controllers/tool-config.controller';
import { ToolConfigService } from './services/tool-config.service';
import { ToolConfigRepository } from './repositories/tool-config.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [ToolConfigController],
  providers: [ToolConfigService, ToolConfigRepository],
  exports: [ToolConfigService],
})
export class ToolConfigModule {}
