import { Module } from '@nestjs/common';
import { GitExplorerController } from './controllers';
import { GitExplorerService } from './services';

@Module({
  controllers: [GitExplorerController],
  providers: [GitExplorerService],
  exports: [GitExplorerService],
})
export class GitExplorerModule {}
