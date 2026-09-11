import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { ProviderConfigModule } from '@/modules/provider-config';
import { ProviderFactory } from './provider-factory';

@Module({
  imports: [DatabaseModule, ProviderConfigModule],
  providers: [ProviderFactory],
  exports: [ProviderFactory],
})
export class ModelModule {}
