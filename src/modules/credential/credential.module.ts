import { Module } from '@nestjs/common';
import { CredentialController } from './controllers/credential.controller';
import { CredentialService } from './services/credential.service';
import { CredentialRepository } from './repositories/credential.repository';

@Module({
  controllers: [CredentialController],
  providers: [CredentialService, CredentialRepository],
  exports: [CredentialService],
})
export class CredentialModule {}
