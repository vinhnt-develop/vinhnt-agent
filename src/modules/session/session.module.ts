import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { SessionController } from './controllers/session.controller';
import { SessionService } from './services/session.service';
import { SessionRepository } from './repositories/session.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [SessionController],
  providers: [SessionService, SessionRepository],
  exports: [SessionService],
})
export class SessionModule {}
