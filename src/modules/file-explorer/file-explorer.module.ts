import { Module } from '@nestjs/common';
import { FileExplorerController } from './controllers';
import { FileExplorerService } from './services';

@Module({
  controllers: [FileExplorerController],
  providers: [FileExplorerService],
  exports: [FileExplorerService],
})
export class FileExplorerModule {}
