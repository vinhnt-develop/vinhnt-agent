import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { ProviderConfigController } from './controllers/provider-config.controller';
import { ProviderConfigService } from './services/provider-config.service';
import { ProviderConfigRepository } from './repositories/provider-config.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [ProviderConfigController],
  providers: [ProviderConfigService, ProviderConfigRepository],
  exports: [ProviderConfigService],
})
export class ProviderConfigModule {}
