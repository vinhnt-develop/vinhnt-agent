import { Module } from '@nestjs/common';
import { infrastructure } from './infrastructure';
import { modules } from './modules';
import { CoreModule } from './core';
import { ConfigModule } from './configuration';

@Module({
  imports: [ConfigModule, CoreModule, ...infrastructure, ...modules],
  controllers: [],
  providers: [],
})
export class AppModule {}
