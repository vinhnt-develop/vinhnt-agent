import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { CustomToolController } from './controllers/custom-tool.controller';
import { CustomToolService } from './services/custom-tool.service';
import { CustomToolRepository } from './repositories/custom-tool.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [CustomToolController],
  providers: [CustomToolService, CustomToolRepository],
  exports: [CustomToolService],
})
export class CustomToolsModule {}
