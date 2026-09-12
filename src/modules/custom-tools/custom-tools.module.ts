import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/infrastructure/config';
import { CustomToolController } from './controllers/custom-tool.controller';
import { CustomToolService } from './services/custom-tool.service';
import { CustomToolRepository } from './repositories/custom-tool.repository';

@Module({
  imports: [AppConfigModule],
  controllers: [CustomToolController],
  providers: [CustomToolService, CustomToolRepository],
  exports: [CustomToolService],
})
export class CustomToolsModule {}
