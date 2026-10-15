import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { infrastructure } from './infrastructure';
import { modules } from './modules';
import { CoreModule } from './core';
import { ConfigModule } from './configuration';
import { KernelSettingsModule } from './shared';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [ConfigModule, KernelSettingsModule, CoreModule, ...infrastructure, ...modules],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
