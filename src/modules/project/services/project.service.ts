import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from '../repositories/project.repository';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { isUsableDirectory } from '@/shared/project-path';

/**
 * Sanitize a client-supplied directory. Filesystem roots ("/", "\") and "."
 * mean "no directory" — storing them resolves runs to a drive root; normalize
 * to null so resolution falls back to workspace/agent root instead.
 * Returns undefined when the field was not provided (leave untouched).
 */
function normalizeDirectoryInput(dir?: string | null): string | null | undefined {
  if (dir === undefined) return undefined;
  const trimmed = dir?.trim() ?? '';
  return isUsableDirectory(trimmed) ? trimmed : null;
}

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
    return this.projectRepository.create({
      ...data,
      directory: normalizeDirectoryInput(data.directory) ?? undefined,
    });
  }

  async update(id: string, data: { name?: string; description?: string; directory?: string }) {
    await this.findById(id);
    const directory = normalizeDirectoryInput(data.directory);
    if (directory === undefined) {
      return this.projectRepository.update(id, data);
    }
    return this.projectRepository.update(id, { ...data, directory });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.projectRepository.softDelete(id);
  }
}
