import { Module } from '@nestjs/common';
import { ProjectPathModule } from '@/shared';
import { GitExplorerController } from './controllers';
import { GitExplorerService } from './services';

@Module({
  imports: [ProjectPathModule],
  controllers: [GitExplorerController],
  providers: [GitExplorerService],
  exports: [GitExplorerService],
})
export class GitExplorerModule {}
