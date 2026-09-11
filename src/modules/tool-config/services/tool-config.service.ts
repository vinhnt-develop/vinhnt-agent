import { Injectable, NotFoundException } from '@nestjs/common';
import { ToolConfigRepository } from '../repositories/tool-config.repository';

@Injectable()
export class ToolConfigService {
  constructor(private readonly toolConfigRepository: ToolConfigRepository) {}

  async findAll() {
    return this.toolConfigRepository.findAll();
  }

  async findBySource(source: string) {
    return this.toolConfigRepository.findBySource(source);
  }

  async findById(id: string) {
    const config = await this.toolConfigRepository.findById(id);
    if (!config) {
      throw new NotFoundException('Tool config not found');
    }
    return config;
  }

  async findByToolId(toolId: string) {
    return this.toolConfigRepository.findByToolId(toolId);
  }

  async findEnabled() {
    return this.toolConfigRepository.findEnabled();
  }

  async create(data: {
    toolId: string;
    source: string;
    config?: Record<string, any>;
    isEnabled?: boolean;
    mcpServerName?: string;
    mcpToolName?: string;
    version?: string;
    manifest?: Record<string, any>;
  }) {
    return this.toolConfigRepository.create(data);
  }

  async update(id: string, data: {
    config?: Record<string, any>;
    isEnabled?: boolean;
    version?: string;
    manifest?: Record<string, any>;
  }) {
    await this.findById(id);
    return this.toolConfigRepository.update(id, data);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.toolConfigRepository.softDelete(id);
  }
}
