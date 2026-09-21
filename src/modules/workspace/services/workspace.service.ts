import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class WorkspaceService {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

  async create(data: { name: string; description?: string; path?: string; ownerId: string }) {
    const existing = await this.workspaceRepository.findByName(data.name, data.ownerId);
    if (existing) {
      throw new ConflictException('Workspace name already exists');
    }
    return this.workspaceRepository.create(data);
  }

  async findAllByOwner(ownerId: string) {
    return this.workspaceRepository.findByOwnerId(ownerId);
  }

  async findAllByOwnerWithPagination(ownerId: string, dto: PaginationDto) {
    return this.workspaceRepository.findByOwnerIdWithPagination(ownerId, dto);
  }

  async findById(id: string, userId: string) {
    const workspace = await this.workspaceRepository.findById(id);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return workspace;
  }

  async update(id: string, data: { name?: string; description?: string; path?: string }, userId: string) {
    const workspace = await this.findById(id, userId);
    if (data.name && data.name !== workspace.name) {
      const existing = await this.workspaceRepository.findByName(data.name, userId);
      if (existing) {
        throw new ConflictException('Workspace name already exists');
      }
    }
    return this.workspaceRepository.update(id, data);
  }

  async softDelete(id: string, userId: string) {
    await this.findById(id, userId);
    await this.workspaceRepository.softDelete(id);
  }

  async setActive(id: string, userId: string) {
    await this.findById(id, userId);
    return this.workspaceRepository.setActive(id, userId);
  }
}
