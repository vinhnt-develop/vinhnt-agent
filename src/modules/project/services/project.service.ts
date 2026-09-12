import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from '../repositories/project.repository';

@Injectable()
export class ProjectService {
  constructor(private readonly projectRepository: ProjectRepository) {}

  async findAllByWorkspace(workspaceId: string) {
    return this.projectRepository.findByWorkspaceId(workspaceId);
  }

  async findById(id: string) {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async create(data: { name: string; description?: string; path?: string; directory?: string; workspaceId: string }) {
    const projectData = { ...data, path: data.path ?? data.directory };
    return this.projectRepository.create(projectData);
  }

  async update(id: string, data: { name?: string; description?: string; path?: string }) {
    await this.findById(id);
    return this.projectRepository.update(id, data);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.projectRepository.softDelete(id);
  }
}
