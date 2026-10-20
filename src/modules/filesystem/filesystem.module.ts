import { Module } from '@nestjs/common';
import { FilesystemController } from './controllers';
import { FilesystemService } from './services';

@Module({
  controllers: [FilesystemController],
  providers: [FilesystemService],
  exports: [FilesystemService],
})
export class FilesystemModule {}
