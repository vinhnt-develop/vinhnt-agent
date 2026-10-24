import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionRepository } from '../repositories/session.repository';
import { PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class SessionService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async findAllByProject(projectId: string) {
    return this.sessionRepository.findByProjectId(projectId);
  }

  async findAllByProjectWithPagination(projectId: string, dto: PaginationDto) {
    return this.sessionRepository.findByProjectIdWithPagination(projectId, dto);
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

  async findMessagesWithPagination(
    sessionId: string,
    dto: PaginationDto & { order?: 'asc' | 'desc' },
  ) {
    await this.findById(sessionId);
    return this.sessionRepository.findMessagesWithPagination(sessionId, dto);
  }

  /**
   * Fork a session without mutating the source. `atMessageId` includes that
   * message and everything before it; `limit` then keeps only the newest N of
   * that prefix, which allows "fork from here" and "fork last N turns".
   */
  async fork(
    sessionId: string,
    data: { title?: string; atMessageId?: string; limit?: number },
  ) {
    const source = await this.findById(sessionId);
    const allMessages = await this.sessionRepository.findAllMessages(sessionId);

    let selected = allMessages;
    let forkPointMessageId: string | undefined;
    if (data.atMessageId !== undefined) {
      const index = allMessages.findIndex((message) => message.id === data.atMessageId);
      if (index < 0) {
        throw new BadRequestException('atMessageId does not belong to this session');
      }
      selected = allMessages.slice(0, index + 1);
      forkPointMessageId = data.atMessageId;
    }
    if (data.limit !== undefined && data.limit > 0) {
      selected = selected.slice(-data.limit);
    }

    const title = data.title?.trim()
      ? data.title.trim()
      : source.title
        ? `${source.title} (fork)`
        : 'Fork';

    return this.sessionRepository.fork({
      source,
      messageRows: selected,
      title,
      forkPointMessageId,
    });
  }

  async findForks(sessionId: string, dto: PaginationDto) {
    await this.findById(sessionId);
    return this.sessionRepository.findForksWithPagination(sessionId, dto);
  }

  async getSummary(sessionId: string) {
    const session = await this.findById(sessionId);
    const summary = await this.sessionRepository.findSummary(sessionId);
    return {
      sessionId: session.id,
      title: session.title ?? null,
      projectId: session.projectId ?? null,
      parentId: session.parentId ?? null,
      model: session.model ?? null,
      provider: session.provider ?? null,
      gitBranch: session.gitBranch ?? null,
      ...summary,
    };
  }
}
