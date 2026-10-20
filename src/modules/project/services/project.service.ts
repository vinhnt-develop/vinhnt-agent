import { Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'node:path';
import { ProjectRepository } from '../repositories/project.repository';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { KernelSettingsStore } from '@/shared/kernel-settings.store';
import {
  checkDirectoryStatus,
  isUsableDirectory,
  type DirectoryStatus,
} from '@/shared/project-path';

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
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly settingsStore: KernelSettingsStore,
  ) {}

  private async enrich<T extends { directory?: string | null }>(
    project: T,
  ): Promise<T & { directoryStatus: DirectoryStatus; resolvedDirectory?: string }> {
    if (!isUsableDirectory(project.directory)) {
      return { ...project, directoryStatus: 'unset' };
    }
    const workspaceRoot = this.settingsStore.getWorkspaceRoot() || '.';
    const resolvedDirectory = path.isAbsolute(project.directory)
      ? path.normalize(project.directory)
      : path.resolve(workspaceRoot, project.directory);
    const directoryStatus = await checkDirectoryStatus(resolvedDirectory);
    return { ...project, directoryStatus, resolvedDirectory };
  }

  async findAllByWorkspace(workspaceId: string) {
    const projects = await this.projectRepository.findByWorkspaceId(workspaceId);
    return Promise.all(projects.map((project) => this.enrich(project)));
  }

  async findAllByWorkspaceWithPagination(workspaceId: string, dto: PaginationDto) {
    const result =
      await this.projectRepository.findByWorkspaceIdWithPagination(workspaceId, dto);
    return {
      ...result,
      data: await Promise.all(result.data.map((project) => this.enrich(project))),
    };
  }

  async findById(id: string) {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.enrich(project);
  }

  async create(data: { name: string; description?: string; directory?: string; workspaceId: string }) {
    const project = await this.projectRepository.create({
      ...data,
      directory: normalizeDirectoryInput(data.directory) ?? undefined,
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.enrich(project);
  }

  async update(id: string, data: { name?: string; description?: string; directory?: string }) {
    await this.findById(id);
    const directory = normalizeDirectoryInput(data.directory);
    const project =
      directory === undefined
        ? await this.projectRepository.update(id, data)
        : await this.projectRepository.update(id, { ...data, directory });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.enrich(project);
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.projectRepository.softDelete(id);
  }
}
