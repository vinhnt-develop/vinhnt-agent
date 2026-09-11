import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionRepository } from '../repositories/session.repository';

@Injectable()
export class SessionService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async findAllByProject(projectId: string) {
    return this.sessionRepository.findByProjectId(projectId);
  }

  async findById(id: string) {
    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  async create(data: { title?: string; projectId?: string; model?: string; provider?: string }) {
    return this.sessionRepository.create(data);
  }

  async update(id: string, data: { title?: string; isActive?: boolean; model?: string; provider?: string }) {
    await this.findById(id);
    return this.sessionRepository.update(id, data);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.sessionRepository.softDelete(id);
  }

  async addMessage(sessionId: string, data: { role: string; content?: string; toolCallId?: string }) {
    await this.findById(sessionId);
    return this.sessionRepository.addMessage({ sessionId, ...data });
  }

  async findMessages(sessionId: string) {
    await this.findById(sessionId);
    return this.sessionRepository.findMessages(sessionId);
  }
}
