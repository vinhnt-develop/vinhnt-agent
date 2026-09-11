import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { PluginConfigController } from './controllers/plugin-config.controller';
import { PluginConfigService } from './services/plugin-config.service';
import { PluginConfigRepository } from './repositories/plugin-config.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [PluginConfigController],
  providers: [PluginConfigService, PluginConfigRepository],
  exports: [PluginConfigService],
})
export class PluginConfigModule {}
