import { Module } from '@nestjs/common';
import { infrastructure } from './infrastructure';
import { modules } from './modules';
import { CoreModule } from './core';
import { ConfigModule } from './configuration';
import { KernelSettingsModule } from './shared';

@Module({
  imports: [ConfigModule, KernelSettingsModule, CoreModule, ...infrastructure, ...modules],
  controllers: [],
  providers: [],
})
export class AppModule {}
