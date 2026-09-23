import { Module } from '@nestjs/common';
import { ProjectPathModule } from '@/shared';
import { FileExplorerController } from './controllers';
import { FileExplorerService } from './services';

@Module({
  imports: [ProjectPathModule],
  controllers: [FileExplorerController],
  providers: [FileExplorerService],
  exports: [FileExplorerService],
})
export class FileExplorerModule {}
