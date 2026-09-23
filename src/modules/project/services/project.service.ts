import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from '../repositories/project.repository';
import { PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class ProjectService {
  constructor(private readonly projectRepository: ProjectRepository) {}

  async findAllByWorkspace(workspaceId: string) {
    return this.projectRepository.findByWorkspaceId(workspaceId);
  }

  async findAllByWorkspaceWithPagination(workspaceId: string, dto: PaginationDto) {
    return this.projectRepository.findByWorkspaceIdWithPagination(workspaceId, dto);
  }

  async findById(id: string) {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async create(data: { name: string; description?: string; directory?: string; workspaceId: string }) {
    return this.projectRepository.create(data);
  }

  async update(id: string, data: { name?: string; description?: string; directory?: string }) {
    await this.findById(id);
    return this.projectRepository.update(id, data);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.projectRepository.softDelete(id);
  }
}
